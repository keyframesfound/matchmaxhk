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
