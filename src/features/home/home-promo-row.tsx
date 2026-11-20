import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

/**
 * #620 CEO lock (2026-11-03/04): ONE compact mid-feed row of three equal CTA
 * cards (Airbnb Hotels pattern), L→R Referral (15% cash) · Impact · Upload.
 * Same chrome and height for all three, short copy only, and all three fit
 * on one phone screen (no sideways scroll). Kept low so the next tutor row
 * stays visible below it.
 *
 * #793 §2.3 deltas on top of the first pass: headline + CTA copy is the
 * issue's verbatim EN/繁中 lock table; grey CTA pills go to ~44px (h-11)
 * on Phone and Mac; card padding and icon size enlarge; icons are the
 * CEO-checked assets from docs/refs/promo-icons/ (gift / hand+book /
 * doc+up-arrow — never a rocket for referral), served from /public with a
 * recolored navy→white variant for dark mode (duotone assets, so a CSS
 * invert would mangle the cyan). The Pro-bono card keeps the interim
 * /guide#impact deep-link until #400 ships /impact.
 */
type PromoCard = {
  key: string;
  icon: string;
  iconDark: string;
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
      icon: "/promo-referral-gift.png",
      iconDark: "/promo-referral-gift-dark.png",
      title: t("home_promo.referral_title"),
      cta: t("home_promo.referral_cta"),
      to: "/guide/refer",
    },
    {
      key: "impact",
      icon: "/promo-impact.png",
      iconDark: "/promo-impact-dark.png",
      title: t("home_promo.impact_title"),
      cta: t("home_promo.impact_cta"),
      // The public /impact page waits for the first NGO partner (#400);
      // until then "Learn how" lands on the guide's interim Impact anchor.
      to: "/guide",
      hash: "impact",
    },
    {
      key: "upload",
      icon: "/promo-upload.png",
      iconDark: "/promo-upload-dark.png",
      title: t("home_promo.upload_title"),
      cta: t("home_promo.upload_cta"),
      to: "/account/notes/new",
    },
  ];

  return (
    <section aria-label={t("home_promo.aria")} className="mx-auto max-w-[1536px]">
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {cards.map(({ key, icon, iconDark, title, cta, to, hash }) => (
          <Link
            key={key}
            to={to}
            hash={hash}
            className="mm-promo-card group flex min-w-0 flex-col items-start gap-2.5 rounded-[var(--radius-panel)] p-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)] sm:flex-row sm:items-center sm:gap-4 sm:p-5"
          >
            <img
              src={iconDark}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="hidden h-10 w-10 shrink-0 object-contain dark:block"
            />
            <img
              src={icon}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="h-10 w-10 shrink-0 object-contain dark:hidden"
            />
            <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-[color:var(--ink)] sm:text-base">
              {title}
            </span>
            {/* #668: grey pill on the white card, per the Airbnb Hotels SoT — the CTA rides the whole
                card link, so this is a styled span, not a nested button.
                #793 §2.3: ≥ ~44px tap on Phone and Mac (h-11). Mobile:
                full-width centred pill; the locked CTAs are short enough
                that they never wrap inside a ~111px card. */}
            <span className="mm-promo-cta inline-flex h-11 w-full shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3 text-sm font-semibold text-[color:var(--ink)] sm:h-11 sm:w-auto sm:px-5 sm:text-sm">
              {cta}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
