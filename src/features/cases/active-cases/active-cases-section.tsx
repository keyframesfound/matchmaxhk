import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ChevronDown, CircleDollarSign, Lock, MapPin, Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  getMyActiveCases,
  getPublicActiveCases,
  saveCasePrivacy,
  type ActiveCasesSubject,
} from "@/features/cases/active-cases/active-cases.functions";
import {
  DEFAULT_PARTY_VISIBILITY,
  type ActiveCaseCard,
  type PartyVisibility,
} from "@/features/cases/active-cases/active-cases";
import { CASE_MODE_LABEL, CASE_MODE_LABEL_ZH } from "@/features/cases/display";

const TOGGLES: { key: keyof PartyVisibility; label: string }[] = [
  { key: "show", label: "profile.active_cases.privacy_show" },
  { key: "maskRate", label: "profile.active_cases.privacy_mask_rate" },
  { key: "maskStudent", label: "profile.active_cases.privacy_mask_student" },
  { key: "maskDistrict", label: "profile.active_cases.privacy_mask_district" },
];

/** #635 Privacy sheet. Only ever changes the caller's own row. */
function PrivacyDialog({
  card,
  onClose,
  onSaved,
}: {
  card: ActiveCaseCard;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState<PartyVisibility>(card.privacy ?? DEFAULT_PARTY_VISIBILITY);
  const save = useMutation({
    mutationFn: () => saveCasePrivacy({ data: { caseId: card.caseId ?? "", ...values } }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>{t("profile.active_cases.privacy_title")}</DialogTitle>
        <DialogDescription>{t("profile.active_cases.privacy_helper")}</DialogDescription>
        <div className="space-y-3">
          {TOGGLES.map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between gap-3 text-sm">
              <span>{t(label)}</span>
              <Switch
                checked={values[key]}
                onCheckedChange={(checked) => setValues((prev) => ({ ...prev, [key]: checked }))}
              />
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
            {t("profile.active_cases.privacy_save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CaseCard({
  card,
  onPrivacy,
}: {
  card: ActiveCaseCard;
  onPrivacy?: (card: ActiveCaseCard) => void;
}) {
  const { t, i18n } = useTranslation();
  const modeLabels = i18n.language.startsWith("zh") ? CASE_MODE_LABEL_ZH : CASE_MODE_LABEL;
  const modeText = card.mode ? (modeLabels[card.mode] ?? card.mode) : "";
  const area = card.areaMasked ? t("profile.active_cases.region_masked") : card.area;
  const rate =
    card.rateHkd === null
      ? t("profile.active_cases.market_rate")
      : `HK$${card.rateHkd}/${card.rateUnit ?? "hr"}`;
  const party = card.counterparty;
  const partyLabel =
    party?.label ??
    (party?.kind === "tutor"
      ? t("profile.active_cases.verified_tutor")
      : t("profile.active_cases.verified_parent"));
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-[color:var(--ink)]">
          {t(`profile.active_cases.type_${card.caseType}`)}
        </span>
        {card.caseType === "centre" ? (
          <span className="rounded-full border border-purple-500/30 bg-purple-500/[0.06] px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:text-purple-400">
            {t("case_board.cap57_chip")}
          </span>
        ) : null}
        {card.hidden ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            <Lock className="h-3 w-3" aria-hidden="true" />
            {t("profile.active_cases.hidden_badge")}
          </span>
        ) : null}
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">{card.caseCode}</span>
      </div>
      <p className="truncate text-sm font-bold text-[color:var(--ink)]">
        {[card.examSystem, card.subject].filter(Boolean).join(" ")}
        {card.studentLevel ? ` · ${card.studentLevel}` : ""}
      </p>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{[area, modeText, rate].filter(Boolean).join(" · ")}</span>
      </p>
      <div className="mt-auto flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate text-muted-foreground">
          {card.studentName ? `${card.studentName} · ` : ""}
          {party?.href ? (
            <a
              href={party.href}
              className="font-medium text-[color:var(--brand-link)] hover:underline"
            >
              {partyLabel}
            </a>
          ) : (
            partyLabel
          )}
        </span>
        {card.partyView ? (
          <span className="inline-flex shrink-0 items-center gap-1 font-medium text-[color:var(--ink)]">
            <Link to="/calendar" search={{ case: card.caseCode }} className="hover:underline">
              {t("profile.active_cases.open_case")}
            </Link>
          </span>
        ) : onPrivacy ? (
          <button
            type="button"
            onClick={() => onPrivacy(card)}
            className="inline-flex shrink-0 items-center gap-1 font-medium text-[color:var(--ink)] hover:underline"
          >
            <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t("profile.active_cases.privacy_open")}
          </button>
        ) : null}
      </div>
      {/* #634 Tier 2 fee milestone: the MatchMax admin-fee state on a party
          view (tutor viewers only — parents never see the tutor-pays fee). */}
      {card.partyView && card.feeMilestone && card.feeMilestone !== "none" ? (
        <p className="flex items-center gap-1.5 text-xs">
          <CircleDollarSign
            className={`h-3.5 w-3.5 shrink-0 ${card.feeMilestone === "paid" ? "text-emerald-600" : "text-amber-600"}`}
            aria-hidden="true"
          />
          <span className="font-medium">{t(`profile.active_cases.fee_${card.feeMilestone}`)}</span>
        </p>
      ) : null}
    </li>
  );
}

/**
 * #633: the profile's Active Cases strip. A portfolio view only: operations live
 * in Case Manager (/calendar), which owners reach through the links here.
 */
export function ActiveCasesSection({
  subject,
  isOwner,
}: {
  subject: ActiveCasesSubject;
  isOwner: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ["active-cases", subject, isOwner];
  const { data } = useQuery({
    queryKey,
    queryFn: () =>
      isOwner ? getMyActiveCases({ data: subject }) : getPublicActiveCases({ data: subject }),
    staleTime: 60_000,
  });
  const [editing, setEditing] = useState<ActiveCaseCard | null>(null);
  if (!data) return null;
  const onPrivacy = isOwner ? setEditing : undefined;
  const publicCount = data.activeCount - data.hiddenCount;

  return (
    <section className="space-y-3" data-testid="active-cases">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold tracking-tight text-[color:var(--ink)]">
          {t("profile.active_cases.title")} · {data.activeCount}
        </h2>
        {data.recent45d ? (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            {t("profile.active_cases.recent_45d")}
          </span>
        ) : null}
        {isOwner ? (
          <Link
            to="/calendar"
            className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--ink)] hover:underline"
          >
            {t("profile.active_cases.manage_in_case_manager")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      {isOwner && data.activeCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("profile.active_cases.owner_banner", {
            shown: publicCount,
            hidden: data.hiddenCount,
          })}
        </p>
      ) : null}
      {data.active.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {data.active.map((card) => (
            <CaseCard key={card.caseCode} card={card} onPrivacy={onPrivacy} />
          ))}
        </ul>
      ) : data.activeCount === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          {isOwner ? t("profile.active_cases.owner_empty") : t("profile.active_cases.empty")}
        </p>
      ) : null}
      {data.pastCount > 0 ? (
        <details className="group rounded-2xl border border-border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-semibold text-[color:var(--ink)]">
            {t("profile.active_cases.past_title", { count: data.pastCount })}
            <ChevronDown
              className="h-4 w-4 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <ul className="grid grid-cols-1 gap-3 px-4 pb-4 lg:grid-cols-2">
            {data.past.map((card) => (
              <CaseCard key={card.caseCode} card={card} onPrivacy={onPrivacy} />
            ))}
          </ul>
        </details>
      ) : null}
      {editing ? (
        <PrivacyDialog
          card={editing}
          onClose={() => setEditing(null)}
          onSaved={() => void queryClient.invalidateQueries({ queryKey: ["active-cases"] })}
        />
      ) : null}
    </section>
  );
}
