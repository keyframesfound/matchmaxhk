import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { getCaseNotesRail } from "@/features/cases/case-notes-rail.functions";
import { materialCoverUrl } from "@/features/materials/material-card";
import { formatMoney } from "@/lib/money";

/**
 * #796 §2.3 Recommended for this case. A read-only rail of peer practice
 * material seeded by the case's recent lesson topics. It lives under the
 * mastery heatmap inside the Case Workspace drawer, so the rows are compact
 * list items rather than browse cards.
 *
 * Purchase-and-view only: a row is one link to the note's detail page, with no
 * request, save or trial action. The case tutor's own material still needs no
 * request CTA, and peer material is bought from its own page, so the rail adds
 * no second interaction.
 *
 * The server returns `null` for the tutor side and for nothing-to-show; this
 * renders nothing in that case, while loading, and when the list is empty.
 */
export function NotesRail({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const headingId = useId();

  const { data } = useQuery({
    queryKey: ["case-notes-rail", caseId],
    queryFn: () => getCaseNotesRail({ data: { caseId } }),
  });

  if (!data || data.items.length === 0) return null;

  return (
    <section className="mt-4 space-y-2" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-sm font-semibold text-[color:var(--ink)]">
        {t("notes_rail.title")}
      </h2>
      <p className="text-xs text-muted-foreground">{t("notes_rail.hint")}</p>

      <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-panel)] border border-border">
        {data.items.map((item) => {
          const coverUrl = materialCoverUrl(item.coverPath);
          const price = item.priceHkd === 0 ? t("notes_rail.free") : formatMoney(item.priceHkd);

          return (
            <li key={item.id}>
              <Link
                to="/notes/$slug"
                params={{ slug: item.slug ?? item.id }}
                className="flex min-h-14 items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    decoding="async"
                    className="h-14 w-14 shrink-0 rounded-[var(--radius-control)] border border-border object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-border bg-muted text-muted-foreground"
                  >
                    <FileText className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                )}

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="line-clamp-2 min-w-0 text-sm font-medium text-[color:var(--ink)]">
                      {item.title}
                    </span>
                    {item.byYourTutor ? (
                      <span className="shrink-0 rounded-full border border-[color:var(--brand-link)]/40 px-2 py-0.5 text-[11px] font-medium text-[color:var(--ink)]">
                        {t("notes_rail.by_your_tutor")}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    <span className="truncate">{item.tutorDisplayName}</span>
                    <span aria-hidden>·</span>
                    <span className="font-medium">{price}</span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
