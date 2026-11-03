import { Link } from "@tanstack/react-router";
import { FileUp, Heart, Rocket, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Issue #620: the Explore promo row — the Airbnb Hotels mid-feed pattern.
 * Exactly ONE row of THREE equal rounded CTA cards, L→R:
 *   Referral (15%) → /guide/refer · Pro-bono/Impact → /guide#impact ·
 *   Upload (doc + up-arrow) → the Marketplace upload entry /account/notes/new.
 *
 * Height discipline (CEO 2026-11-03): the row stays compact mid-height so
 * the next tutor listing row remains visible below — never a tall hero.
 * One responsive grid serves both locks: Mac (lg+) renders three equal
 * cards in a row; a 390px phone renders the same three compact cards
 * (icon + title + pill, no carousel, no horizontal scroll). Impact links
 * to the interim /guide#impact anchor until #400 ships /impact. Elevation
 * is hairline + surface only (no shadows); azure stays on money CTAs, so
 * the pills are grey.
 */

type PromoEntry = {
  to: "/guide/refer" | "/guide" | "/account/notes/new";
  hash?: string;
  icon: LucideIcon;
  headlineKey: string;
  ctaKey: string;
};

const PROMO_ENTRIES: PromoEntry[] = [
  {
    to: "/guide/refer",
    icon: Rocket,
    headlineKey: "promo.referral_headline",
    ctaKey: "promo.referral_cta",
  },
  {
    to: "/guide",
    hash: "impact",
    icon: Heart,
    headlineKey: "promo.impact_headline",
    ctaKey: "promo.impact_cta",
  },
  {
    to: "/account/notes/new",
    icon: FileUp,
    headlineKey: "promo.upload_headline",
    ctaKey: "promo.upload_cta",
  },
];

export function ExplorePromoRow() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-[1536px]">
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {PROMO_ENTRIES.map(({ to, hash, icon: Icon, headlineKey, ctaKey }) => (
          <Link
            key={headlineKey}
            to={to}
            hash={hash}
            className="group flex h-full flex-col items-start gap-1.5 rounded-[var(--radius-panel)] border border-border bg-card p-3 text-left transition-colors hover:border-[color:var(--foreground)]/25 hover:bg-[color:var(--surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)] sm:gap-2.5 sm:p-5"
          >
            <Icon
              className="h-5 w-5 shrink-0 text-[color:var(--brand-link)] sm:h-6 sm:w-6"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <h3 className="text-xs font-bold leading-snug text-[color:var(--ink)] sm:text-[15px] sm:leading-5">
              {t(headlineKey)}
            </h3>
            {/* Grey pill per the Airbnb Hotels SoT — the CTA rides the whole
                card link, so this is a styled span, not a nested button.
                Mobile: full-width centred pill, nowrap + 10.5px so
                "Refer a friend" still fits a ~111px card without wrapping. */}
            <span className="mt-auto inline-flex h-7 w-full items-center justify-center whitespace-nowrap rounded-full bg-[color:var(--foreground)]/[0.08] px-1.5 text-[10.5px] font-bold text-[color:var(--ink)] transition-colors group-hover:bg-[color:var(--foreground)]/[0.12] sm:h-8 sm:w-auto sm:justify-start sm:px-4 sm:text-[13px]">
              {t(ctaKey)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
