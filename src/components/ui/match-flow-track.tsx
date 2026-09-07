import type { ComponentType } from "react";
import { ArrowRight, Check, Search } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

type TrackLink = {
  to: "/tutors" | "/join" | "/tutor-requests";
  label: string;
  search?: { post?: true };
};

type MatchFlowTrackProps = {
  tone: "light" | "dark";
  icon: ComponentType<{ className?: string }>;
  eyebrow: string;
  audience: string;
  title: string;
  steps: [string, string, string][];
  links: TrackLink[];
  mockTitle: string;
  mockStates: [string, string, string];
  mockNote: string;
  mockRowA: string;
  mockRowB: string;
};

export function MatchFlowTrack({
  tone,
  icon: Icon,
  eyebrow,
  audience,
  title,
  steps,
  links,
  mockTitle,
  mockStates,
  mockNote,
  mockRowA,
  mockRowB,
}: MatchFlowTrackProps) {
  const dark = tone === "dark";

  return (
    <section
      className={cn(
        dark
          ? "bg-[#0f1419] text-white dark:bg-[#0f1419]"
          : "bg-[#E3ECF6] text-[#0f1419] dark:bg-[#061622] dark:text-white",
      )}
    >
      <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-20">
          <div className="h-fit lg:sticky lg:top-24">
            <Icon
              className={cn(
                "h-7 w-7",
                dark ? "text-[#8ecdf8]" : "text-[color:var(--muted-foreground)]",
              )}
            />
            <p
              className={cn(
                "mt-6 text-sm font-bold",
                dark ? "text-[#8ecdf8]" : "text-[color:var(--muted-foreground)]",
              )}
            >
              {eyebrow}
            </p>
            <h3 className="mt-3 text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
              {audience}
            </h3>
            <p className="mt-4 max-w-md text-xl font-bold leading-snug tracking-tight sm:text-2xl">
              {title}
            </p>
            <div className="mt-8 space-y-3">
              {links.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  search={link.search}
                  className="inline-flex items-center text-sm font-bold transition-transform hover:translate-x-1"
                >
                  {link.label}{" "}
                  <ArrowRight
                    className={cn(
                      "ml-2 h-4 w-4",
                      dark ? "text-[#8ecdf8]" : "text-[color:var(--brand-link)]",
                    )}
                  />
                </Link>
              ))}
            </div>
          </div>

          <div>
            <ol className="border-t border-current/20">
              {steps.map(([number, stepTitle, text]) => (
                <li
                  key={number}
                  className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-5 border-b border-current/20 py-7 sm:gap-8 sm:py-9"
                >
                  <span
                    className={cn(
                      "flex h-11 w-11 items-center justify-center text-sm font-bold",
                      dark
                        ? "bg-white/[0.06] text-white"
                        : "bg-[color:var(--foreground)]/[0.06] text-[color:var(--foreground)]",
                    )}
                  >
                    {number}
                  </span>
                  <div>
                    <h4 className="text-xl font-bold tracking-tight sm:text-2xl">{stepTitle}</h4>
                    <p
                      className={cn(
                        "mt-3 max-w-2xl text-sm leading-7",
                        dark ? "text-white/70" : "text-[color:var(--ink)]/70",
                      )}
                    >
                      {text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <div
              aria-hidden="true"
              className={cn(
                "mt-12 rounded-[var(--radius-panel)] border p-6 sm:p-8",
                dark
                  ? "border-white/12 bg-white/[0.04] shadow-[var(--shadow-teal)]"
                  : "border-[color:var(--ink)]/12 bg-[color:var(--surface)] shadow-[var(--shadow-brand)]",
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full",
                      dark ? "bg-white/[0.08]" : "bg-[color:var(--foreground)]/[0.06]",
                    )}
                  >
                    <Search
                      className={cn(
                        "h-4 w-4",
                        dark ? "text-[#8ecdf8]" : "text-[color:var(--brand-link)]",
                      )}
                    />
                  </span>
                  <p className="text-sm font-bold">{mockTitle}</p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border border-[#17bf63]/40 bg-[#17bf63]/10 px-3 py-1 text-xs font-bold text-[#17bf63]",
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                  {mockStates[2]}
                </span>
              </div>

              <div className="mt-6 space-y-3">
                {[
                  { label: mockRowA, done: true },
                  { label: mockRowB, done: true },
                ].map((row) => (
                  <div
                    key={row.label}
                    className={cn(
                      "flex items-center justify-between gap-4 rounded-[var(--radius-control)] border px-4 py-3",
                      dark
                        ? "border-white/10 bg-white/[0.03]"
                        : "border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)]",
                    )}
                  >
                    <span className={cn("text-sm", row.done ? "font-bold" : "font-medium")}>
                      {row.label}
                    </span>
                    <span className="h-2 w-16 rounded-full bg-[#1d9bf0]" />
                  </div>
                ))}
              </div>

              <p
                className={cn(
                  "mt-5 text-xs",
                  dark ? "text-white/35" : "text-[color:var(--ink)]/45",
                )}
              >
                {mockNote}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
