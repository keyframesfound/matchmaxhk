/**
 * Cross-component launch channel for the coach tours (issue #397).
 *
 * The tour components only mount on their own pages, but the header burger
 * menu is global, `requestTour` bridges that: it wakes a mounted tour via a
 * window event, or leaves the request queued for the tour's next mount (the
 * caller navigates there right after). Kept free of driver.js so the header
 * doesn't pull the tour engine into every page bundle.
 */

export const TOUR_STORAGE_KEYS = {
  tutor: "matchmax.tour.tutor.v1",
  parent: "matchmax.tour.parent.v1",
} as const;

export const TOUR_REQUEST_EVENT = "matchmax.tour.request";

let pendingRequest: string | null = null;

/** Ask for the tour identified by `key` to start (or replay) on its page. */
export function requestTour(key: string): void {
  pendingRequest = key;
  window.dispatchEvent(new CustomEvent(TOUR_REQUEST_EVENT, { detail: key }));
}

/**
 * Consume a queued request for `key`. True only for the component that owns
 * that tour, so one dispatch can never start both tours.
 */
export function consumeTourRequest(key: string): boolean {
  if (pendingRequest !== key) return false;
  pendingRequest = null;
  return true;
}
