import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import appCss from "../styles.css?url";
import { I18nProvider } from "@/features/i18n/I18nProvider";
import { ProfileLocaleSync } from "@/features/i18n/ProfileLocaleSync";
import { AuthProvider } from "@/features/auth/useAuth";
import { OnboardingGate } from "@/features/auth/OnboardingGate";
import { CommunityCommitmentGate } from "@/features/auth/CommunityCommitmentGate";
import { AccountStatusBanners } from "@/features/auth/AccountStatusBanners";
import { ThemeProvider } from "@/features/theme/ThemeProvider";
import { DisplayCurrencyProvider } from "@/features/currency/display-currency-context";

import { CookieConsentBanner } from "@/components/layout/CookieConsentBanner";
import { BackToTopButton } from "@/components/layout/BackToTopButton";
import { LocaleSuggestionBanner } from "@/components/layout/LocaleSuggestionBanner";
import { ReferralCapture } from "@/components/layout/ReferralCapture";
import { WhatsAppFloatButton } from "@/components/layout/WhatsAppFloatButton";
import { CompareSelectionReset } from "@/features/cases/compare-cases";
import { Toaster } from "@/components/ui/sonner";
import { currentSeoLocale, localizedMeta, ogLocaleMeta, canonicalUrl } from "@/features/i18n/seo";
import { getActiveUrlLocale, stripLocalePrefix } from "@/features/i18n/routing";
import { applyUrlLocale, persistUrlLocaleChoice } from "@/features/i18n/config";
import { useTranslation } from "react-i18next";

export function NotFoundComponent() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-brand-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("page_not_found.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("page_not_found.body")}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-[color:var(--foreground)]/15 bg-[color:var(--surface)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--muted)]"
          >
            {t("page_not_found.go_home")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const { t } = useTranslation();
  // A route chunk that 404s after a deploy ("Failed to fetch dynamically
  // imported module") can only be fixed by reloading the document; router
  // invalidate would re-request the same missing chunk. Same for a network
  // failure on a server function.
  const needsReload =
    /dynamically imported module|Importing a module script failed|ChunkLoadError|Failed to fetch|Load failed|NetworkError|MIME type of "text\/html"|Unexpected token '<'/i.test(
      error?.message ?? "",
    );

  useEffect(() => {
    console.error(error);
    // Report the failure once per mount so a support report carries the real
    // message instead of "Oops". Fire and forget: the page must not depend on
    // the write succeeding.
    void import("@/features/diagnostics/error-logs.functions")
      .then(({ reportClientError }) =>
        reportClientError({
          data: {
            url: typeof window === "undefined" ? "" : window.location.href,
            message: error?.message ?? String(error),
            stack: error?.stack?.slice(0, 8000),
            userAgent:
              typeof navigator === "undefined" ? undefined : navigator.userAgent.slice(0, 500),
          },
        }),
      )
      .catch(() => undefined);
    if (!needsReload) return;
    // Heal a stale-chunk tab automatically, once. The timestamp guard stops a
    // reload loop when the failure is not a stale asset after all.
    const key = "matchmax.chunk-reload-at";
    try {
      const last = Number(sessionStorage.getItem(key) ?? 0);
      if (Number.isFinite(last) && Date.now() - last < 30_000) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      return;
    }
    window.location.reload();
  }, [error, needsReload]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="max-w-lg text-center">
        <h1 className="text-7xl font-bold text-brand-gradient">Oops</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("page_error.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("page_error.body")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              if (needsReload) {
                window.location.reload();
                return;
              }
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md border border-[color:var(--foreground)]/15 bg-[color:var(--surface)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--muted)]"
          >
            {needsReload ? t("page_error.reload") : t("page_error.try_again")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("page_error.go_home")}
          </a>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">{t("page_error.help")}</p>
        {/* Support detail: the first line of the failure, so a report is
            actionable instead of just "Oops". Never a full stack. */}
        {error?.message ? (
          <p className="mt-3 break-words rounded-md border border-border bg-[color:var(--muted)] px-3 py-2 text-left text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold">Error: </span>
            {error.message.split("\n")[0].slice(0, 240)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: () => {
    // URL is the source of truth for language (2026-10-25 locale prefixes):
    // keep the i18n instance in step on every request/navigation, and adopt
    // a differing URL locale as the visitor's saved choice (client only) so
    // the next plain visit to / opens in it.
    const locale = getActiveUrlLocale();
    applyUrlLocale(locale);
    persistUrlLocaleChoice(locale);
  },
  head: ({ matches }) => {
    // Issue #401: the root fallback title/description follow the active
    // locale; routes with their own head() override these. English copy is
    // main's post-#407 scrub ("elite", no Verified claims).
    const locale = currentSeoLocale();
    // SEO fix: og:url used to be hardcoded to the homepage, so every route
    // without its own og:url advertised "/" as the shared URL. Derive it from
    // the page actually rendered — the deepest match's pathname is already
    // locale-stripped by the router's rewrite, and canonicalUrl re-prefixes
    // the active segment. Routes that set their own og:url still win.
    const activePath = stripLocalePrefix(matches[matches.length - 1]?.pathname ?? "/");
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        ...localizedMeta(locale, {
          title: {
            en: "MatchMax | Elite Tutors in Hong Kong",
            "zh-HK": "MatchMax | 香港精英導師平台",
            "zh-CN": "MatchMax | 香港精英家教平台",
          },
          description: {
            en: "MatchMax helps Hong Kong families find elite tutors for IB, DSE, IGCSE, AP, A-Level and other subjects with fast, flexible matching.",
            "zh-HK":
              "MatchMax 幫香港家庭搵到精英 IB、DSE、IGCSE、AP、A-Level 等科目導師，配對快而靈活。",
            "zh-CN":
              "MatchMax 帮助香港家庭找到 IB、DSE、IGCSE、AP、A-Level 等科目的精英家教，配对快速又灵活。",
          },
        }),
        { name: "author", content: "MatchMax" },
        { property: "og:site_name", content: "MatchMax" },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonicalUrl(activePath, locale) },
        ...ogLocaleMeta(locale),
        { property: "og:image", content: "https://matchmax.hk/matchmax-logo.png" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: "https://matchmax.hk/matchmax-logo.png" },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
        { rel: "shortcut icon", href: "/favicon.ico" },
        { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
        { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
        { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
        { rel: "manifest", href: "/site.webmanifest" },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "MatchMax",
            url: "https://matchmax.hk",
            logo: "https://matchmax.hk/matchmax-logo.png",
            description:
              "Hong Kong tutoring marketplace matching parents and students with DSE, IB, IGCSE, and AP tutors.",
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "MatchMax",
            url: "https://matchmax.hk",
            potentialAction: {
              "@type": "SearchAction",
              target: `${canonicalUrl("/tutors")}?q={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          }),
        },
      ],
    };
  },

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const themeInitScript = `(function(){try{var t=localStorage.getItem('matchmax-theme')||'light';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

function RootShell({ children }: { children: ReactNode }) {
  // Follows the URL locale (set by the router's rewrite input) so SSR emits
  // the right lang for /zh pages; HtmlLangSync keeps it in step client-side.
  const locale = getActiveUrlLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <HeadContent />
        <meta name="theme-color" content="#ffffff" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[color:var(--surface)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[color:var(--ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
        >
          Skip to main content
        </a>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Window-level error listeners: the router boundary never sees a rejection
  // inside a background query, timer or event handler.
  useEffect(() => {
    void import("@/features/diagnostics/error-listener").then(({ installErrorListeners }) =>
      installErrorListeners(),
    );
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <ProfileLocaleSync />
          <ReferralCapture />
          <DisplayCurrencyProvider>
            <ThemeProvider>
              <LocaleSuggestionBanner />
              <AccountStatusBanners />
              <OnboardingGate>
                <CommunityCommitmentGate>
                  <main id="main-content">
                    <Outlet />
                  </main>
                  <BackToTopButton />
                  <WhatsAppFloatButton />
                  <CompareSelectionReset />
                </CommunityCommitmentGate>
              </OnboardingGate>
              {/* #783 §2.2: first-visit cookie choice (non-blocking). */}
              <CookieConsentBanner />
              <Toaster />
            </ThemeProvider>
          </DisplayCurrencyProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
