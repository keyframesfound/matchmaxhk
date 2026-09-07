"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type BlurHighlightTextProps = {
  children: string;
  highlights?: string[];
  className?: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  activeClassName?: string;
  active?: boolean;
};

type Segment = { text: string; mark: boolean; index: number };

function buildSegments(text: string, highlights: string[]): Segment[] {
  if (highlights.length === 0) return [{ text, mark: false, index: -1 }];
  const segments: Segment[] = [];
  let cursor = 0;
  let markIndex = 0;
  while (cursor < text.length) {
    let nextAt = -1;
    let nextLength = 0;
    for (const highlight of highlights) {
      if (!highlight) continue;
      const at = text.indexOf(highlight, cursor);
      if (at !== -1 && (nextAt === -1 || at < nextAt)) {
        nextAt = at;
        nextLength = highlight.length;
      }
    }
    if (nextAt === -1) {
      segments.push({ text: text.slice(cursor), mark: false, index: -1 });
      break;
    }
    if (nextAt > cursor) {
      segments.push({ text: text.slice(cursor, nextAt), mark: false, index: -1 });
    }
    segments.push({ text: text.slice(nextAt, nextAt + nextLength), mark: true, index: markIndex });
    markIndex += 1;
    cursor = nextAt + nextLength;
  }
  return segments;
}

export function BlurHighlightText({
  children,
  highlights = [],
  className,
  as: Tag = "span",
  activeClassName,
  active,
}: BlurHighlightTextProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [ioActive, setIoActive] = useState(false);
  const isActive = active ?? ioActive;
  const segments = useMemo(() => buildSegments(children, highlights), [children, highlights]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setIoActive(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIoActive(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      className={cn("blur-highlight-text", isActive && cn("is-active", activeClassName), className)}
    >
      {segments.map((segment, i) =>
        segment.mark ? (
          <span
            key={i}
            className="blur-highlight-mark"
            style={{ ["--blur-highlight-index" as string]: segment.index }}
          >
            {segment.text}
          </span>
        ) : (
          <span key={i}>{segment.text}</span>
        ),
      )}
    </Tag>
  );
}
