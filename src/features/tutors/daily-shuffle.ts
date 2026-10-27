// Issue #485 Phase B: deterministic daily tie shuffle for the home rails.
// The landing page inherited `publishedTutors` query order (≈ signup order)
// for its curriculum rails and stable query order inside trending ties, so
// the same faces stuck on the first screen day after day. Rails keep their
// real ranking keys; ONLY exact rank ties get re-ordered, seeded by the
// Asia/Hong_Kong calendar date, so tie groups rotate at HKT local midnight
// and stay byte-identical for the rest of the day (no per-reload scrambling,
// same order on every device for that day).

const HKT_TIME_ZONE = "Asia/Hong_Kong";

/**
 * Calendar date ("YYYY-MM-DD") in Asia/Hong_Kong — NOT the runtime's UTC
 * date. The audience is Hong Kong: the shuffle must flip at HKT midnight
 * (always UTC+8), not at UTC midnight 08:00 HKT. "en-CA" locale formats as
 * ISO YYYY-MM-DD directly.
 */
export function hktDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HKT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * 32-bit FNV-1a over `<id>#<day>` → uint32. Deterministic for a given
 * (id, day) pair across reloads, devices and SSR/client; changes when the
 * HKT date changes; decorrelates tutor ids so equal-rank ties rotate daily
 * instead of always favouring query order. The `#` separator keeps
 * ("ab", "c") and ("a", "bc") from building the same input string.
 */
export function dailyTieKey(id: string, day: string = hktDate()): number {
  const input = `${id}#${day}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Stable sort that preserves the caller's ranking untouched (pass the same
 * comparator that produced the list's primary order) and uses the daily
 * hash ONLY as the final tiebreaker for exact rank ties, so different
 * engagement tiers are never scrambled (#485 Phase B). The tie direction is
 * ASCENDING hash — lowest hash of the day leads each tie group; descending
 * would be equally fair, ascending is the documented contract the tests
 * assert against. Passing `() => 0` as the primary comparator shuffles the
 * whole list (one tier) — that is what the curriculum rails do, since their
 * pool carries no engagement ranking.
 *
 * Hashes are precomputed once per item (not inside the comparator) and the
 * input array is never mutated.
 */
export function dailyTieBreakSort<T>(
  items: readonly T[],
  primaryCompare: (a: T, b: T) => number,
  idOf: (item: T) => string,
  day: string,
): T[] {
  const keyed = items.map((item) => ({ item, tieKey: dailyTieKey(idOf(item), day) }));
  keyed.sort((a, b) => primaryCompare(a.item, b.item) || a.tieKey - b.tieKey);
  return keyed.map((entry) => entry.item);
}
