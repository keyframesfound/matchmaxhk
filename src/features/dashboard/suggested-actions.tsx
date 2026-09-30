import { type ComponentType, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
/** Issue #147: tag colors — border-delineated, no shadows (design rule). */
export type SuggestedActionTagColor = "blue" | "green" | "gray";

const TAG_STYLES: Record<SuggestedActionTagColor, string> = {
  blue: "bg-[color:var(--brand-link)]/10 text-[color:var(--brand-link)]",
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  gray: "bg-[color:var(--ink)]/[0.06] text-[color:var(--ink)]/70",
};

export type SuggestedActionCardProps = {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  tagKey: string;
  tagColor: SuggestedActionTagColor;
  headlineKey: string;
  descriptionKey: string;
  /** In-app route for the primary link (used when `primaryHref` is absent). */
  primaryTo?: string;
  primaryHref?: string;
  /** Typed-router search params for the primary link (e.g. `{ post: true }`). */
  primarySearch?: Record<string, unknown>;
  primaryLabelKey: string;
  secondaryTo?: string;
  secondaryHref?: string;
  secondaryLabelKey?: string;
  className?: string;
};

function ActionLink({
  to,
  href,
  search,
  labelKey,
  primary,
}: {
  to?: string;
  href?: string;
  search?: Record<string, unknown>;
  labelKey: string;
  primary: boolean;
}) {
  const { t } = useTranslation();
  const className = cn(
    "inline-flex items-center gap-0.5 text-sm font-bold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/40",
    primary ? "text-[color:var(--brand-link)]" : "text-[color:var(--ink)]/70",
  );
  const label = t(labelKey);
  if (to) {
    return (
      <Link to={to} search={search} className={className}>
        {label}
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {label}
      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}

/**
 * Issue #147: "Suggested Actions" dashboard card — top tag, headline,
 * description, primary/secondary links. Flat and border-delineated per the
 * design conventions (no shadows).
 */
export function SuggestedActionCard({
  icon: Icon,
  tagKey,
  tagColor,
  headlineKey,
  descriptionKey,
  primaryTo,
  primaryHref,
  primarySearch,
  primaryLabelKey,
  secondaryTo,
  secondaryHref,
  secondaryLabelKey,
  className,
}: SuggestedActionCardProps) {
  const { t } = useTranslation();
  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-[var(--radius-panel)] border border-border bg-card p-5 transition-colors hover:border-[color:var(--foreground)]/25",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex w-fit items-center rounded-md px-2 py-1 text-[11px] font-bold tracking-wide uppercase",
          TAG_STYLES[tagColor],
        )}
      >
        {t(tagKey)}
      </span>
      <h3 className="mt-3 text-base font-bold tracking-tight text-[color:var(--ink)]">
        {t(headlineKey)}
      </h3>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
        {t(descriptionKey)}
      </p>
      <div className="mt-4 flex flex-col gap-1.5">
        <ActionLink
          to={primaryTo}
          href={primaryHref}
          search={primarySearch}
          labelKey={primaryLabelKey}
          primary
        />
        {secondaryLabelKey ? (
          <ActionLink
            to={secondaryTo}
            href={secondaryHref}
            labelKey={secondaryLabelKey}
            primary={false}
          />
        ) : null}
      </div>
    </article>
  );
}

/** Responsive grid wrapper for a set of suggested-action cards. */
export function SuggestedActionGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
