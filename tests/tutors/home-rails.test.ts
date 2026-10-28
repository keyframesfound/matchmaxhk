import { describe, expect, it } from "vitest";

import { buildHomeCurriculumRails } from "../../src/features/tutors/home-rails";
import { dailyTieKey } from "../../src/features/tutors/daily-shuffle";
import type { Tutor } from "../../src/features/tutors/queries";

/**
 * Issue #485 Phase A — page-level alreadyShown de-dupe across Trending →
 * curriculum rails, tested as a pure builder. Key behaviours: exclude
 * BEFORE the slice (next-6-unique, never "top 6 then drop"), mutual
 * exclusivity across rails in CURRICULUM_CATEGORIES order, cold start
 * (trending hidden) still de-dupes rails against each other, and the
 * deterministic daily tie shuffle (Phase B) orders each rail.
 */

const DAY_A = "2026-10-27";
const DAY_B = "2026-10-28";

// Mirrors CURRICULUM_CATEGORIES order in src/routes/index.tsx.
const CATEGORIES = ["IB", "DSE", "IGCSE", "A-Level", "International"];
const MAX_PER_RAIL = 6;

const tutor = (id: string, targetStudents: string[] = []): Tutor =>
  ({ id, subjects: [], target_students: targetStudents }) as unknown as Tutor;

// matchesCategoryFilter falls back to plain text over target_students, so
// tagging target_students ["IBDP"] / ["HKDSE"] matches the IB / DSE rails
// without dragging real subject pools into the fixture.
const ibTutor = (id: string) => tutor(id, ["IBDP"]);
const dseTutor = (id: string) => tutor(id, ["HKDSE"]);
const multiTagTutor = (id: string) => tutor(id, ["IBDP", "HKDSE"]);

const noHighlights = () => [] as string[];

const build = (tutors: Tutor[], trendingIds: string[] = [], day = DAY_A) =>
  buildHomeCurriculumRails({
    tutors,
    trendingTutorIds: trendingIds,
    categories: CATEGORIES,
    maxPerRail: MAX_PER_RAIL,
    day,
    highlightsFor: noHighlights,
  });

describe("buildHomeCurriculumRails (#485 Phase A)", () => {
  it("excludes trending tutors BEFORE the slice — fills with the NEXT unique matches", () => {
    // Old bug: filter → slice(0, 6) → drop shown ids would leave the rail
    // empty when trending ate the top 6. The fix walks the pool.
    const pool = Array.from({ length: 10 }, (_, i) => dseTutor(`DSE-${i + 1}`));
    const trending = ["DSE-1", "DSE-2", "DSE-3", "DSE-4"];
    const rails = build(pool, trending);
    expect(rails.DSE).toHaveLength(6);
    expect(new Set(rails.DSE.map((t) => t.id))).toEqual(
      new Set(["DSE-5", "DSE-6", "DSE-7", "DSE-8", "DSE-9", "DSE-10"]),
    );
  });

  it("never puts a tutor in two rails — multi-tag tutors land in the earliest category only", () => {
    const pool = [
      multiTagTutor("MM-T135"),
      ibTutor("IB-1"),
      ibTutor("IB-2"),
      ibTutor("IB-3"),
      dseTutor("DSE-1"),
      dseTutor("DSE-2"),
      dseTutor("DSE-3"),
    ];
    const rails = build(pool);
    const homes = Object.entries(rails).flatMap(([category, tutors]) =>
      tutors.map((t) => ({ id: t.id, category })),
    );
    const seen = new Set(homes.map((h) => h.id));
    expect(seen.size).toBe(homes.length);
    expect(rails.IB.map((t) => t.id)).toContain("MM-T135");
    expect(rails.DSE.map((t) => t.id)).not.toContain("MM-T135");
  });

  it("stays mutually exclusive on cold start (trending hidden, alreadyShown seeds empty)", () => {
    const pool = [
      multiTagTutor("MM-T136"),
      ibTutor("IB-1"),
      ibTutor("IB-2"),
      ibTutor("IB-3"),
      dseTutor("DSE-1"),
      dseTutor("DSE-2"),
      dseTutor("DSE-3"),
    ];
    const rails = build(pool, []);
    const ids = Object.values(rails)
      .flat()
      .map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(rails.IB.map((t) => t.id)).toContain("MM-T136");
    expect(rails.DSE.map((t) => t.id)).not.toContain("MM-T136");
  });

  it("a trending tutor tagged for one category frees the rail to fill with the next DSE", () => {
    // Issue §4 edge: tutor only tagged DSE, also in Trending → shows in
    // Trending only; the DSE rail skips them and fills with the next DSE.
    const pool = [dseTutor("DSE-1"), dseTutor("DSE-2"), dseTutor("DSE-3"), dseTutor("DSE-4")];
    const rails = build(pool, ["DSE-1"]);
    expect(rails.DSE.map((t) => t.id).sort()).toEqual(["DSE-2", "DSE-3", "DSE-4"]);
  });

  it("caps every rail at maxPerRail even when the matched pool is larger", () => {
    const pool = [
      ...Array.from({ length: 9 }, (_, i) => ibTutor(`IB-${i + 1}`)),
      ...Array.from({ length: 9 }, (_, i) => dseTutor(`DSE-${i + 1}`)),
    ];
    const rails = build(pool);
    expect(rails.IB).toHaveLength(MAX_PER_RAIL);
    expect(rails.DSE).toHaveLength(MAX_PER_RAIL);
  });

  it("consumes the pool in category order: exhausted IB budget still leaves DSE full", () => {
    const pool = [
      ...Array.from({ length: 8 }, (_, i) => ibTutor(`IB-${i + 1}`)),
      ...Array.from({ length: 8 }, (_, i) => dseTutor(`DSE-${i + 1}`)),
      ...Array.from({ length: 8 }, (_, i) => tutor(`IG-${i + 1}`, ["IGCSE"])),
    ];
    const rails = build(pool);
    const ibIds = rails.IB.map((t) => t.id);
    const dseIds = rails.DSE.map((t) => t.id);
    const igIds = rails["IGCSE"].map((t) => t.id);
    expect(new Set([...ibIds, ...dseIds, ...igIds]).size).toBe(18);
    expect(ibIds.every((id) => id.startsWith("IB-"))).toBe(true);
    expect(dseIds.every((id) => id.startsWith("DSE-"))).toBe(true);
    expect(igIds.every((id) => id.startsWith("IG-"))).toBe(true);
  });

  it("is deterministic for the same day and keeps membership stable across days", () => {
    const pool = [
      ...Array.from({ length: 10 }, (_, i) => ibTutor(`IB-${i + 1}`)),
      ...Array.from({ length: 10 }, (_, i) => dseTutor(`DSE-${i + 1}`)),
    ];
    const dayAFirst = build(pool, [], DAY_A);
    const dayASecond = build(pool, [], DAY_A);
    expect(dayAFirst).toEqual(dayASecond);
    const dayB = build(pool, [], DAY_B);
    // Same members selected (subset of the same pools, same cap)…
    expect(dayB.IB.map((t) => t.id).sort()).toEqual(dayAFirst.IB.map((t) => t.id).sort());
    // …but the daily hash re-orders the rail, not per-reload random.
    expect(dayB.IB.map((t) => t.id)).toEqual(
      [...dayB.IB.map((t) => t.id)].sort((a, b) => dailyTieKey(a, DAY_B) - dailyTieKey(b, DAY_B)),
    );
  });

  it("rotates which tutors make the cut when the pool exceeds the cap and the day changes", () => {
    const pool = Array.from({ length: 12 }, (_, i) => ibTutor(`IB-${i + 1}`));
    const dayA = build(pool, [], DAY_A).IB.map((t) => t.id);
    const dayB = build(pool, [], DAY_B).IB.map((t) => t.id);
    expect(dayA).toHaveLength(6);
    expect(dayB).toHaveLength(6);
    // 6 of 12 chosen by hash: two different days pick (almost surely)
    // different faces — deterministic per day, verified via the tie key.
    const lowestSix = (day: string) =>
      pool
        .map((t) => t.id)
        .sort((a, b) => dailyTieKey(a, day) - dailyTieKey(b, day))
        .slice(0, 6);
    expect(dayA).toEqual(lowestSix(DAY_A));
    expect(dayB).toEqual(lowestSix(DAY_B));
  });

  it("passes card highlights into the category match via highlightsFor", () => {
    // Route passes [...target_students, ...getTutorCardHighlights(tutor)];
    // a tutor whose card highlight names the curriculum must match.
    const highlighted: Tutor = {
      id: "HL-1",
      subjects: [],
      target_students: [],
    } as unknown as Tutor;
    const rails = buildHomeCurriculumRails({
      tutors: [highlighted],
      trendingTutorIds: [],
      categories: ["IB"],
      maxPerRail: MAX_PER_RAIL,
      day: DAY_A,
      highlightsFor: () => ["IBDP examiner, 10 years"],
    });
    expect(rails.IB.map((t) => t.id)).toEqual(["HL-1"]);
  });
});
