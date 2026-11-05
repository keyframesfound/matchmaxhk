import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { MatchedTutorCardView } from "@/features/cases/parent/matched-tutor";
import { supabase } from "@/integrations/supabase/client";
import {
  dismissSafetyVisitPrompt,
  markSafetyPromptSeen,
  markSafetyVisitShared,
} from "@/features/safety/safety.functions";
import {
  buildShareBody,
  formatVisitWindow,
  isAutoPromptEligible,
  shouldAutoPrompt,
  tutorFirstName,
  whatsappShareUrl,
  type CaseSafetyShareState,
  type SafetyLocale,
  type TrustedContact,
} from "@/features/safety/safety-share";

/**
 * Issue #650 "Share first visit" — the case-page share surface.
 *
 *  - Soft auto-prompt: fires ONCE per case when the first home-visit lesson is
 *    known (isAutoPromptEligible gates online-only cases and meeting links
 *    out, CEO lock). Dismissing ("Skip for now") stamps case_safety_shares
 *    dismissed_at through the service-role server fn — never nags again for
 *    that case. Marking prompt_seen_at on first render enforces the
 *    once-per-case rule even if the parent closes the tab without tapping
 *    anything (insert-only stamp: a dismissed/shared row is never touched).
 *  - Quiet manual control: after dismissal/share, and on online-only /
 *    centre-venue cases, a plain "Share first visit" button stays available
 *    (CEO lock: manual share optional, no auto-nag).
 *  - Payload: time window + tutor FIRST NAME + area only. No exact unit /
 *    flat / floor, no phone numbers. Delivery is a WhatsApp deep link and/or
 *    clipboard copy — no new messaging product.
 */

export type ShareFirstVisitCardProps = {
  userId: string;
  caseId: string;
  caseMode: string | null;
  caseDistrict: string | null;
  matchedTutor: MatchedTutorCardView | null;
  /** sequence-1 live lesson of the case (firstLiveLesson on the page). */
  firstLesson: { starts_at: string; duration_min: number; location_or_link: string | null } | null;
  parentName: string;
  /** Server-read lifecycle row (null = table pre-migration or not yet created). */
  shareState: Pick<CaseSafetyShareState, "dismissed_at" | "shared_at"> | null;
};

export function ShareFirstVisitCard(props: ShareFirstVisitCardProps) {
  const { t, i18n } = useTranslation();
  const { userId, caseId, caseMode, caseDistrict, matchedTutor, firstLesson, parentName } = props;
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);

  const autoEligible = isAutoPromptEligible(caseMode, firstLesson?.location_or_link ?? null);
  const showSoftPrompt = Boolean(
    autoEligible && firstLesson && matchedTutor && shouldAutoPrompt(props.shareState),
  );

  const invalidateCase = () =>
    queryClient.invalidateQueries({ queryKey: ["sor", "parent-case", caseId] });

  // One soft auto-prompt per case: the first render of the soft prompt stamps
  // prompt_seen_at (insert-only, owner-scoped in the server fn). Failures
  // degrade to showing the prompt again later — soft, never blocking.
  const markPromptSeen = useMutation({
    mutationFn: () => markSafetyPromptSeen({ data: { caseId } }),
    onError: () => {
      /* soft prompt only; ignore (e.g. table not migrated yet) */
    },
  });

  useEffect(() => {
    if (showSoftPrompt) markPromptSeen.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSoftPrompt]);

  const stateError = () => toast.error(t("safety.share_state_error"));

  // Trusted contact (optional): the WA deep link pre-fills the recipient when
  // one is saved; without one WhatsApp still opens with the message ready.
  const contactQuery = useQuery({
    queryKey: ["safety-trusted-contact", userId],
    queryFn: async (): Promise<TrustedContact | null> => {
      try {
        const { data, error } = await supabase
          .from("trusted_contacts")
          .select("id, parent_id, display_name, phone, created_at, updated_at")
          .eq("parent_id", userId)
          .maybeSingle();
        if (error) return null; // missing table pre-migration
        return (data as TrustedContact | null) ?? null;
      } catch {
        return null;
      }
    },
  });

  const markShared = useMutation({
    mutationFn: () => markSafetyVisitShared({ data: { caseId } }),
    onSuccess: () => {
      void invalidateCase();
    },
    onError: stateError,
  });

  const dismiss = useMutation({
    mutationFn: () => dismissSafetyVisitPrompt({ data: { caseId } }),
    onSuccess: () => {
      void invalidateCase();
    },
    onError: stateError,
  });

  if (!matchedTutor || !firstLesson) return null;

  const sheet = (open: boolean, onOpenChange: (open: boolean) => void) => (
    <ShareSheet
      open={open}
      onOpenChange={onOpenChange}
      caseId={caseId}
      contact={contactQuery.data ?? null}
      initialWindow={formatVisitWindow(
        firstLesson.starts_at,
        firstLesson.duration_min,
        i18n.language,
      )}
      initialTutorFirstName={tutorFirstName(matchedTutor.displayName)}
      initialArea={caseDistrict ?? ""}
      parentName={parentName}
      onShared={() => markShared.mutate()}
      onDismiss={() => dismiss.mutate()}
    />
  );

  if (showSoftPrompt) {
    return (
      <>
        {sheet(sheetOpen, setSheetOpen)}
        <section
          className="rounded-[var(--radius-panel)] border border-[color:var(--ink)]/15 bg-card p-5"
          data-testid="first-visit-prompt"
        >
          <div className="flex flex-wrap items-start gap-3">
            <BellRing
              className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--ink)]"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-[color:var(--ink)]">
                {t("safety.prompt_title")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("safety.prompt_desc")}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => setSheetOpen(true)} className="gap-2 font-bold">
              <Share2 className="h-4 w-4" aria-hidden="true" />
              {t("safety.share_btn")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={dismiss.isPending}
              onClick={() => {
                dismiss.mutate();
              }}
              className="font-bold text-muted-foreground"
            >
              {t("safety.share_skip")}
            </Button>
          </div>
        </section>
      </>
    );
  }

  // Quiet manual control: always available on any case with a matched tutor
  // and a known first lesson (online-only / centre-venue included, no nag).
  return (
    <>
      {sheet(sheetOpen, setSheetOpen)}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSheetOpen(true)}
          className="gap-2 border-[color:var(--ink)]/15 font-bold text-[color:var(--ink)] hover:bg-[color:var(--ink)]/5"
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          {t("safety.share_btn")}
        </Button>
      </div>
    </>
  );
}

type ShareSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  contact: TrustedContact | null;
  initialWindow: string;
  initialTutorFirstName: string;
  initialArea: string;
  parentName: string;
  onShared: () => void;
  onDismiss: () => void;
};

function ShareSheet(props: ShareSheetProps) {
  const { t, i18n } = useTranslation();
  const [window_, setWindow] = useState(props.initialWindow);
  const [tutorName, setTutorName] = useState(props.initialTutorFirstName);
  const [area, setArea] = useState(props.initialArea);
  const [opened, setOpened] = useState(false);

  // Re-seed the editable fields each time the sheet opens (the first-lesson
  // time can move between opens).
  useEffect(() => {
    if (props.open && !opened) {
      setWindow(props.initialWindow);
      setTutorName(props.initialTutorFirstName);
      setArea(props.initialArea);
      setOpened(true);
    }
    if (!props.open) setOpened(false);
  }, [props.open, props.initialWindow, props.initialTutorFirstName, props.initialArea, opened]);

  const locale: SafetyLocale = i18n.language?.toLowerCase().startsWith("zh") ? "zh-HK" : "en";
  const body = useMemo(
    () =>
      buildShareBody(
        {
          parentName: props.parentName,
          tutorFirstName: tutorName,
          window: window_,
          area,
        },
        locale,
      ),
    [props.parentName, tutorName, window_, area, locale],
  );
  const ready = Boolean(window_.trim() && tutorName.trim() && area.trim());

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      toast.success(t("safety.share_copied"));
      props.onShared();
      props.onOpenChange(false);
    } catch {
      toast.error(t("safety.share_copy_error"));
    }
  };

  const shareWhatsapp = () => {
    window.open(whatsappShareUrl(props.contact?.phone ?? null, body), "_blank", "noopener");
    props.onShared();
    props.onOpenChange(false);
  };

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl bg-[color:var(--surface)] px-5 pb-8 pt-4"
      >
        <SheetHeader className="px-0 text-left">
          <SheetTitle className="text-lg font-bold text-[color:var(--ink)]">
            {t("safety.share_title")}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {t("safety.share_desc")}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="safety-share-window">{t("safety.share_window_label")}</Label>
            <Input
              id="safety-share-window"
              value={window_}
              maxLength={60}
              onChange={(e) => setWindow(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="safety-share-tutor">{t("safety.share_tutor_label")}</Label>
            <Input
              id="safety-share-tutor"
              value={tutorName}
              maxLength={60}
              onChange={(e) => setTutorName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="safety-share-area">{t("safety.share_area_label")}</Label>
            <Input
              id="safety-share-area"
              value={area}
              maxLength={60}
              onChange={(e) => setArea(e.target.value)}
            />
          </div>
          <div className="rounded-lg border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] p-3">
            <p className="text-xs font-semibold text-muted-foreground">
              {t("safety.share_body_label")}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--ink)]">{body}</p>
          </div>
          {!props.contact && (
            <p className="text-sm text-muted-foreground">
              {t("safety.share_no_contact")}{" "}
              <Link
                to="/dashboard"
                hash="safety"
                className="font-semibold text-[color:var(--ink)] underline underline-offset-2"
              >
                {t("safety.share_no_contact_link")}
              </Link>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={!ready}
              onClick={shareWhatsapp}
              className="gap-2 font-bold"
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              {t("safety.share_wa")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!ready}
              onClick={() => void copy()}
              className="border-[color:var(--ink)]/15 font-bold text-[color:var(--ink)] hover:bg-[color:var(--ink)]/5"
            >
              {t("safety.share_copy")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="ml-auto font-bold text-muted-foreground"
              onClick={() => {
                props.onDismiss();
                props.onOpenChange(false);
              }}
            >
              {t("safety.share_skip")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
