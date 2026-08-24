import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

type BlurHighlightTextProps = {
  children: string;
  highlights?: string[];
  className?: string;
  highlightClassName?: string;
  highlightColor?: string;
  blurAmount?: number;
  inactiveOpacity?: number;
};

type StyleVariables = CSSProperties & {
  "--blur-highlight-color"?: string;
  "--blur-highlight-amount"?: string;
  "--blur-highlight-opacity"?: string;
};

function escapeExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Reveals copy as it enters the viewport, then sweeps a subdued highlight across
 * selected phrases. Built locally for MatchMax so it needs no external registry.
 */
export function BlurHighlightText({
  children,
  highlights = [],
  className,
  highlightClassName,
  highlightColor = "color-mix(in oklab, var(--brand-aqua) 70%, transparent)",
  blurAmount = 7,
  inactiveOpacity = 0.42,
}: BlurHighlightTextProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches || typeof IntersectionObserver === "undefined") {
      setIsActive(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsActive(true);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -14%", threshold: 0.18 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const uniqueHighlights = Array.from(
    new Set(highlights.map((item) => item.trim()).filter(Boolean)),
  ).sort((first, second) => second.length - first.length);

  const matcher = uniqueHighlights.length
    ? new RegExp(`(${uniqueHighlights.map(escapeExpression).join("|")})`, "gi")
    : null;
  const fragments = matcher ? children.split(matcher) : [children];
  let highlightIndex = 0;

  const style: StyleVariables = {
    "--blur-highlight-color": highlightColor,
    "--blur-highlight-amount": `${blurAmount}px`,
    "--blur-highlight-opacity": String(inactiveOpacity),
  };

  return (
    <span
      ref={rootRef}
      className={cn("blur-highlight-text", isActive && "is-active", className)}
      style={style}
    >
      {fragments.map((fragment, index) => {
        const isHighlighted = uniqueHighlights.some(
          (item) => item.localeCompare(fragment, undefined, { sensitivity: "accent" }) === 0,
        );

        if (!isHighlighted) return fragment;

        const currentIndex = highlightIndex;
        highlightIndex += 1;

        return (
          <mark
            key={`${fragment}-${index}`}
            className={cn("blur-highlight-mark", highlightClassName)}
            style={{ "--blur-highlight-index": String(currentIndex) } as CSSProperties}
          >
            {fragment}
          </mark>
        );
      })}
    </span>
  );
}
