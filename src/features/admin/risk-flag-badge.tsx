/**
 * Issue #441 — the one risk-flag badge used on the case desk lists, the case
 * detail header and the tutor admin list/editor. REVIEW = warning style,
 * BLOCKED = destructive style with a stop marker; NONE renders nothing.
 * lucide icons (never emoji-only); the staff risk_note rides on the tooltip.
 */
import { Ban, Flag } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import {
  RISK_FLAG_BADGE_CLASS,
  RISK_FLAG_LABEL_KEYS,
  RISK_FLAG_LABELS,
  normalizeRiskFlag,
  type RiskFlag,
} from "@/features/admin/risk-flags";

export function RiskFlagBadge({
  flag,
  note,
  className,
}: {
  flag: unknown;
  note?: string | null;
  className?: string;
}) {
  const { t } = useTranslation();
  const normalized = normalizeRiskFlag(flag);
  if (normalized === "NONE") return null;
  const isBlocked = normalized === "BLOCKED";
  const Icon = isBlocked ? Ban : Flag;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold",
        RISK_FLAG_BADGE_CLASS[normalized],
        className,
      )}
      title={
        note?.trim() ||
        (isBlocked
          ? t("risk.blocked_stop", { defaultValue: "Blocked: do not contact" })
          : undefined)
      }
    >
      <Icon className="h-3 w-3" aria-hidden />
      {t(RISK_FLAG_LABEL_KEYS[normalized], { defaultValue: RISK_FLAG_LABELS[normalized] })}
    </span>
  );
}
