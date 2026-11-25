/**
 * #794 §2.6 — the public Student progress section on /u/{handle}.
 *
 * Rendered from listPublicProgressCards alone: the server has already applied
 * consent, the tenure floor, the date windows, the two-point minimum and the
 * one-scale rule, and has already sorted newest-first. This component renders
 * the shape it is given and never re-sorts or re-derives a claim.
 *
 * It carries no student name, no initial, no school and no proof image,
 * because the shape it receives has no field for them.
 */

import { useTranslation } from "react-i18next";

import type { PublicProgressCard } from "@/features/cases/progress-evidence";
import { PROGRESS_DISCLAIMER } from "@/features/cases/progress-evidence";
import { scaleLabel, verificationLabel } from "@/features/cases/progress-labels";

/**
 * The optional one-line parent note is not part of the locked public shape
 * yet. Read it defensively so the section renders it when the server starts
 * returning one, and shows nothing when it does not.
 */
type PublicCardWithQuote = PublicProgressCard & { quote?: string | null };

function cardQuote(card: PublicCardWithQuote): string | null {
  const quote = card.quote?.trim();
  return quote ? quote : null;
}

export function PublicProgressSection({ cards }: { cards: PublicProgressCard[] }) {
  const { t } = useTranslation();
  if (cards.length === 0) return null;
  const withQuotes = cards as PublicCardWithQuote[];

  return (
    <section aria-labelledby="student-progress-heading" className="space-y-3">
      <div>
        <h2 id="student-progress-heading" className="text-lg font-bold text-[color:var(--ink)]">
          {t("progress_public.heading")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("progress_public.subtitle")}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {withQuotes.map((card) => {
          const quote = cardQuote(card);
          return (
            <li
              key={card.caseId}
              className="flex flex-col gap-2 rounded-[var(--radius-panel)] border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {scaleLabel(t, card.scale)}
                </span>
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {verificationLabel(t, card.verification)}
                </span>
              </div>
              <ol className="flex flex-wrap items-center gap-1.5" aria-label={card.delta}>
                {card.checkpoints.map((point, index) => (
                  <li
                    key={`${card.caseId}-${point.month}-${index}`}
                    className="flex items-center gap-1.5"
                  >
                    {index > 0 ? (
                      <span aria-hidden className="text-sm text-muted-foreground">
                        →
                      </span>
                    ) : null}
                    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-sm font-semibold text-[color:var(--ink)]">
                      {point.value}
                    </span>
                    <span className="sr-only">{point.month}</span>
                  </li>
                ))}
              </ol>
              {quote ? <p className="text-sm text-[color:var(--ink)]">"{quote}"</p> : null}
              <p className="text-xs text-muted-foreground">{card.summary}</p>
              <p className="mt-auto text-[11px] leading-relaxed text-muted-foreground">
                {PROGRESS_DISCLAIMER}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
