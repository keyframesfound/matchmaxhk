import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { setCookieConsent, useCookieConsent } from "@/features/legal/cookie-consent";

/**
 * #783 §2.2: first-visit cookie choice. Non-blocking (browsing continues
 * underneath), Essential only is the default until the visitor chooses,
 * and the choice can be changed later from Privacy → Cookies.
 */
export function CookieConsentBanner() {
  const { t } = useTranslation();
  const consent = useCookieConsent();
  // undefined = server / first paint; a stored choice = nothing to ask.
  if (consent !== null) return null;

  return (
    <div
      role="region"
      aria-label={t("cookie_consent.title")}
      className="mm-overlay-lift fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 rounded-[var(--radius-panel)] border border-border bg-card p-4 sm:inset-x-auto sm:right-4 sm:max-w-md lg:bottom-4"
    >
      <p className="text-sm font-bold text-[color:var(--ink)]">{t("cookie_consent.title")}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {t("cookie_consent.body")}{" "}
        <Link
          to="/privacy-policy"
          hash="cookies"
          className="font-semibold text-[color:var(--brand-link)] underline underline-offset-4"
        >
          {t("cookie_consent.learn_more")}
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10 flex-1 rounded-full font-bold"
          onClick={() => setCookieConsent("essential")}
        >
          {t("cookie_consent.essential")}
        </Button>
        <Button
          type="button"
          variant="solid"
          color="blue"
          className="h-10 flex-1 rounded-full font-bold"
          onClick={() => setCookieConsent("all")}
        >
          {t("cookie_consent.accept_all")}
        </Button>
      </div>
    </div>
  );
}

/** #783: Privacy → Cookies panel: current choice + change it. */
export function CookieSettingsPanel() {
  const { t } = useTranslation();
  const consent = useCookieConsent();
  const current =
    consent === "all"
      ? t("cookie_consent.current_all")
      : consent === "essential"
        ? t("cookie_consent.current_essential")
        : t("cookie_consent.current_none");
  return (
    <div className="rounded-[var(--radius-panel)] border border-border bg-card p-4 not-prose">
      <p className="text-sm font-bold text-[color:var(--ink)]">
        {t("cookie_consent.settings_title")}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{t("cookie_consent.settings_body")}</p>
      <p className="mt-2 text-sm text-[color:var(--ink)]">{current}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-full font-bold"
          aria-pressed={consent === "essential"}
          onClick={() => setCookieConsent("essential")}
        >
          {t("cookie_consent.essential")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-full font-bold"
          aria-pressed={consent === "all"}
          onClick={() => setCookieConsent("all")}
        >
          {t("cookie_consent.accept_all")}
        </Button>
      </div>
    </div>
  );
}
