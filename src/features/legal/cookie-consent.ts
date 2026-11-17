import { useSyncExternalStore } from "react";

/**
 * #783 §2.2: cookie / analytics consent. "essential" is the default until
 * the visitor chooses; only "all" lets non-essential storage persist (today:
 * the anonymous engagement viewer key). Stored per browser; changeable any
 * time from Privacy → Cookies.
 */

export type CookieConsent = "all" | "essential";

const STORAGE_KEY = "mm_cookie_consent_v1";
const EVENT = "mm-cookie-consent";
/** Non-essential keys removed when the visitor picks Essential only. */
const NON_ESSENTIAL_KEYS = ["matchmax.viewer_key"];

function read(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { choice?: unknown };
    return parsed.choice === "all" || parsed.choice === "essential" ? parsed.choice : null;
  } catch {
    return null;
  }
}

/** The visitor's choice, or null before they choose (treated as essential). */
export function getCookieConsent(): CookieConsent | null {
  return read();
}

export function allowsNonEssential(): boolean {
  return read() === "all";
}

export function setCookieConsent(choice: CookieConsent) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, at: Date.now() }));
    if (choice === "essential") {
      for (const key of NON_ESSENTIAL_KEYS) window.localStorage.removeItem(key);
    }
  } catch {
    // storage blocked: the banner simply shows again next visit
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Forget the choice so the banner shows again (Privacy → change choice). */
export function resetCookieConsent() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/** `undefined` during SSR / first paint, then the stored choice or null. */
export function useCookieConsent(): CookieConsent | null | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}
