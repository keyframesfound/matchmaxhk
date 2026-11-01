import { useTranslation } from "react-i18next";

/**
 * #573 Part 3: the Notes & Study Materials Marketplace Terms (Option A).
 * Rendered by /legal/notes-terms once NOTES_OPTION_A_LIVE is on, and on
 * ?preview=option-a before launch so staff and counsel can proof-read the
 * live layout. Copy lives in legal.notes_marketplace.* (en / zh-HK; zh-CN
 * is generated).
 */

const CLAUSES = [
  { id: "s1", paras: ["p1", "p2", "p3"] },
  { id: "s2", paras: ["p1", "p2", "p3", "p4"] },
  { id: "s3", paras: ["p1", "p2", "p3"] },
  { id: "s4", paras: ["p1", "p2"] },
  { id: "s5", paras: ["p1", "p2", "p3", "p4", "p5", "p6"] },
] as const;

export function NotesMarketplaceTerms({ preview }: { preview: boolean }) {
  const { t } = useTranslation();
  return (
    <div>
      {preview ? (
        <p className="mb-6 rounded-xl border border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/5 p-4 text-sm">
          {t("legal.notes_marketplace.preview_banner")}
        </p>
      ) : null}
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        {t("legal.notes_marketplace.title")}
      </h1>
      <p className="mt-3 text-sm text-[color:var(--ink)]/60">
        {t("legal.notes_marketplace.updated")}
      </p>
      <div className="mt-8">
        {CLAUSES.map((clause) => (
          <section
            key={clause.id}
            id={`notes-terms-${clause.id}`}
            className="scroll-mt-24 border-t border-[color:var(--ink)]/10 py-7"
          >
            <h2 className="text-xl font-bold tracking-tight">
              {t(`legal.notes_marketplace.${clause.id}_title`)}
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-7 text-[color:var(--ink)]/75">
              {clause.paras.map((para) => (
                <p key={para}>{t(`legal.notes_marketplace.${clause.id}_${para}`)}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
