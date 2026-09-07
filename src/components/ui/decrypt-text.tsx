import { useCallback, useEffect, useMemo, useRef, useState, type ElementType } from "react";

import { cn } from "@/lib/utils";

type DecryptTextProps = {
  text: string;
  as?: ElementType;
  glyphs?: string;
  speed?: number;
  stagger?: number;
  startDelay?: number;
  jitter?: number;
  seed?: number;
  className?: string;
};

const GLYPH_POOL = "#%&@$?!*+=/{}[]<>~^";
const CYCLE_SPREAD = 35;

function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function DecryptText({
  text,
  as: Tag = "span",
  glyphs,
  speed = 45,
  stagger = 55,
  startDelay = 300,
  jitter = 90,
  seed = 1,
  className,
}: DecryptTextProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const charRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const rafRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const pool = glyphs && glyphs.length > 0 ? glyphs : GLYPH_POOL;

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setReady(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setReady(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const resolveAll = useCallback(() => {
    for (const el of charRefs.current) {
      if (!el) continue;
      el.textContent = el.dataset.char ?? el.textContent;
      el.dataset.state = "plain";
    }
  }, []);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !ready) {
      if (reduced) resolveAll();
      return;
    }
    const cells = charRefs.current.filter((el): el is HTMLSpanElement => el !== null);
    if (cells.length === 0) return;
    const rng = makeRng(seed);
    const lockAt = new Float64Array(cells.length);
    const nextAt = new Float64Array(cells.length);
    const locked = new Uint8Array(cells.length);
    cells.forEach((el, idx) => {
      lockAt[idx] = startDelay + idx * stagger + (rng() * 2 - 1) * jitter;
      nextAt[idx] = 0;
      el.dataset.state = "scramble";
      el.textContent = pool.charAt((rng() * pool.length) | 0);
    });
    let remaining = cells.length;
    const t0 = performance.now();
    const frame = () => {
      const now = performance.now() - t0;
      for (let idx = 0; idx < cells.length; idx += 1) {
        if (locked[idx]) continue;
        const el = cells[idx];
        if (!el) continue;
        if (now >= lockAt[idx]) {
          el.textContent = el.dataset.char ?? "";
          el.dataset.state = "lock";
          locked[idx] = 1;
          remaining -= 1;
        } else if (now >= nextAt[idx]) {
          el.textContent = pool.charAt((rng() * pool.length) | 0);
          nextAt[idx] = now + speed + rng() * CYCLE_SPREAD;
        }
      }
      if (remaining <= 0) {
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return stop;
  }, [ready, seed, speed, stagger, startDelay, jitter, pool, resolveAll, stop]);

  const words = useMemo(() => {
    const out: Array<Array<{ i: number; ch: string }>> = [];
    let i = 0;
    for (const word of text.split(" ")) {
      const item: Array<{ i: number; ch: string }> = [];
      for (const ch of Array.from(word)) {
        item.push({ i, ch });
        i += 1;
      }
      out.push(item);
    }
    return out;
  }, [text]);

  let cursor = -1;
  return (
    <Tag ref={rootRef} data-motion="decrypt" className={cn("inline-block", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="decrypt-text-scope select-none">
        {words.map((word, w) => (
          <span key={w} className="inline-block whitespace-pre">
            {word.map((item) => {
              cursor += 1;
              const at = cursor;
              return (
                <span
                  key={item.i}
                  data-char={item.ch}
                  data-state="plain"
                  ref={(el) => {
                    charRefs.current[at] = el;
                  }}
                >
                  {item.ch}
                </span>
              );
            })}
          </span>
        ))}
      </span>
      <style>{`
.decrypt-text-scope [data-char]{color:inherit;}
.decrypt-text-scope [data-char][data-state="scramble"]{color:color-mix(in oklab, currentColor 38%, transparent);}
.decrypt-text-scope [data-char][data-state="lock"]{color:inherit;animation:decrypt-flash 420ms cubic-bezier(.2,0,0,1);}
@keyframes decrypt-flash{0%{color:var(--brand-link,#1d9bf0);text-shadow:0 0 24px color-mix(in oklab, var(--brand-link,#1d9bf0) 70%, transparent);}100%{text-shadow:0 0 0 transparent;}}
@media (prefers-reduced-motion: reduce){.decrypt-text-scope [data-char][data-state="lock"]{animation:none;}}
`}</style>
    </Tag>
  );
}
