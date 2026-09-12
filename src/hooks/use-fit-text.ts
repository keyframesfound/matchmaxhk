import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

type UseFitTextOptions = {
  maxLines?: 1 | 2;
  contentKey?: string | number;
};

const MIN_FONT_SIZE_PX = 6;
const SHRINK_STEP_PX = 0.5;
const FIT_TOLERANCE_PX = 1;
const TWO_LINE_LINE_HEIGHT_RATIO = 1.25;

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function useFitText<T extends HTMLElement = HTMLElement>({
  maxLines = 1,
  contentKey,
}: UseFitTextOptions = {}) {
  const ref = useRef<T | null>(null);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    el.style.removeProperty("font-size");
    el.style.removeProperty("line-height");
    el.style.removeProperty("max-height");
    el.style.removeProperty("overflow");

    const baseSize = Number.parseFloat(window.getComputedStyle(el).fontSize);
    if (!Number.isFinite(baseSize) || baseSize <= 0) return;

    const applySize = (size: number) => {
      el.style.setProperty("font-size", `${size}px`, "important");
      if (maxLines > 1) {
        el.style.setProperty("line-height", `${TWO_LINE_LINE_HEIGHT_RATIO}`, "important");
        el.style.setProperty(
          "max-height",
          `${(size * TWO_LINE_LINE_HEIGHT_RATIO * maxLines).toFixed(2)}px`,
          "important",
        );
        el.style.setProperty("overflow", "hidden");
      }
    };

    let size = baseSize;
    for (;;) {
      applySize(size);
      const fits =
        maxLines === 1
          ? el.scrollWidth <= el.clientWidth + FIT_TOLERANCE_PX
          : el.scrollHeight <= el.clientHeight + FIT_TOLERANCE_PX;
      if (fits || size <= MIN_FONT_SIZE_PX) break;
      size = Math.max(MIN_FONT_SIZE_PX, size - SHRINK_STEP_PX);
    }
  }, [maxLines]);

  useIsomorphicLayoutEffect(() => {
    measure();

    const el = ref.current;
    if (!el) return;

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(el);
    document.fonts?.ready.then(measure).catch(() => {});

    return () => observer?.disconnect();
  }, [measure, contentKey]);

  return ref;
}
