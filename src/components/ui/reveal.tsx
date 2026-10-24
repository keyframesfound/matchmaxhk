import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Section-level entrance: a one-time 12px rise + fade as the section enters
 * the viewport. Deliberately coarse-grained — wrap whole sections, never
 * individual cards, so the page reads as settling into place rather than
 * performing.
 *
 * SSR-safe by construction: the server and the first client render emit a
 * visible plain <div> — never opacity:0 — so no-JS, slow-hydration and
 * prefers-reduced-motion visitors always see the content (the old
 * motion-based version shipped inline opacity:0 in the SSR HTML and could
 * leave reduced-motion users with permanently blank sections). After mount
 * the hidden state is armed only for sections still below the viewport —
 * above-the-fold sections skip the entrance rather than flash
 * visible→hidden→visible. The animation is CSS (opacity + translate), gated
 * by an IntersectionObserver, mirroring the blur-highlight reveal's
 * reduced-motion contract.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Extra delay in seconds — stagger siblings sparingly (<= 0.12). */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // "idle" is the server + first client render (visible, no animation
  // classes) so SSR and hydration markup match exactly.
  const [state, setState] = useState<"idle" | "hidden" | "shown">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Sections already on screen at mount stay visible (no hide→show flash
    // above the fold); only below-the-fold sections get armed.
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    setState("hidden");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setState("shown");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        className,
        state !== "idle" &&
          "transition-[opacity,translate] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        state === "hidden" && "opacity-0 translate-y-3",
        state === "shown" && "opacity-100 translate-y-0",
      )}
      style={state === "shown" && delay > 0 ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
