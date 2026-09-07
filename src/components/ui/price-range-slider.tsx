import * as React from "react";

import { cn } from "@/lib/utils";

const THUMB_VISIBLE = 28;
const THUMB_HIT = 44;

type Values = [number, number];

export interface PriceRangeSliderProps {
  min: number;
  max: number;
  step: number;
  stopInterval: number;
  value: Values;
  onValueChange: (value: Values) => void;
  prefix?: string;
  label?: string;
  minLabel: string;
  maxLabel: string;
  minReadoutLabel: string;
  maxReadoutLabel: string;
  className?: string;
  disabled?: boolean;
}

export function PriceRangeSlider({
  min,
  max,
  step,
  stopInterval,
  value,
  onValueChange,
  prefix = "HK$",
  label,
  minLabel,
  maxLabel,
  minReadoutLabel,
  maxReadoutLabel,
  className,
  disabled = false,
}: PriceRangeSliderProps) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [drag, setDrag] = React.useState<Values | null>(null);
  const [active, setActive] = React.useState<"lo" | "hi" | null>(null);

  const lo = drag ? drag[0] : value[0];
  const hi = drag ? drag[1] : value[1];

  const clamp = React.useCallback((v: number) => Math.min(max, Math.max(min, v)), [min, max]);

  const snap = React.useCallback(
    (v: number) => {
      const snapped = Math.round((v - min) / stopInterval) * stopInterval + min;
      return Math.min(max, Math.max(min, snapped));
    },
    [min, max, stopInterval],
  );

  const valueFromPoint = React.useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return min;
      const ratio = (clientX - rect.left) / rect.width;
      return min + ratio * (max - min);
    },
    [min, max],
  );

  const startDrag = (thumb: "lo" | "hi") => (event: React.PointerEvent) => {
    if (disabled) return;
    event.preventDefault();
    const other = thumb === "lo" ? hi : lo;
    const point = clamp(valueFromPoint(event.clientX));
    setDrag(thumb === "lo" ? [point, Math.max(point, other)] : [Math.min(point, other), point]);
    setActive(thumb);
  };

  React.useEffect(() => {
    if (!active || disabled) return;

    const onMove = (event: PointerEvent) => {
      event.preventDefault();
      const point = clamp(valueFromPoint(event.clientX));
      setDrag((prev) => {
        const [prevLo, prevHi] = prev ?? value;
        if (active === "lo") {
          return [point, Math.max(point, prevHi)];
        }
        return [Math.min(point, prevLo), point];
      });
    };
    const onEnd = () => {
      setDrag((prev) => {
        const [rawLo, rawHi] = prev ?? value;
        let nextLo = snap(rawLo);
        let nextHi = snap(rawHi);
        if (nextLo > nextHi) {
          if (active === "lo") nextHi = Math.min(max, nextLo);
          else nextLo = Math.max(min, nextHi);
        }
        if (nextHi - nextLo < step) {
          if (active === "lo") nextHi = Math.min(max, nextLo + step);
          else nextLo = Math.max(min, nextHi - step);
        }
        onValueChange([nextLo, nextHi]);
        return null;
      });
      setActive(null);
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, disabled]);

  const onTrackPointerDown = (event: React.PointerEvent) => {
    if (disabled || event.button !== 0) return;
    const point = clamp(valueFromPoint(event.clientX));
    const thumb = Math.abs(point - lo) <= Math.abs(point - hi) ? "lo" : "hi";
    startDrag(thumb)(event);
  };

  const onThumbKeyDown = (thumb: "lo" | "hi") => (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const current = thumb === "lo" ? lo : hi;
    const other = thumb === "lo" ? hi : lo;
    let next: number | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = current - step;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") next = current + step;
    else if (event.key === "Home") next = thumb === "lo" ? min : lo;
    else if (event.key === "End") next = thumb === "lo" ? hi : max;
    else if (event.key === "PageDown") next = current - stopInterval;
    else if (event.key === "PageUp") next = current + stopInterval;
    if (next === null) return;
    event.preventDefault();
    next = clamp(next);
    if (thumb === "lo") onValueChange([next, Math.max(next, other)]);
    else onValueChange([Math.min(next, other), next]);
  };

  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  return (
    <div data-slot="price-range-slider" className={cn("flex w-full flex-col gap-3", className)}>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        {label ? (
          <p className="mr-1 shrink-0 text-xs font-medium text-muted-foreground">{label}</p>
        ) : null}
        <Readout
          value={lo}
          prefix={prefix}
          bound="min"
          otherValue={hi}
          label={minReadoutLabel}
          min={min}
          max={max}
          step={step}
          stopInterval={stopInterval}
          disabled={disabled}
          onCommit={(next) => onValueChange([next, Math.max(next, hi)])}
        />
        <span aria-hidden="true" className="text-xs text-muted-foreground">
          –
        </span>
        <Readout
          value={hi}
          prefix={prefix}
          bound="max"
          otherValue={lo}
          label={maxReadoutLabel}
          min={min}
          max={max}
          step={step}
          stopInterval={stopInterval}
          showPlus={hi >= max}
          disabled={disabled}
          onCommit={(next) => onValueChange([Math.min(next, lo), next])}
        />
      </div>

      <div
        ref={trackRef}
        onPointerDown={onTrackPointerDown}
        className="group relative flex h-11 w-full touch-none items-center select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
        data-disabled={disabled || undefined}
      >
        <div className="h-1 w-full rounded-full bg-border" />
        <div
          aria-hidden="true"
          className="absolute h-1 rounded-full bg-primary"
          style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
        />
        {(["lo", "hi"] as const).map((thumb) => {
          const v = thumb === "lo" ? lo : hi;
          return (
            <div
              key={thumb}
              role="slider"
              tabIndex={disabled ? -1 : 0}
              aria-label={thumb === "lo" ? minLabel : maxLabel}
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={v}
              aria-valuetext={`${prefix}${v}`}
              aria-disabled={disabled || undefined}
              onPointerDown={startDrag(thumb)}
              onKeyDown={onThumbKeyDown(thumb)}
              className={cn(
                "absolute flex items-center justify-center rounded-full outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
              style={{
                left: `${pct(v)}%`,
                width: THUMB_HIT,
                height: THUMB_HIT,
                transform: "translateX(-50%)",
                touchAction: "none",
              }}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "block rounded-full border-2 border-primary bg-background shadow-sm transition-transform",
                  active === thumb ? "scale-110" : "group-active:scale-95",
                )}
                style={{ width: THUMB_VISIBLE, height: THUMB_VISIBLE }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const Readout = React.memo(function Readout({
  value,
  prefix,
  bound,
  otherValue,
  label,
  min,
  max,
  step,
  stopInterval,
  showPlus,
  disabled,
  onCommit,
}: {
  value: number;
  prefix: string;
  bound: "min" | "max";
  otherValue: number;
  label: string;
  min: number;
  max: number;
  step: number;
  stopInterval: number;
  showPlus?: boolean;
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) {
      inputRef.current?.select();
    }
  }, [editing]);

  const beginEdit = () => {
    if (disabled) return;
    setDraft(String(Math.round(value)));
    setEditing(true);
  };

  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    if (Number.isNaN(parsed)) {
      setEditing(false);
      return;
    }
    let next = Math.min(max, Math.max(min, Math.round(parsed)));
    next = Math.round((next - min) / stopInterval) * stopInterval + min;
    next = Math.min(max, Math.max(min, next));
    if (bound === "min" && next > otherValue) next = otherValue;
    if (bound === "max" && next < otherValue) next = otherValue;
    onCommit(next);
    setEditing(false);
  };

  if (editing) {
    return (
      <span className="inline-flex items-baseline gap-0.5">
        <span aria-hidden="true" className="font-bold tabular-nums text-foreground">
          {prefix}
        </span>
        <input
          ref={inputRef}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setEditing(false);
            }
          }}
          aria-label={label}
          className="w-[4.5ch] rounded-sm border-b-2 border-primary bg-transparent font-bold tabular-nums text-foreground outline-none"
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={beginEdit}
      disabled={disabled}
      aria-label={`${label}: ${prefix}${value}${showPlus ? " +" : ""}`}
      className={cn(
        "inline-flex items-baseline gap-0.5 rounded-sm font-bold tabular-nums text-foreground outline-none",
        "transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      <span aria-hidden="true">{prefix}</span>
      <RollingDigits value={value} />
      {showPlus ? (
        <span aria-hidden="true" className="text-muted-foreground">
          +
        </span>
      ) : null}
    </button>
  );
});

function RollingDigits({ value }: { value: number }) {
  const digits = String(Math.max(0, Math.round(value))).split("");
  return (
    <span className="inline-flex items-baseline" aria-hidden="true">
      {digits.map((digit, index) => (
        <RollingDigit key={`${digits.length - index}`} digit={Number(digit)} />
      ))}
    </span>
  );
}

function RollingDigit({ digit }: { digit: number }) {
  return (
    <span className="relative inline-block h-[1em] w-[0.62em] overflow-hidden leading-none">
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
