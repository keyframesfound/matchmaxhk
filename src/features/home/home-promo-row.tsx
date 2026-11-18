import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

/**
 * #620 CEO lock (2026-11-03): replaces the sticky AnnouncementBanner with
 * ONE compact mid-feed row of three equal CTA cards (Airbnb Hotels
 * pattern), L→R Referral (15% cash) · Impact / students in need · Upload.
 * Same chrome and height for all three, short copy only, and all three fit
 * on one phone screen (no sideways scroll). Kept low so the next tutor row
 * stays visible below it. Layout (grid-cols-3, all-fit) is shipped — do not
 * rebuild it.
 *
 * #793 §2.3 (2026-11-04 copy + chrome lock): headlines/CTAs match the
 * ticket's verbatim EN/繁中 tables (never jargon "Pro-bono", never
 * notes-only); the grey CTA pills are ≥ ~44px tap on Phone and Mac; card
 * padding and icon sizes are enlarged; and the icons are the CEO-checked-in
 * promo artwork (gift / hand+book / doc+up-arrow, docs/refs/promo-icons,
 * downscaled into public/) instead of Lucide Rocket/Heart/FileUp. Impact
 * deep-links /guide#impact (interim anchor until PROFILE [was #400]
 * unholds /impact); Upload keeps the #784 live upload route.
 */
type PromoCard = {
  key: string;
  /** CEO promo artwork (public/ path), rendered with the nav-glyph invert. */
  icon: string;
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
      icon: "/promo-gift.png",
      title: t("home_promo.referral_title"),
      cta: t("home_promo.referral_cta"),
      to: "/guide/refer",
    },
    {
      key: "impact",
      icon: "/promo-impact.png",
      title: t("home_promo.impact_title"),
      cta: t("home_promo.impact_cta"),
      // The public /impact page waits for the first NGO partner ([was #400]);
      // until then "Learn how" lands on the guide's interim Impact anchor.
      to: "/guide",
      hash: "impact",
    },
    {
      key: "upload",
      icon: "/promo-upload.png",
      title: t("home_promo.upload_title"),
      cta: t("home_promo.upload_cta"),
      // Upload deep-link owned by #784; /account/notes/new is the live path.
      to: "/account/notes/new",
    },
  ];

  return (
    <section aria-label={t("home_promo.aria")} className="mx-auto max-w-[1536px]">
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {cards.map(({ key, icon, title, cta, to, hash }) => (
          <Link
            key={key}
            to={to}
            hash={hash}
            className="mm-promo-card group flex min-w-0 flex-col items-start gap-2.5 rounded-[var(--radius-panel)] p-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)] sm:flex-row sm:items-center sm:gap-4 sm:p-5"
          >
            <img
              src={icon}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="h-9 w-9 shrink-0 object-contain dark:invert-[0.85] dark:hue-rotate-180 sm:h-10 sm:w-10"
            />
            <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-[color:var(--ink)] sm:text-base">
              {title}
            </span>
            {/* #668: grey pill on the white card, per the Airbnb Hotels SoT —
                the CTA rides the whole card link, so this is a styled span,
                not a nested button.
                #793 §2.3: h-11 (44px) tap lock on Phone and Mac; the locked
                CTAs are short ("See how" / "Upload"), so text-xs fits a
                ~111px card full-width without wrapping. */}
            <span className="mm-promo-cta inline-flex h-11 w-full shrink-0 items-center justify-center whitespace-nowrap rounded-full px-2 text-xs font-semibold text-[color:var(--ink)] sm:h-11 sm:w-auto sm:px-5 sm:py-0 sm:text-sm">
              {cta}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
