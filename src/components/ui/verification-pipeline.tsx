"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";

import { cn } from "@/lib/utils";
import { DecryptText } from "@/components/ui/decrypt-text";

export type PipelineStep = {
  title: string;
  detail: string;
  badge?: string;
};

type VerificationPipelineProps = {
  eyebrow: string;
  title: string;
  lead: string;
  steps: PipelineStep[];
  handoffLabel: string;
  handoffFrom: string;
  handoffTo: string;
  demoNote: string;
};

export function VerificationPipeline({
  eyebrow,
  title,
  lead,
  steps,
  handoffLabel,
  handoffFrom,
  handoffTo,
  demoNote,
}: VerificationPipelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [railHeight, setRailHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const reducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 0.7", "end 0.65"],
  });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    setActiveIndex(Math.min(steps.length - 1, Math.floor(latest * steps.length)));
  });

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const update = () => setRailHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const beamHeight = useTransform(scrollYProgress, [0, 1], [0, railHeight]);
  const resolvedActive = reducedMotion ? steps.length - 1 : activeIndex;

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div className="h-fit lg:sticky lg:top-24">
          <p className="text-sm font-bold text-[#8ecdf8]">{eyebrow}</p>
          <h2 className="mt-4 max-w-xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            {title}
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-white/65">{lead}</p>

          <ol className="mt-10 hidden space-y-3 lg:block" aria-hidden="true">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className={cn(
                  "flex items-center gap-3 text-sm font-bold transition-colors duration-300",
                  index <= resolvedActive ? "text-[#1d9bf0]" : "text-white/30",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border text-xs transition-colors duration-300",
                    index <= resolvedActive
                      ? "border-[#1d9bf0]/60 bg-[#1d9bf0]/15 text-[#8ecdf8]"
                      : "border-white/15 text-white/40",
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                {step.title}
              </li>
            ))}
          </ol>

          <div className="mt-10 hidden items-center gap-3 lg:flex">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">
              {handoffLabel}
            </span>
            <span className="flex items-center gap-2">
              <span className="rounded-md border border-white/15 bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-white/70">
                {handoffFrom}
              </span>
              <span aria-hidden="true" className="text-[#1d9bf0]">
                →
              </span>
              <span className="rounded-md border border-[#1d9bf0]/40 bg-[#1d9bf0]/10 px-2.5 py-1 text-xs font-bold text-[#8ecdf8]">
                {handoffTo}
              </span>
            </span>
            <span className="text-xs text-white/30">{demoNote}</span>
          </div>
        </div>

        <div ref={containerRef} className="relative pl-10 sm:pl-14">
          <div
            ref={railRef}
            aria-hidden="true"
            className="absolute bottom-0 left-[3px] top-0 w-[2px] bg-white/10 sm:left-[7px]"
          >
            <motion.div
              className="absolute inset-x-0 top-0 rounded-full bg-gradient-to-b from-[#1d9bf0] via-[#1d9bf0] to-[#8ecdf8] shadow-[0_0_16px_rgba(29,155,240,0.55)]"
              style={reducedMotion ? { height: railHeight } : { height: beamHeight }}
            />
          </div>

          <ol className="relative">
            {steps.map((step, index) => {
              const isActive = index <= resolvedActive;
              return (
                <li
                  key={step.title}
                  className="relative flex min-h-[46vh] items-center py-8 sm:min-h-[52vh]"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute top-1/2 -left-[44px] h-4 w-4 -translate-y-1/2 rounded-full border-2 transition-colors duration-300 sm:-left-[60px]",
                      isActive
                        ? "border-[#1d9bf0] bg-[#1d9bf0] shadow-[0_0_12px_rgba(29,155,240,0.7)]"
                        : "border-white/25 bg-[#0f1419]",
                    )}
                  />
                  <article
                    className={cn(
                      "w-full rounded-[var(--radius-panel)] border p-6 backdrop-blur-sm transition-colors duration-500 sm:p-8",
                      isActive
                        ? "border-[#1d9bf0]/45 bg-white/[0.05]"
                        : "border-white/12 bg-white/[0.03]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span
                        className={cn(
                          "text-sm font-extrabold tracking-[0.18em] transition-colors duration-300",
                          isActive ? "text-[#1d9bf0]" : "text-white/30",
                        )}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {step.badge ? (
                        <span className="rounded-full border border-[#1d9bf0]/40 bg-[#1d9bf0]/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.18em] text-[#8ecdf8]">
                          <DecryptText text={step.badge} className="text-xs" />
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                      {step.title}
                    </h3>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-white/65">{step.detail}</p>
                  </article>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
