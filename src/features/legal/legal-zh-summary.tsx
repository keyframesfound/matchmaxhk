import { Languages } from "lucide-react";

/**
 * #783 AC-544-2 / AC-COOKIE-2: the legal pages are written in English only, so
 * the Chinese routes carry a 繁中 summary above the English body instead of a
 * second, separately-maintained translation. The summary names the binding
 * language explicitly: a summary that reads like a full translation is worse
 * than none, because a reader would stop looking for the operative text.
 */
export type ZhLegalItem = { heading: string; body: string };

export function LegalZhSummary({
  title,
  notice,
  items,
}: {
  title: string;
  notice: string;
  items: readonly ZhLegalItem[];
}) {
  return (
    <section
      aria-labelledby="zh-summary-title"
      className="mb-12 rounded-[var(--radius-panel)] border border-border bg-card p-6 sm:p-8"
    >
      <h2
        id="zh-summary-title"
        className="flex items-center gap-2 text-xl font-bold text-foreground sm:text-2xl"
      >
        <Languages className="h-5 w-5" aria-hidden />
        {title}
      </h2>
      <p className="mt-3 border-l-2 border-[color:var(--brand-link)] pl-3 text-sm leading-6 text-muted-foreground">
        {notice}
      </p>
      <dl className="mt-6 space-y-5">
        {items.map((item) => (
          <div key={item.heading}>
            <dt className="text-sm font-semibold text-foreground">{item.heading}</dt>
            <dd className="mt-1 text-sm leading-6 text-muted-foreground">{item.body}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
