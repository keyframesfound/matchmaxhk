/**
 * #503 carousel-like review steps: the shared stepper header for the rating /
 * comment card flow. Same anatomy as the live case-request stepper (markers +
 * connectors, aria-current on the active step, completed steps clickable
 * back), so the rating prompt reads as the SAME flow pattern parents already
 * know — not a buried settings form.
 */

import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

export function ReviewStepHeader({
  labels,
  step,
  onStepClick,
}: {
  labels: string[];
  step: number;
  onStepClick: (step: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <ol className="mb-5 flex items-center gap-2 sm:gap-3" aria-label={t("sor.review_steps_aria")}>
      {labels.map((label, index) => {
        const stepNumber = index + 1;
        const isComplete = stepNumber < step;
        const isCurrent = stepNumber === step;
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <button
              type="button"
              disabled={stepNumber >= step}
              onClick={() => onStepClick(stepNumber)}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-colors",
                isComplete &&
                  "cursor-pointer border-[color:var(--ink)] bg-[color:var(--ink)] text-white",
                isCurrent &&
                  "border-[color:var(--ink)] bg-[color:var(--ink)]/[0.06] text-[color:var(--ink)]",
                !isComplete && !isCurrent && "border-border text-muted-foreground",
              )}
              aria-current={isCurrent ? "step" : undefined}
            >
              {isComplete ? <Check className="h-4 w-4" aria-hidden="true" /> : stepNumber}
            </button>
            <span
              className={cn(
                "truncate text-xs font-bold sm:text-sm",
                isCurrent || isComplete ? "text-[color:var(--ink)]" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
            {stepNumber < labels.length ? (
              <span
                className={cn(
                  "h-px flex-1",
                  stepNumber < step ? "bg-[color:var(--ink)]" : "bg-border",
                )}
                aria-hidden="true"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
