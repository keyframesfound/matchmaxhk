/**
 * Issue #445 + #448 — the internal desk-track editor, mounted inside
 * TutorEditor (tutor admin, right next to the Risk Flag section). Manual-only
 * staff controls per the CEO lock 2026-10-24:
 *
 *   * Level (New | Active | Experienced) — manual in V1; CS-005 hint text
 *     explains the soft prefer rules. Never public (see desk-track.ts).
 *   * Guide sent — stamps who/when the Tutor Service Guide was shared
 *     (/tfirst first-match step), with a one-click copy of the Guide link.
 *   * Early L1 drop-offs — staff-counted; at ≥2 the #441 REVIEW flag path
 *     is surfaced as a one-click action.
 *
 * Authority is enforced server-side in setDeskTrack (any staff). Every
 * control commits its own audited action immediately — no dirty-state juggle
 * for a tool the desk uses mid-match.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Check, Copy, ExternalLink, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DESK_LEVELS,
  DESK_LEVEL_HINTS,
  DESK_LEVEL_LABELS,
  L1_DROPOFF_REVIEW_THRESHOLD,
  TUTOR_SERVICE_GUIDE_URL,
  normalizeDeskLevel,
  type DeskTutorLevel,
} from "@/features/admin/desk-track";
import { getDeskTracks, setDeskTrack } from "@/features/admin/desk-track.functions";
import { setRiskFlag } from "@/features/admin/risk-flags.functions";

/** One audited desk action — mirrors setDeskTrack's zod patch. */
type DeskPatch = {
  tutorLevel?: DeskTutorLevel;
  guideSent?: boolean;
  dropoffDelta?: number;
  dropoffNote?: string | null;
};

function useCopyGuide() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(TUTOR_SERVICE_GUIDE_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed — select the link text instead");
    }
  };
  return { copied, copy };
}

export function DeskTrackEditor({ tutorId }: { tutorId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { copied, copy } = useCopyGuide();
  const [note, setNote] = useState<string | null>(null);

  const queryKey = ["admin", "desk-track", tutorId];
  const rowQuery = useQuery({
    queryKey,
    queryFn: () => getDeskTracks({ data: { tutorIds: [tutorId] } }),
  });
  const row = rowQuery.data?.[0] ?? null;
  const level = normalizeDeskLevel(row?.tutor_level);
  const dropoffs = row?.l1_early_dropoffs ?? 0;

  // Local note mirrors the stored one until the desk edits it; applied on
  // blur (or Save) so typing does not spam audited writes.
  const storedNote = row?.dropoff_note ?? "";
  const noteDraft = note ?? storedNote;

  const mutate = useMutation({
    mutationFn: (patch: DeskPatch) => setDeskTrack({ data: { tutorId, ...patch } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(t("deskTrack.saved", { defaultValue: "Desk track saved" }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewFlag = useMutation({
    mutationFn: () => setRiskFlag({ data: { entity: "tutor", id: tutorId, flag: "REVIEW" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "risk-flags"] });
      toast.success(t("deskTrack.review_set", { defaultValue: "REVIEW flag set" }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (rowQuery.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-2/3 rounded-xl" />
      </div>
    );
  }

  const needsReview = dropoffs >= L1_DROPOFF_REVIEW_THRESHOLD;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-[color:var(--ink)]">
            {t("deskTrack.level_label", { defaultValue: "Desk track level" })}
          </Label>
          <Select
            value={level}
            onValueChange={(v) => mutate.mutate({ tutorLevel: v as DeskTutorLevel })}
          >
            <SelectTrigger className="h-10 border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DESK_LEVELS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`deskTrack.level_${value}`, { defaultValue: DESK_LEVEL_LABELS[value] })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="self-end pb-1 text-xs text-muted-foreground">
          {t(`deskTrack.hint_${level}`, { defaultValue: DESK_LEVEL_HINTS[level] })}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--ink)]/[0.07] px-4 py-3">
        <div>
          <Label className="text-xs font-bold text-[color:var(--ink)]">
            {t("deskTrack.guide_label", { defaultValue: "Tutor Service Guide sent" })}
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {row?.guide_sent_at
              ? t("deskTrack.guide_sent_at", {
                  defaultValue: "Sent {{when}}",
                  when: formatDistanceToNow(new Date(row.guide_sent_at), { addSuffix: true }),
                })
              : t("deskTrack.guide_untouched", {
                  defaultValue: "Share in the private 1:1 at the first match (/tfirst).",
                })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={TUTOR_SERVICE_GUIDE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--brand-link)] hover:underline"
          >
            {t("deskTrack.guide_open", { defaultValue: "Open Guide" })}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
          <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
            {copied ? (
              <Check className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Copy className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t("deskTrack.guide_copy", { defaultValue: "Copy link" })}
          </Button>
          <Switch
            checked={Boolean(row?.guide_sent_at)}
            disabled={mutate.isPending}
            onCheckedChange={(checked) => mutate.mutate({ guideSent: checked })}
            aria-label={t("deskTrack.guide_label", { defaultValue: "Tutor Service Guide sent" })}
          />
        </div>
      </div>

      <div className="rounded-xl border border-[color:var(--ink)]/[0.07] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Label className="text-xs font-bold text-[color:var(--ink)]">
              {t("deskTrack.dropoff_label", { defaultValue: "Early L1 drop-offs" })}
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("deskTrack.dropoff_hint", {
                defaultValue:
                  "Counted by the desk when a tutor goes quiet after Lesson 1. Two or more point at the REVIEW path.",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={dropoffs === 0 || mutate.isPending}
              onClick={() => mutate.mutate({ dropoffDelta: -1 })}
              aria-label={t("deskTrack.dropoff_minus", { defaultValue: "Decrease count" })}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="min-w-6 text-center text-sm font-bold tabular-nums text-[color:var(--ink)]">
              {dropoffs}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={mutate.isPending}
              onClick={() => mutate.mutate({ dropoffDelta: 1 })}
              aria-label={t("deskTrack.dropoff_plus", { defaultValue: "Increase count" })}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Input
            value={noteDraft}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (note !== null && noteDraft.trim() !== storedNote) {
                mutate.mutate({ dropoffNote: noteDraft.trim() || null });
              }
            }}
            placeholder={t("deskTrack.dropoff_note_placeholder", {
              defaultValue: "Staff note: e.g. went silent after L1 on C-2001",
            })}
            className="h-9 border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-sm"
          />
          {mutate.isPending ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : null}
        </div>
        {needsReview ? (
          <Alert className="mt-3 border-destructive/30">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span>
                {t("deskTrack.review_hint", {
                  defaultValue:
                    "{{count}} early L1 drop-offs — set the REVIEW flag and keep this tutor on easier cases until one completes cleanly.",
                  count: dropoffs,
                })}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-destructive/40 text-destructive"
                disabled={reviewFlag.isPending}
                onClick={() => reviewFlag.mutate()}
              >
                {t("deskTrack.review_action", { defaultValue: "Set REVIEW flag" })}
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
      </div>
    </div>
  );
}
