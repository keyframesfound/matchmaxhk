import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { cn } from "@/lib/utils";
import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";

/**
 * Issue #208: shared shell for the guide hub. The sticky bar sits under the
 * site header; the labels scroll sideways on mobile while the page itself
 * never does (overflow-x is scoped to the bar's list).
 *
 * Issue #492: the six public tabs dropped the in-page ContentsRow (double
 * nav); the export stays because the flag-gated partners tab still uses it.
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
                    "inline-flex rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
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

/** In-page contents row: three to five anchors that scroll to headings.
 * Retained only for the flag-gated partners tab; the six public tabs no
 * longer render it (issue #492 killed the double nav). */
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

/**
 * Issue #492 wireframe A: connected vertical stepper. Dark ink circles
 * joined by a sky line that stretches with multi-line bodies — no
 * horizontal dividers between steps.
 */
export function GuideSteps({ steps }: { steps: [string, string, string][] }) {
  return (
    <ol className="space-y-0">
      {steps.map(([number, title, text], idx) => {
        const isLast = idx === steps.length - 1;
        return (
          <li key={number} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0f1419] text-[13px] font-bold text-white dark:bg-[#e7e9ea] dark:text-[#0f1419]">
                {number}
              </div>
              {!isLast && <div aria-hidden="true" className="my-1 w-[2px] flex-1 bg-[#8ecdf8]" />}
            </div>
            <div className={isLast ? "pb-0" : "pb-6"}>
              <h3 className="text-base font-semibold leading-snug text-[#0f1419] sm:text-lg dark:text-[#e7e9ea]">
                {title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-[#536471] dark:text-[#a3aab1]">
                {text}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Issue #492: FAQ accordion on a height + opacity spring that always starts
 * from the current value (interruptible mid-close, never killed back to 0),
 * critically damped (bounce 0) and settled within 250ms. Reduced motion
 * gets instant state changes. One item open at a time, like before.
 */
export function GuideFaq({ items }: { items: { title: string; content: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();

  return (
    <div className="divide-y divide-[color:var(--border)]">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const triggerId = `guide-faq-trigger-${index}`;
        const panelId = `guide-faq-panel-${index}`;
        return (
          <div key={item.title}>
            <button
              type="button"
              id={triggerId}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left text-base font-semibold hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2"
            >
              {item.title}
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out motion-reduce:transition-none",
                  isOpen && "rotate-180",
                )}
              />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="panel"
                  id={panelId}
                  role="region"
                  aria-labelledby={triggerId}
                  initial={
                    reduceMotion ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }
                  }
                  animate={
                    reduceMotion ? { height: "auto", opacity: 1 } : { height: "auto", opacity: 1 }
                  }
                  exit={reduceMotion ? { height: "auto", opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={
                    reduceMotion ? { duration: 0 } : { bounce: 0, duration: 0.25, type: "spring" }
                  }
                  className="overflow-hidden"
                >
                  <p className="pb-5 text-sm leading-relaxed text-muted-foreground">
                    {item.content}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Issue #492 wireframe C: bottom CTA row — stacked full-width on mobile,
 * 50/50 from sm. Extra bottom padding on mobile (pb-24) so the CTAs clear
 * the WhatsApp float and the mobile bottom nav (the floating ↑ is hidden on
 * guide routes entirely).
 */
export function GuideCtaRow({ children }: { children: ReactNode }) {
  return <div className="mt-14 grid gap-3 pb-24 sm:grid-cols-2 sm:pb-0">{children}</div>;
}

/** Section heading used by every guide block. */
export function GuideHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-3xl font-bold leading-[1.05] tracking-tight sm:text-4xl">{children}</h2>
  );
}

/**
 * Issue #498 (restores the #492 CEO lock): decorative 16:9 illustration slot.
 * The frame is fixed (aspect-video, rounded-2xl, sky wash), so swapping the
 * file in public/guide/<slot>.webp for a real asset later shifts nothing.
 * Alt stays empty: the images are decorative and must never carry copy that
 * duplicates the H1.
 */
export function GuideHeroImage({ slot }: { slot: string }) {
  return (
    <figure className="aspect-video mx-auto w-full max-w-4xl overflow-hidden rounded-2xl bg-[#E3ECF6]">
      <img src={`/guide/${slot}.webp`} alt="" className="h-full w-full object-cover" />
    </figure>
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

  // Issue #492: old ContentsRow hashes fall back gracefully — the tab still
  // renders, and the scroll is a no-op when the anchor id no longer exists.
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
