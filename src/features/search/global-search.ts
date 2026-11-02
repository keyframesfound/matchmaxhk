/**
 * Issue #553 — global search, pure half.
 *
 * One query language for the header bar, /search and the landing hero:
 *   * free text = keyword tokens matched across public fields
 *   * `#tag`     = exact (normalized) tag filter; selected tags rank above
 *                  keyword-only hits (CEO lock 2026-11-01)
 * Tags are normalized once (lowercase, spaces → hyphens, no leading #,
 * 2–32 chars); `#bio` and `#生物` stay separate (no V1 alias merge). Admin
 * overrides can hide a tag or merge it into a canonical one.
 */

import { normalizeSearchText } from "@/features/materials/note-search";

export const SEARCH_GROUPS = ["tutors", "cases", "notes", "centres", "users", "posts"] as const;
export type SearchGroup = (typeof SEARCH_GROUPS)[number];

export const TAG_MIN_LEN = 2;
export const TAG_MAX_LEN = 32;
export const TYPEAHEAD_LIMIT = 8;
export const GROUP_LIMIT = 12;
export const QUERY_MAX_LEN = 120;
/** Soft-promoted once used (pro-bono discoverability, CEO 2026-11-01). */
export const PROMOTED_TAGS: readonly string[] = ["probono", "reduced-rate"];

const TAG_SCORE = 100;
const EXACT_FIELD_SCORE = 12;
const TOKEN_SCORE = 5;
const MATCHED_ON_MAX = 3;
const MATCHED_VALUE_MAX = 40;
const DAY_MS = 86_400_000;
const RECENCY_WINDOW_DAYS = 30;

/** "#Bio IA " → "bio-ia"; null when outside 2–32 chars after normalizing. */
export function normalizeTag(raw: string | null | undefined): string | null {
  const t = (raw ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return t.length >= TAG_MIN_LEN && t.length <= TAG_MAX_LEN ? t : null;
}

export type ParsedQuery = { keywords: string[]; tags: string[]; text: string };

/** Split a raw query into keyword tokens and `#tag` filters. */
export function parseSearchQuery(
  raw: string | null | undefined,
  extraTags: readonly string[] = [],
): ParsedQuery {
  const text = (raw ?? "").slice(0, QUERY_MAX_LEN);
  const tags = new Set<string>();
  const words: string[] = [];
  for (const part of text.split(/\s+/)) {
    if (!part) continue;
    if (part.startsWith("#")) {
      const tag = normalizeTag(part);
      if (tag) tags.add(tag);
    } else {
      words.push(part);
    }
  }
  for (const t of extraTags) {
    const tag = normalizeTag(t);
    if (tag) tags.add(tag);
  }
  const keywords = normalizeSearchText(words.join(" "))
    .split(" ")
    .filter((w) => w.length > 0);
  return { keywords, tags: [...tags], text: words.join(" ").trim() };
}

export type SearchField = { label: string; value: string | null | undefined };

export type Scored = { score: number; matchedOn: string[] };

/**
 * Score one entity. Tag-only queries are an exact filter (every selected tag
 * present). With keywords too, an entity matches on either side, and each
 * selected tag it carries outranks any keyword-only hit (CEO 2026-11-01).
 * A token equal to a whole field (e.g. a tutor code) scores higher. Null
 * when the entity does not match.
 */
export function scoreEntity(
  fields: readonly SearchField[],
  entityTags: readonly string[],
  query: ParsedQuery,
): Scored | null {
  const tagSet = new Set(
    entityTags.map((t) => normalizeTag(t)).filter((t): t is string => t !== null),
  );
  const tagHits = query.tags.filter((t) => tagSet.has(t));
  if (query.keywords.length === 0 && tagHits.length < query.tags.length) return null;
  const matchedOn = new Set<string>(tagHits.map((t) => `#${t}`));
  let score = tagHits.length * TAG_SCORE;

  if (query.keywords.length > 0) {
    const normalized = fields.map((f) => ({
      label: f.label,
      raw: f.value ?? "",
      text: normalizeSearchText(f.value ?? ""),
    }));
    const tagText = normalizeSearchText([...tagSet].join(" ").replace(/-/g, " "));
    let hits = 0;
    for (const kw of query.keywords) {
      const exact = normalized.find((f) => f.text === kw);
      if (exact) {
        score += EXACT_FIELD_SCORE;
        matchedOn.add(exact.raw);
        hits += 1;
        continue;
      }
      const partial = normalized.find((f) => f.text.includes(kw));
      if (partial) {
        score += TOKEN_SCORE;
        matchedOn.add(partial.raw.length > MATCHED_VALUE_MAX ? partial.label : partial.raw);
        hits += 1;
      } else if (tagText.includes(kw)) {
        score += TOKEN_SCORE;
        matchedOn.add(`#${kw}`);
        hits += 1;
      }
    }
    // Free text is an OR over tokens ("Mr Lee IB maths"); all-token matches
    // naturally rank higher, but a token or a selected tag must land.
    if (hits === 0 && tagHits.length === 0) return null;
  } else if (query.tags.length === 0) {
    return null;
  }
  return { score, matchedOn: [...matchedOn].slice(0, MATCHED_ON_MAX) };
}

/** Sort scored rows best first and cap the group. */
export function rankGroup<T extends { scored: Scored }>(
  rows: readonly T[],
  limit = GROUP_LIMIT,
): T[] {
  return [...rows].sort((a, b) => b.scored.score - a.scored.score).slice(0, limit);
}

export type TagUsage = { tag: string; count: number; lastUsedAt: string | null };
export type TagOverride = { tag: string; hidden: boolean; mergedInto: string | null };

/** Apply admin hide/merge overrides and combine counts per canonical tag. */
export function canonicalTagUsage(
  usages: readonly TagUsage[],
  overrides: readonly TagOverride[],
): TagUsage[] {
  const byTag = new Map(overrides.map((o) => [o.tag, o]));
  const out = new Map<string, TagUsage>();
  for (const u of usages) {
    const tag = normalizeTag(u.tag);
    if (!tag) continue;
    const o = byTag.get(tag);
    if (o?.hidden) continue;
    const canonical = normalizeTag(o?.mergedInto) ?? tag;
    if (byTag.get(canonical)?.hidden) continue;
    const prev = out.get(canonical);
    const last =
      prev?.lastUsedAt && (!u.lastUsedAt || prev.lastUsedAt > u.lastUsedAt)
        ? prev.lastUsedAt
        : u.lastUsedAt;
    out.set(canonical, { tag: canonical, count: (prev?.count ?? 0) + u.count, lastUsedAt: last });
  }
  return [...out.values()];
}

/** Map a tag through merge overrides (alias → canonical) for filtering. */
export function resolveTagAlias(tag: string, overrides: readonly TagOverride[]): string {
  const o = overrides.find((x) => x.tag === tag);
  return normalizeTag(o?.mergedInto) ?? tag;
}

/**
 * `#` typeahead: prefix match on the normalized tag (each script on its own),
 * ranked by exact-prefix boost + usage + recency, promoted tags nudged up.
 */
export function suggestTags(
  usages: readonly TagUsage[],
  rawPrefix: string,
  now: Date = new Date(),
  limit = TYPEAHEAD_LIMIT,
): string[] {
  const prefix = (rawPrefix ?? "").replace(/^#+/, "").toLowerCase().replace(/\s+/g, "-");
  const ageDays = (iso: string | null) =>
    iso ? Math.max(0, (now.getTime() - Date.parse(iso)) / DAY_MS) : 365;
  return usages
    .filter((u) => u.count > 0 && (!prefix || u.tag.includes(prefix)))
    .map((u) => {
      // Prefix matches always sort above substring matches.
      const prefixBoost = prefix && u.tag.startsWith(prefix) ? 1000 : 0;
      const exactBoost = prefix && u.tag === prefix ? 25 : 0;
      const promoted = PROMOTED_TAGS.includes(u.tag) ? 10 : 0;
      const recency = Math.max(0, RECENCY_WINDOW_DAYS - ageDays(u.lastUsedAt)) / 3;
      return { tag: u.tag, rank: prefixBoost + exactBoost + promoted + u.count * 2 + recency };
    })
    .sort((a, b) => b.rank - a.rank || a.tag.localeCompare(b.tag))
    .slice(0, limit)
    .map((r) => r.tag);
}

/** The `#partial` being typed at the end of the input, if any. */
export function trailingTagPrefix(value: string): string | null {
  const m = value.match(/(?:^|\s)#([^\s#]*)$/);
  return m ? m[1] : null;
}
