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
import { AuthProvider } from "@/features/auth/useAuth";
import { ThemeProvider } from "@/features/theme/ThemeProvider";

import { BackToTopButton } from "@/components/layout/BackToTopButton";
import { WhatsAppFloatButton } from "@/components/layout/WhatsAppFloatButton";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-brand-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-[color:var(--surface-invert)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[color:var(--surface-invert-hover)]"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="max-w-lg text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        {error?.message ? (
          <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-left font-mono text-xs text-destructive break-words">
            <span className="font-semibold">Error:</span> {error.message}
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-[color:var(--surface-invert)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[color:var(--surface-invert-hover)]"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MatchMax | Verified Tutors in Hong Kong" },
      {
        name: "description",
        content:
          "MatchMax helps Hong Kong families find verified tutors for IB, DSE, IGCSE, AP, A-Level and other subjects with fast, flexible matching.",
      },
      { name: "author", content: "MatchMax" },
      { property: "og:site_name", content: "MatchMax" },
      { property: "og:title", content: "MatchMax | Verified Tutors in Hong Kong" },
      {
        property: "og:description",
        content:
          "MatchMax helps Hong Kong families find verified tutors for IB, DSE, IGCSE, AP, A-Level and other subjects with fast, flexible matching.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MatchMax" },
      {
        name: "twitter:description",
        content:
          "MatchMax connects Hong Kong parents and students with verified DSE, IB, IGCSE, and AP tutors — matched instantly.",
      },
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
            "Hong Kong tutoring marketplace matching parents and students with verified DSE, IB, IGCSE, and AP tutors.",
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
            target: "https://matchmax.hk/tutors?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }),
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const themeInitScript = `(function(){try{var t=localStorage.getItem('matchmax-theme')||'light';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[color:var(--surface)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[color:var(--ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--brand-teal)]"
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

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <ThemeProvider>
            <main id="main-content">
              <Outlet />
            </main>
            <BackToTopButton />
            <WhatsAppFloatButton />
            <Toaster richColors position="top-center" closeButton />
          </ThemeProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
