import { useEffect, useRef } from "react";

/**
 * #698: one "open the search" signal for chrome outside the search
 * components (the results "Switch student" link). Desktop (≥ lg) opens the
 * Filters dialog, phone / tablet opens the full-screen sheet.
 */
const EVENT = "mm-open-search";
const DESKTOP_QUERY = "(min-width: 1024px)";

export function requestOpenSearch() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function useOpenSearchEvent(desktop: boolean, open: () => void) {
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    const handler = () => {
      const isDesktop = window.matchMedia(DESKTOP_QUERY).matches;
      if (isDesktop === desktop) openRef.current();
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, [desktop]);
}
