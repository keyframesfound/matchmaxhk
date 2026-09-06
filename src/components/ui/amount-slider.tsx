"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";

import { cn } from "@/lib/utils";

// Square cell grid: CELL px per cell, GAP px between squares.
const CELL = 6;
const GAP = 1;
// Thumb width (matches `w-6` below). Radix keeps the thumb inside the track, so
// its center travels from THUMB/2 to (width - THUMB/2); ticks use the same inset
// so end points aren't jammed into the corners and the thumb lands on them.
const THUMB = 24;

// Deterministic pseudo-random in [0,1) per cell.
function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Amount slider rendered as a live grid of shimmering squares in the theme's
 * accent color. A tail of busy squares trails the thumb and grows with the
 * value, while a faint drifting shimmer nudges rightward through the empty
 * track. Honors prefers-reduced-motion, and pauses offscreen or on a hidden tab.
 */
export function AmountSlider({
  className,
  min = 0,
  max = 100,
  stops,
  onValueChange,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  /** Optional magnetic stops the thumb snaps to (rendered as ticks). */
  stops?: number[];
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const trackRef = React.useRef<HTMLSpanElement | null>(null);
  const drawRef = React.useRef<((now: number) => void) | null>(null);

  const value = Array.isArray(props.value)
    ? props.value
    : Array.isArray(props.defaultValue)
      ? props.defaultValue
      : [min];
  const current = value[value.length - 1] ?? min;
  const fraction = Math.min(Math.max((current - min) / (max - min || 1), 0), 1);
  const fractionRef = React.useRef(fraction);
  fractionRef.current = fraction;

  const sortedStops = React.useMemo(
    () => (stops && stops.length ? [...stops].sort((a, b) => a - b) : null),
    [stops],
  );
  const snap = (v: number) => {
    if (!sortedStops) return v;
    let best = sortedStops[0];
    for (const s of sortedStops) {
      if (Math.abs(s - v) < Math.abs(best - v)) best = s;
    }
    return best;
  };
  // Pointer/drag: magnetize each value to its nearest stop.
  const handleValueChange = (vals: number[]) => {
    onValueChange?.(sortedStops ? vals.map(snap) : vals);
  };
  // Keyboard: step one stop at a time instead of Radix's raw step.
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!sortedStops) return;
    const delta =
      event.key === "ArrowRight" || event.key === "ArrowUp"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowDown"
          ? -1
          : event.key === "Home"
            ? "home"
            : event.key === "End"
              ? "end"
              : null;
    if (delta === null) return;
    event.preventDefault();
    event.stopPropagation();
    const idx = sortedStops.indexOf(snap(current));
    const next =
      delta === "home"
        ? 0
        : delta === "end"
          ? sortedStops.length - 1
          : Math.min(sortedStops.length - 1, Math.max(0, idx + delta));
    onValueChange?.([sortedStops[next]]);
  };

  const [reduce, setReduce] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const track = trackRef.current;
    if (!canvas || !track) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = true;
    let w = 0;
    let h = 0;

    // Resolve the accent as a computed CSS color. The track carries
    // `color: var(--color-primary)`, so any format the host theme uses (oklch,
    // hsl, hex) arrives here already parsed, and a theme switch just repaints.
    let accent = "rgb(37 99 235)";
    const readAccent = () => {
      const v = getComputedStyle(track).color.trim();
      if (v) accent = v;
    };
    readAccent();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = track.clientWidth;
      h = track.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!running) drawRef.current?.(performance.now());
    };

    let last = performance.now();
    let phase = 0;
    let hintPhase = 0;
    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const fill = fractionRef.current;
      // Shimmer speeds up the further the thumb is dragged.
      phase += dt * (0.3 + fill * 3.2);
      // Gentle constant drift for the "nudge" shimmer in the empty track.
      hintPhase += dt;
      ctx.clearRect(0, 0, w, h);
      const cols = Math.ceil(w / CELL);
      const rows = Math.ceil(h / CELL);
      const sq = CELL - GAP;
      // Tail behind the thumb grows with the amount; a faint rightward "nudge"
      // shimmer fills the empty track ahead of it, strongest at small amounts
      // and fading away as the amount climbs. Positions are in px and aligned to
      // the thumb's real travel (inset by THUMB/2) so the tail ends at the thumb.
      const fillPx = THUMB / 2 + fill * (w - THUMB);
      const bandPx = fill * 0.6 * w;
      const hintStrength = 0.15 * (1 - fill);
      for (let cx = 0; cx < cols; cx++) {
        const cellPx = cx * CELL + CELL / 2;
        let colBase: number;
        let isTail: boolean;
        if (cellPx <= fillPx) {
          if (bandPx <= 0.5) continue;
          const band = 1 - (fillPx - cellPx) / bandPx;
          if (band <= 0) continue;
          colBase = band * band;
          isTail = true;
        } else {
          if (hintStrength <= 0.002) continue;
          const reach = w - fillPx;
          const along = reach > 0 ? (cellPx - fillPx) / reach : 0;
          // Fades in just ahead of the thumb, peaks mid-empty, fades at the end;
          // the crest drifts rightward to hint "drag this way for more".
          const envelope = Math.sin(along * Math.PI);
          const pulse = 0.5 + 0.5 * Math.sin((cellPx / w) * 5 - hintPhase * 4.5);
          colBase = hintStrength * envelope * pulse;
          if (colBase <= 0.002) continue;
          isTail = false;
        }
        for (let cy = 0; cy < rows; cy++) {
          const ph = hash(cx, cy) * Math.PI * 2;
          const stat = 0.6 + 0.4 * hash(cx + 7.3, cy - 3.1);
          const twinkle = 0.5 + 0.5 * Math.sin(phase * 1.7 + ph);
          let anim: number;
          if (reduce) {
            anim = 1;
          } else if (isTail) {
            // Busy flicker drifting left like a rocket nozzle's exhaust; the
            // random per-cell phase keeps it lively instead of smooth bands,
            // and it flows faster as the amount climbs.
            const flicker = Math.sin(phase * 2.4 + cx * 0.9 + cy * 0.4 + ph);
            anim = 0.35 + 0.325 * (1 + flicker);
          } else {
            anim = 0.6 + 0.4 * twinkle;
          }
          let a = colBase * stat * anim;
          a = a < 0 ? 0 : a > 1 ? 1 : a;
          if (a < 0.015) continue;
          ctx.globalAlpha = a;
          ctx.fillStyle = accent;
          ctx.fillRect(cx * CELL, cy * CELL, sq, sq);
          ctx.globalAlpha = 1;
        }
      }
      if (running && !reduce) raf = requestAnimationFrame(draw);
    };
    drawRef.current = draw;

    resize();
    if (reduce) draw(performance.now());
    else raf = requestAnimationFrame(draw);

    const ro = new ResizeObserver(resize);
    ro.observe(track);

    const themeObserver = new MutationObserver(() => {
      readAccent();
      if (!running) draw(performance.now());
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    // Pause the loop when the slider scrolls offscreen or the tab is hidden.
    const io = new IntersectionObserver((entries) => {
      const visible = entries[0]?.isIntersecting ?? true;
      if (visible && !running && !reduce) {
        running = true;
        raf = requestAnimationFrame(draw);
      } else if (!visible && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    });
    io.observe(track);

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduce && !running) {
        running = true;
        raf = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      drawRef.current = null;
    };
  }, [reduce]);

  // Under reduced motion the loop is static, so repaint when the value changes.
  React.useEffect(() => {
    if (reduce) drawRef.current?.(performance.now());
  }, [fraction, reduce]);

  return (
    <SliderPrimitive.Root
      data-slot="amount-slider"
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50",
        className,
      )}
      onValueChange={handleValueChange}
      onKeyDownCapture={handleKeyDown}
      {...props}
    >
      <SliderPrimitive.Track
        ref={trackRef}
        className="relative h-9 w-full grow overflow-hidden rounded-lg bg-muted text-primary"
      >
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        {sortedStops?.map((s) => {
          const f = (s - min) / (max - min || 1);
          const active = s <= current + 1e-6;
          return (
            <span
              key={s}
              className={cn(
                "pointer-events-none absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-200",
                active ? "bg-foreground" : "bg-foreground/30",
              )}
              style={{
                left: `calc(${f} * (100% - ${THUMB}px) + ${THUMB / 2}px)`,
              }}
            />
          );
        })}
      </SliderPrimitive.Track>
      {value.map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          className="block h-10 w-6 shrink-0 cursor-grab rounded-lg bg-foreground shadow-md ring-ring/30 transition-[box-shadow] duration-300 ease-out outline-none hover:ring-2 focus-visible:ring-2 active:cursor-grabbing disabled:pointer-events-none"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

/**
 * The amount itself, one column per digit. A changed digit rolls to its new
 * value instead of cutting, so dragging the slider reads as a counter running
 * up or down. No dependency and no layout shift: every column is one character
 * wide with tabular figures, and reduced motion drops the roll, not the value.
 */
export function AmountReadout({
  value,
  prefix = "$",
  suffix,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: React.ReactNode;
  className?: string;
}) {
  const digits = String(Math.max(0, Math.round(value))).split("");

  return (
    <span
      className={cn(
        "inline-flex items-baseline font-semibold tabular-nums text-foreground",
        className,
      )}
      role="status"
      aria-label={`${prefix}${Math.max(0, Math.round(value))}`}
    >
      {prefix && <span aria-hidden="true">{prefix}</span>}
      {digits.map((digit, index) => (
        <RollingDigit
          // Keyed from the right so a place value keeps its column when the
          // number grows: 9 -> 10 must not re-mount the ones column.
          key={`${digits.length - index}`}
          digit={Number(digit)}
        />
      ))}
      {suffix}
    </span>
  );
}

function RollingDigit({ digit }: { digit: number }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-block h-[1em] w-[0.62em] overflow-hidden leading-none"
    >
      <span
        className="absolute inset-x-0 top-0 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ transform: `translateY(-${digit}em)` }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((candidate) => (
          <span key={candidate} className="flex h-[1em] items-center justify-center">
            {candidate}
          </span>
        ))}
      </span>
    </span>
  );
}
