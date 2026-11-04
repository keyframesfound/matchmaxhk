/**
 * #557 "Recommended For You": the deterministic scoring from the issue.
 *   +50 same curriculum AND subject (else +25 same curriculum)
 *   +15 per overlapping tag (search tags + category)
 *   +15 same seller
 *   +10 social proof (rating >= 4.5, or top 20% by sales)
 * Seeds are the viewed note (detail page) or the saved / bought notes
 * (saved view); a candidate's score is its best score against any seed.
 * Pure; unit-tested in tests/materials/note-recommend.test.ts.
 */

export type RecommendItem = {
  id: string;
  curriculumTag: string;
  subjectTag: string | null;
  subcategory: string | null;
  searchTags: string[];
  tutorId: string;
  soldCount: number;
  ratingAverage: number | null;
};

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

function tagsOf(item: RecommendItem): Set<string> {
  const tags = new Set(item.searchTags.map(norm).filter(Boolean));
  if (item.subcategory) tags.add(norm(item.subcategory));
  return tags;
}

export function scoreAgainstSeed(
  seed: RecommendItem,
  candidate: RecommendItem,
  topSellerThreshold: number,
): number {
  let score = 0;
  const sameCurriculum =
    norm(seed.curriculumTag) !== "" && norm(seed.curriculumTag) === norm(candidate.curriculumTag);
  const sameSubject =
    norm(seed.subjectTag) !== "" && norm(seed.subjectTag) === norm(candidate.subjectTag);
  if (sameCurriculum && sameSubject) score += 50;
  else if (sameCurriculum) score += 25;
  const seedTags = tagsOf(seed);
  for (const tag of tagsOf(candidate)) if (seedTags.has(tag)) score += 15;
  if (seed.tutorId && seed.tutorId === candidate.tutorId) score += 15;
  if (
    (candidate.ratingAverage != null && candidate.ratingAverage >= 4.5) ||
    (topSellerThreshold > 0 && candidate.soldCount >= topSellerThreshold)
  ) {
    score += 10;
  }
  return score;
}

/** Sold count at the top-20% cut of the pool (0 when nobody has sold). */
export function topSellerThreshold(pool: RecommendItem[]): number {
  const sold = pool
    .map((p) => p.soldCount)
    .filter((n) => n > 0)
    .sort((a, b) => b - a);
  if (sold.length === 0) return 0;
  return sold[Math.max(0, Math.ceil(sold.length * 0.2) - 1)];
}

/** Rank candidates for the seeds; seeds and `exclude` never appear. */
export function recommend<T extends RecommendItem>(
  seeds: RecommendItem[],
  pool: T[],
  options: { exclude?: Iterable<string>; limit?: number; minScore?: number } = {},
): T[] {
  if (seeds.length === 0) return [];
  const excluded = new Set([...seeds.map((s) => s.id), ...(options.exclude ?? [])]);
  const threshold = topSellerThreshold(pool);
  return pool
    .filter((c) => !excluded.has(c.id))
    .map((c) => ({
      c,
      score: Math.max(...seeds.map((seed) => scoreAgainstSeed(seed, c, threshold))),
    }))
    .filter((r) => r.score >= (options.minScore ?? 25))
    .sort((a, b) => b.score - a.score || b.c.soldCount - a.c.soldCount)
    .slice(0, options.limit ?? 8)
    .map((r) => r.c);
}

// ---------------------------------------------------------------------------
// #557 / #626 Child 2 (CEO lock 2026-11-03): similar-on-click on a note's
// DETAIL page. Filters first, then deterministic score:
//   - never the note itself (or excluded / bought ids);
//   - active Explore filters (curriculum / subject) constrain the pool;
//   - slots 1-5: SAME curriculum AND subject as the viewed note, by score
//     (+ price band: ±HK$50 or both free = +10);
//   - slot 6: one diversify pick in the same curriculum (same subject,
//     different category preferred, else an adjacent subject);
//   - same author at most 2 of the 6; LIMIT 6. No ML.
// Saved / dashboard seeds keep `recommend` above.
// ---------------------------------------------------------------------------

export type SimilarItem = RecommendItem & { priceHkd: number };

export const SIMILAR_LIMIT = 6;
export const SIMILAR_AUTHOR_CAP = 2;

function priceBandBoost(seed: SimilarItem, c: SimilarItem): number {
  const seedFree = Number(seed.priceHkd) === 0;
  const candFree = Number(c.priceHkd) === 0;
  if (seedFree || candFree) return seedFree && candFree ? 10 : 0;
  return Math.abs(Number(seed.priceHkd) - Number(c.priceHkd)) <= 50 ? 10 : 0;
}

export function similarOnClick<T extends SimilarItem>(
  seed: SimilarItem,
  pool: T[],
  options: {
    exclude?: Iterable<string>;
    activeFilters?: { curriculum?: string | null; subject?: string | null };
  } = {},
): T[] {
  const excluded = new Set([seed.id, ...(options.exclude ?? [])]);
  const f = options.activeFilters ?? {};
  const threshold = topSellerThreshold(pool);
  const candidates = pool.filter(
    (c) =>
      !excluded.has(c.id) &&
      (!f.curriculum || norm(c.curriculumTag) === norm(f.curriculum)) &&
      (!f.subject || norm(c.subjectTag) === norm(f.subject)),
  );
  const scored = candidates
    .map((c) => ({ c, score: scoreAgainstSeed(seed, c, threshold) + priceBandBoost(seed, c) }))
    .sort((a, b) => b.score - a.score || b.c.soldCount - a.c.soldCount);

  const sameCurriculum = (c: SimilarItem) =>
    norm(seed.curriculumTag) !== "" && norm(c.curriculumTag) === norm(seed.curriculumTag);
  const sameSubject = (c: SimilarItem) =>
    norm(seed.subjectTag) !== "" && norm(c.subjectTag) === norm(seed.subjectTag);

  const picked: T[] = [];
  const perAuthor = new Map<string, number>();
  const take = (c: T) => {
    const n = perAuthor.get(c.tutorId) ?? 0;
    if (n >= SIMILAR_AUTHOR_CAP) return false;
    perAuthor.set(c.tutorId, n + 1);
    picked.push(c);
    return true;
  };

  // Slots 1-5: hard subject (+ curriculum) lock.
  for (const { c } of scored) {
    if (picked.length >= SIMILAR_LIMIT - 1) break;
    if (sameCurriculum(c) && sameSubject(c)) take(c);
  }
  // Slot 6: diversify inside the same curriculum.
  const seedCategory = norm(seed.subcategory);
  const diversify =
    scored.find(
      ({ c }) =>
        !picked.includes(c) &&
        sameCurriculum(c) &&
        sameSubject(c) &&
        norm(c.subcategory) !== seedCategory,
    ) ?? scored.find(({ c }) => !picked.includes(c) && sameCurriculum(c) && !sameSubject(c));
  if (diversify) take(diversify.c);
  // Thin pools: top up with the remaining same-curriculum matches.
  for (const { c } of scored) {
    if (picked.length >= SIMILAR_LIMIT) break;
    if (!picked.includes(c) && sameCurriculum(c)) take(c);
  }
  return picked.slice(0, SIMILAR_LIMIT);
}
