import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import type { ChildProfile, LearnerFilter } from "@/features/children/children";

type LearnerPillsProps = {
  learners: readonly ChildProfile[];
  value: LearnerFilter;
  onChange: (next: LearnerFilter) => void;
};

/**
 * Issue #459 §C: "Who is learning?" — [All] [Myself] [Anson] … filters the
 * Registered lessons list. Hidden until the first child exists, so a pure
 * student never sees it.
 */
export function LearnerPills({ learners, value, onChange }: LearnerPillsProps) {
  const { t } = useTranslation();
  if (learners.length === 0) return null;

  const options: { value: LearnerFilter; label: string }[] = [
    { value: "all", label: t("children.pills.all") },
    { value: "myself", label: t("children.pills.myself") },
    ...learners.map((child) => ({ value: child.id, label: child.nickname })),
  ];

  return (
    <div
      role="radiogroup"
      aria-label={t("children.pills.label")}
      className="flex flex-wrap items-center gap-2"
    >
      <span className="text-sm font-medium text-muted-foreground">{t("children.pills.label")}</span>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-8 items-center rounded-full border px-3 text-sm font-semibold transition-colors",
              selected
                ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-[color:var(--surface)]"
                : "border-border bg-card text-[color:var(--ink)] hover:bg-muted",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
