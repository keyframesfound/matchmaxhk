import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { cn } from "@/lib/utils";
import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";

/**
 * Issue #208: shared shell for the guide hub. The sticky bar sits under the
 * site header; the labels scroll sideways on mobile while the page itself
 * never does (overflow-x is scoped to the bar's list).
 */

export const GUIDE_TABS = [
  { to: "/guide", key: "guide.tab_why" },
  { to: "/guide/parents", key: "guide.tab_parents" },
  { to: "/guide/tutors", key: "guide.tab_tutors" },
  { to: "/guide/notes", key: "guide.tab_notes" },
  { to: "/guide/refer", key: "guide.tab_refer" },
  { to: "/guide/verification", key: "guide.tab_verification" },
  // Issue #412 G: the B2B tab ships with the partners page but stays hidden
  // until the centre market flag flips, the join CTA would 404 otherwise.
  { to: "/guide/partners", key: "guide.tab_partners", enabled: CENTRE_MARKET_ENABLED },
] as const;

export type GuideTab = (typeof GUIDE_TABS)[number]["to"];

export function GuideBar({ current, topOffset }: { current: GuideTab; topOffset: number }) {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t("guide.aria_label")}
      className="sticky z-40 border-b border-[color:var(--ink)]/10 bg-[color:var(--surface)]/95 backdrop-blur-sm"
      style={{ top: topOffset }}
    >
      <div className="mx-auto max-w-[1600px] px-5 sm:px-8 lg:px-12">
        <ul className="flex items-center gap-1 overflow-x-auto whitespace-nowrap py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {GUIDE_TABS.map((tab) => {
            if ("enabled" in tab && !tab.enabled) return null;
            const active = tab.to === current;
            return (
              <li key={tab.to}>
                <Link
                  to={tab.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
                      : "text-muted-foreground hover:bg-[color:var(--foreground)]/[0.06] hover:text-[color:var(--ink)]",
                  )}
                >
                  {t(tab.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

/** In-page contents row: three to five anchors that scroll to headings. */
export function ContentsRow({ items }: { items: { id: string; label: string }[] }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-[1600px] px-5 sm:px-8 lg:px-12">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[color:var(--ink)]/10 py-4 text-sm">
        <span className="text-xs font-medium text-[color:var(--muted-foreground)]">
          {t("guide.on_this_page")}
        </span>
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-[color:var(--ink)] hover:underline"
          >
            {item.label}
          </a>
        ))}
      </div>
    </div>
  );
}

/** Numbered step rows in the guide's flat, border-only visual language. */
export function GuideSteps({ steps }: { steps: [string, string, string][] }) {
  return (
    <ol className="border-t border-[color:var(--ink)]/15">
      {steps.map(([number, title, text]) => (
        <li
          key={number}
          className="grid grid-cols-[3rem_minmax(0,1fr)] gap-5 border-b border-[color:var(--ink)]/15 py-6 sm:gap-8 sm:py-7"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--foreground)]/[0.06] text-sm font-medium">
            {number}
          </span>
          <div>
            <h3 className="text-lg font-medium tracking-tight sm:text-xl">{title}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">{text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Numbered [marker, text] rows for rules/exclusions lists (no titles). */
export function GuideRules({ items }: { items: [string, string][] }) {
  return (
    <ul className="space-y-3">
      {items.map(([marker, text]) => (
        <li key={marker} className="flex gap-3 text-sm leading-7 text-[color:var(--ink)]/80">
          <span aria-hidden="true" className="font-medium text-[color:var(--brand-link)]">
            {marker}
          </span>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Section heading used by every guide block. */
export function GuideHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-3xl font-medium leading-[1.05] tracking-tight sm:text-4xl">{children}</h2>
  );
}

export function GuidePage({ current, children }: { current: GuideTab; children: ReactNode }) {
  const { hash } = useLocation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Blocker 1 of the AI review: the bar must offset below the full sticky
  // chrome, not a hardcoded header height, the desktop header is 72px PLUS
  // the announcement banner while it is undismissed, and the mobile header
  // is 56px. Measure the header's live height so the bar never hides under
  // it (or under a banner that appears later in the session).
  const [topOffset, setTopOffset] = useState(0);
  useEffect(() => {
    function measure() {
      const header = document.querySelector<HTMLElement>("[data-site-header]");
      // Mobile header renders as a sticky div (SiteHeader renders one header
      // per breakpoint, desktop <header> with data-site-header, mobile <div>).
      const mobileHeader = header ?? document.querySelector<HTMLElement>("div.sticky.top-0.z-50");
      setTopOffset((mobileHeader ?? header)?.offsetHeight ?? 0);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // SPA loads render after the browser's native hash scroll, so contents-row
  // anchors need an explicit scroll once mounted.
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.replace(/^#/, ""))?.scrollIntoView();
  }, [hash, pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--surface)] text-[color:var(--ink)]">
      <SiteHeader />
      <GuideBar current={current} topOffset={topOffset} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
