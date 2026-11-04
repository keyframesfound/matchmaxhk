import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { FileUp, Heart, Rocket, type LucideIcon } from "lucide-react";

/**
 * #620 CEO lock (2026-11-03): replaces the sticky AnnouncementBanner with
 * ONE compact mid-feed row of three equal CTA cards (Airbnb Hotels
 * pattern), L→R Referral (15%) · Pro-bono / Impact · Upload. Same chrome
 * and height for all three, short copy only, and all three fit on one
 * phone screen (no sideways scroll). Kept low so the next tutor row stays
 * visible below it.
 *
 * #620 acceptance deltas on top of the first pass: headline + CTA copy is
 * the issue's verbatim EN/繁中 tables; the Pro-bono card deep-links
 * /guide#impact (interim anchor on the guide Why-us section until #400
 * ships /impact); wireframe icons 🚀/💙/📄↑; mobile pills go full-width
 * single-line so "Refer a friend" never wraps inside a ~111px card.
 */
type PromoCard = {
  key: string;
  icon: LucideIcon;
  title: string;
  cta: string;
  to: "/guide/refer" | "/guide" | "/account/notes/new";
  hash?: "impact";
};

export function HomePromoRow() {
  const { t } = useTranslation();
  const cards: PromoCard[] = [
    {
      key: "referral",
      icon: Rocket,
      title: t("home_promo.referral_title"),
      cta: t("home_promo.referral_cta"),
      to: "/guide/refer",
    },
    {
      key: "impact",
      icon: Heart,
      title: t("home_promo.impact_title"),
      cta: t("home_promo.impact_cta"),
      // The public /impact page waits for the first NGO partner (#400);
      // until then "Learn how" lands on the guide's interim Impact anchor.
      to: "/guide",
      hash: "impact",
    },
    {
      key: "upload",
      icon: FileUp,
      title: t("home_promo.upload_title"),
      cta: t("home_promo.upload_cta"),
      to: "/account/notes/new",
    },
  ];

  return (
    <section aria-label={t("home_promo.aria")} className="mx-auto max-w-[1536px]">
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {cards.map(({ key, icon: Icon, title, cta, to, hash }) => (
          <Link
            key={key}
            to={to}
            hash={hash}
            className="group flex min-w-0 flex-col items-start gap-2 rounded-[var(--radius-panel)] border border-border bg-[color:var(--surface-subtle)] p-3 transition-colors hover:bg-[color:var(--surface-subtle)]/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)] sm:flex-row sm:items-center sm:gap-4 sm:p-5"
          >
            <Icon
              className="h-6 w-6 shrink-0 text-[color:var(--brand-link)] sm:h-8 sm:w-8"
              strokeWidth={1.75}
              aria-hidden
            />
            <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-[color:var(--ink)] sm:text-base">
              {title}
            </span>
            {/* Grey pill per the Airbnb Hotels SoT — the CTA rides the whole
                card link, so this is a styled span, not a nested button.
                Mobile: full-width centred pill, nowrap + 10.5px so
                "Refer a friend" fits a ~111px card without wrapping. */}
            <span className="inline-flex h-7 w-full shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[color:var(--background)] px-1.5 text-[10.5px] font-semibold text-[color:var(--ink)] sm:h-8 sm:w-auto sm:px-4 sm:py-0 sm:text-sm">
              {cta}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
