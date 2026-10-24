import { driver, type Driver, type DriveStep } from "driver.js";

import { TOUR_STORAGE_KEYS } from "./tour-requests";

export { TOUR_STORAGE_KEYS };

/**
 * Issue #397: post-signup coach-mark tours (tutors & parents).
 *
 * driver.js owns the overlay/spotlight/popover mechanics (the issue forbids a
 * custom overlay engine). Persistence is localStorage — per-browser,
 * no migration (the issue explicitly allows either).
 */

/** Unseen state must never brick a page when storage is unavailable. */
export function hasSeenTour(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return true;
  }
}

export function markTourSeen(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Storage unavailable: the tour re-fires next visit — acceptable.
  }
}

/**
 * Resolve a data-tour name to the first *visible* element. Targets often
 * exist twice (desktop sidebar vs mobile pill row); hidden duplicates must
 * win nothing, and fully missing targets become ghost steps.
 */
export function visibleTourElement(name: string): Element | null {
  if (typeof document === "undefined") return null;
  const candidates = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  for (const el of candidates) {
    if (el.getClientRects().length > 0) return el;
  }
  return null;
}

export type CoachTourTexts = {
  next: string;
  back: string;
  done: string;
  skip: string;
};

/** The one tour currently on screen, so a re-launch replaces it cleanly. */
let activeDriver: Driver | null = null;

/**
 * Run a tour over pre-resolved steps. Finishing, skipping (close button) or
 * clicking the overlay all destroy the driver → `onDismissed` marks the flag.
 */
export function runCoachTour(
  steps: DriveStep[],
  texts: CoachTourTexts,
  onDismissed: () => void,
): void {
  // Re-launch (e.g. header-menu replay) while a tour is open: replace it —
  // destroy() fires onDestroyed, which clears the pointer and marks seen.
  activeDriver?.destroy();
  if (steps.length === 0) {
    onDismissed();
    return;
  }
  const driverObj = driver({
    steps,
    overlayColor: "rgba(0, 0, 0, 0.6)",
    stagePadding: 4,
    allowClose: true,
    skipMissingElement: true,
    animate: true,
    showProgress: false,
    nextBtnText: texts.next,
    prevBtnText: texts.back,
    doneBtnText: texts.done,
    closeBtnLabel: texts.skip,
    onDestroyed: () => {
      if (activeDriver === driverObj) activeDriver = null;
      onDismissed();
    },
  });
  activeDriver = driverObj;
  driverObj.drive();
}

/** Build one popover step; steps whose target never became visible are skipped. */
export function tourStep(targetName: string | null, title: string, body: string): DriveStep | null {
  if (targetName === null) {
    // Element-less steps render as a centered popover (driver.js built-in).
    return { popover: { title, description: body } };
  }
  const el = visibleTourElement(targetName);
  if (!el) return null;
  return { element: el, popover: { title, description: body } };
}
