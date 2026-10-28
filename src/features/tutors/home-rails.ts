// Issue #485 Phase A: one card per home layout. The landing page used to
// build every curriculum rail independently (matchesCategoryFilter →
// slice(0, 6)), so multi-tag tutors (IB + DSE + card highlights) repeated
// across Most Requested, IBDP and DSE (MM-T135 / MM-T136 / MM-T126).
// This is the single sequential builder the issue mandates: trending ids
// seed `alreadyShown`, then each category — in CURRICULUM_CATEGORIES render
// order — excludes already-shown ids BEFORE the slice (walk the matched
// pool until maxPerRail UNIQUE tutors or pool exhaustion, never "top 6 then
// drop"), then commits its picks before the next category runs. Rails end
// up mutually exclusive; the /tutors?category= browse lists (View all
// links) keep full membership — nothing here touches that path.
//
// The "< 3 tutors → hide the section" rule lives at the render site in
// src/routes/index.tsx (it must keep skeletons while the tutor fetch is in
// flight); this module returns the post-exclude lists as-is.
import { matchesCategoryFilter } from "./subjects";
import { dailyTieBreakSort } from "./daily-shuffle";
import type { Tutor } from "./queries";

export type HomeCurriculumRails = Record<string, Tutor[]>;

export function buildHomeCurriculumRails({
  tutors,
  trendingTutorIds,
  categories,
  maxPerRail,
  day,
  highlightsFor,
}: {
  tutors: readonly Tutor[];
  /** Tutor ids already rendered by the trending row above the rails. */
  trendingTutorIds: readonly string[];
  /** Curriculum category values in render order (CURRICULUM_CATEGORIES). */
  categories: readonly string[];
  /** MAX_HOME_TUTORS at the call site; kept a param for tests. */
  maxPerRail: number;
  /** Asia/Hong_Kong "YYYY-MM-DD" from hktDate() — pins the tie shuffle. */
  day: string;
  highlightsFor: (tutor: Tutor) => string[];
}): HomeCurriculumRails {
  const alreadyShown = new Set<string>(trendingTutorIds);
  const rails: HomeCurriculumRails = {};
  for (const category of categories) {
    const matched = tutors.filter((tutor) =>
      matchesCategoryFilter(category, tutor.subjects, [
        ...tutor.target_students,
        ...highlightsFor(tutor),
      ]),
    );
    // Phase B: the matched pool carries no engagement ranking (all one
    // tier), so the daily hash is the only sort key — stable sort keeps the
    // query order for the vanishingly-rare equal-hash case. Exclude
    // already-shown tutors BEFORE the slice so a trending-crowded category
    // fills with the NEXT unique matches instead of collapsing to empty.
    const shuffled = dailyTieBreakSort(
      matched,
      () => 0,
      (tutor) => tutor.id,
      day,
    );
    const chosen = shuffled.filter((tutor) => !alreadyShown.has(tutor.id)).slice(0, maxPerRail);
    chosen.forEach((tutor) => alreadyShown.add(tutor.id));
    rails[category] = chosen;
  }
  return rails;
}
