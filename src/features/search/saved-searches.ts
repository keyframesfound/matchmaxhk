import { useSyncExternalStore } from "react";

/**
 * #725 slice 1: Carousell-style saved searches for Tutors and Cases.
 * Stored on this device (localStorage) for everyone in V1; account sync and
 * new-match alerts in the 🔔 tab follow once the saved_searches table ships.
 */

export type SavedSearchScope = "tutors" | "cases" | "notes";

export type SavedSearchParams = Record<string, string | number | boolean>;

export type SavedSearch = {
  id: string;
  scope: SavedSearchScope;
  params: SavedSearchParams;
  label: string;
  createdAt: number;
};

const STORAGE_KEY = "mm_saved_searches_v1";
const EVENT = "mm-saved-searches";
/** #725: guests keep at most 5; signed-in accounts more. */
export const GUEST_SAVED_LIMIT = 5;
export const ACCOUNT_SAVED_LIMIT = 20;

/** URL keys that are UI state, never part of a saved search. */
const TRANSIENT_KEYS = new Set(["open", "view", "post", "tutor", "req_curriculum", "req_subject"]);

/** Drop empty / transient keys so equal searches compare equal. */
export function normalizeSearchParams(params: Record<string, unknown>): SavedSearchParams {
  const out: SavedSearchParams = {};
  for (const key of Object.keys(params).sort()) {
    if (TRANSIENT_KEYS.has(key)) continue;
    const value = params[key];
    if (value === undefined || value === null || value === "" || value === false) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = typeof value === "string" ? value.slice(0, 120) : value;
    }
  }
  return out;
}

export function searchKey(scope: SavedSearchScope, params: SavedSearchParams): string {
  return `${scope}:${JSON.stringify(normalizeSearchParams(params))}`;
}

export function hasSavableFilters(params: Record<string, unknown>): boolean {
  return Object.keys(normalizeSearchParams(params)).length > 0;
}

function readAll(): SavedSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SavedSearch =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as SavedSearch).id === "string" &&
          ["tutors", "cases", "notes"].includes((item as SavedSearch).scope) &&
          typeof (item as SavedSearch).label === "string",
      )
      .map((item) => ({ ...item, params: normalizeSearchParams(item.params ?? {}) }));
  } catch {
    return [];
  }
}

function writeAll(items: SavedSearch[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage blocked: the save is lost, never fatal
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Pure list update, newest first; returns null when the cap is reached. */
export function addSavedSearch(
  items: readonly SavedSearch[],
  next: Omit<SavedSearch, "id" | "createdAt">,
  limit: number,
  now = Date.now(),
): SavedSearch[] | null {
  const key = searchKey(next.scope, next.params);
  const rest = items.filter((item) => searchKey(item.scope, item.params) !== key);
  if (rest.length >= limit && rest.length === items.length) return null;
  return [
    {
      ...next,
      params: normalizeSearchParams(next.params),
      id: `${now}-${rest.length}`,
      createdAt: now,
    },
    ...rest,
  ];
}

export function saveSearch(next: Omit<SavedSearch, "id" | "createdAt">, limit: number): boolean {
  const updated = addSavedSearch(readAll(), next, limit);
  if (!updated) return false;
  writeAll(updated);
  return true;
}

export function removeSavedSearch(id: string) {
  writeAll(readAll().filter((item) => item.id !== id));
}

let cachedRaw: string | null | undefined;
let cached: SavedSearch[] = [];

function snapshot(): SavedSearch[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = readAll();
  }
  return cached;
}

const EMPTY: SavedSearch[] = [];

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useSavedSearches(scope: SavedSearchScope): SavedSearch[] {
  const all = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  return all.filter((item) => item.scope === scope);
}

/** #725 slice 2: device saves to upload after sign-in. */
export function readLocalSavedSearches(): SavedSearch[] {
  return readAll();
}

export function clearLocalSavedSearches() {
  writeAll([]);
}
