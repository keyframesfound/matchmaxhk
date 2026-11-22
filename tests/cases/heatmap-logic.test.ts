import { describe, expect, it } from "vitest";

import {
  WEAK_MISTAKE_THRESHOLD,
  buildTopicCells,
  heatmapTopicKey,
  normalizeHeatmapTag,
  parseDrawerTopics,
  type HeatmapCell,
} from "../../src/features/cases/heatmap-logic";
import type {
  DrawerLogRow,
  DrawerTopic,
} from "../../src/features/cases/super-drawer/super-drawer-logic";

/** Minimal DrawerLogRow; only created_at + topics matter to the heatmap. */
function log(createdAt: string, topics: DrawerTopic[]): DrawerLogRow {
  return {
    id: `log-${createdAt}`,
    case_id: "case-1",
    lesson_id: `lesson-${createdAt}`,
    logged_by: "tutor-1",
    recap_status: "complete",
    topics,
    pulse: {},
    recap: null,
    next_lesson_at: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

const tags = (cells: HeatmapCell[]) => cells.map((cell) => cell.tag);
const byTag = (cells: HeatmapCell[], tag: string) =>
  cells.find((cell) => cell.tag.toLowerCase() === tag.toLowerCase());

describe("Syllabus Topic Mastery Heatmap (#796 §2.1) — pure rules", () => {
  it("takes the newest non-null mastery", () => {
    const { cells } = buildTopicCells(
      [
        log("2026-11-01T10:00:00.000Z", [{ tag: "Algebra", mastery: "weak" }]),
        log("2026-11-08T10:00:00.000Z", [{ tag: "Algebra", mastery: "practicing" }]),
      ],
      {},
    );
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({
      tag: "Algebra",
      mastery: "practicing",
      sightings: 2,
      weakByMistakes: false,
    });
  });

  it("does not let a null mastery erase an earlier level", () => {
    const { cells, summary } = buildTopicCells(
      [
        log("2026-11-01T10:00:00.000Z", [{ tag: "Trig", mastery: "mastered" }]),
        log("2026-11-08T10:00:00.000Z", [{ tag: "Trig", mastery: null }]),
      ],
      {},
    );
    expect(cells[0].mastery).toBe("mastered");
    expect(cells[0].sightings).toBe(2);
    expect(summary).toEqual({ mastered: 1, practicing: 0, weak: 0, masteredPct: 100 });
  });

  it("counts sightings per log, not per repeated entry", () => {
    const { cells } = buildTopicCells(
      [
        log("2026-11-01T10:00:00.000Z", [
          { tag: "Probability", mastery: "weak" },
          { tag: "probability", mastery: "practicing" },
        ]),
        log("2026-11-08T10:00:00.000Z", [{ tag: "Probability", mastery: "practicing" }]),
      ],
      {},
    );
    expect(cells).toHaveLength(1);
    expect(cells[0].sightings).toBe(2);
    // Latest non-null entry in the newest log wins.
    expect(cells[0].mastery).toBe("practicing");
  });

  it("marks a topic weak when 3+ unresolved mistakes carry it, even with no drawer level", () => {
    const { cells, summary } = buildTopicCells(
      [log("2026-11-01T10:00:00.000Z", [{ tag: "Fractions", mastery: null }])],
      { fractions: WEAK_MISTAKE_THRESHOLD },
    );
    expect(cells[0]).toMatchObject({ tag: "Fractions", mastery: null, weakByMistakes: true });
    expect(summary).toMatchObject({ weak: 1, mastered: 0, masteredPct: 0 });
    // Below the threshold the same topic is not weak by mistakes.
    const below = buildTopicCells(
      [log("2026-11-01T10:00:00.000Z", [{ tag: "Fractions", mastery: null }])],
      { fractions: WEAK_MISTAKE_THRESHOLD - 1 },
    );
    expect(below.cells[0].weakByMistakes).toBe(false);
    expect(below.summary.weak).toBe(0);
  });

  it("mismatched key casing still finds the mistake count", () => {
    const { cells } = buildTopicCells(
      [log("2026-11-01T10:00:00.000Z", [{ tag: "Quadratic Equations", mastery: "practicing" }])],
      { "quadratic equations": 4 },
    );
    expect(cells[0].tag).toBe("Quadratic Equations");
    expect(cells[0].weakByMistakes).toBe(true);
  });

  it("computes masteredPct over every cell and returns 0 for an empty heatmap", () => {
    const four = buildTopicCells(
      [
        log("2026-11-01T10:00:00.000Z", [
          { tag: "A", mastery: "mastered" },
          { tag: "B", mastery: "practicing" },
          { tag: "C", mastery: "weak" },
          { tag: "D", mastery: null },
        ]),
      ],
      {},
    );
    expect(four.summary).toEqual({ mastered: 1, practicing: 1, weak: 1, masteredPct: 25 });

    const empty = buildTopicCells([], {});
    expect(empty.cells).toEqual([]);
    expect(empty.summary).toEqual({ mastered: 0, practicing: 0, weak: 0, masteredPct: 0 });
  });

  it("dedupes case-insensitively and keeps the newest casing", () => {
    const { cells } = buildTopicCells(
      [
        log("2026-11-01T10:00:00.000Z", [{ tag: "algebra", mastery: "weak" }]),
        log("2026-11-08T10:00:00.000Z", [{ tag: "ALGEBRA", mastery: "practicing" }]),
      ],
      {},
    );
    expect(cells).toHaveLength(1);
    expect(cells[0].tag).toBe("ALGEBRA");
    expect(heatmapTopicKey(" #ALGEBRA ")).toBe("algebra");
    expect(normalizeHeatmapTag("  #Vectors ")).toBe("Vectors");
  });

  it("sorts weak, practicing, mastered, never-mastered; then sightings desc, then tag asc", () => {
    const { cells } = buildTopicCells(
      [
        log("2026-11-01T10:00:00.000Z", [
          { tag: "mastered-low", mastery: "mastered" },
          { tag: "never", mastery: null },
          { tag: "practicing-b", mastery: "practicing" },
          { tag: "weak", mastery: "weak" },
        ]),
        log("2026-11-02T10:00:00.000Z", [
          { tag: "practicing-a", mastery: "practicing" },
          { tag: "practicing-b", mastery: "practicing" },
          { tag: "mastered-high", mastery: "mastered" },
        ]),
        log("2026-11-03T10:00:00.000Z", [{ tag: "mastered-high", mastery: "mastered" }]),
      ],
      { never: 3 },
    );
    expect(tags(cells)).toEqual([
      "never", // weak by mistakes
      "weak", // weak by mastery
      "practicing-b", // 2 sightings beats 1
      "practicing-a",
      "mastered-high", // 2 sightings beats 1
      "mastered-low",
    ]);
    // Ties on sightings and band fall back to alphabetical tag order.
    const tie = buildTopicCells(
      [
        log("2026-11-01T10:00:00.000Z", [
          { tag: "Beta", mastery: null },
          { tag: "alpha", mastery: null },
        ]),
      ],
      {},
    );
    expect(tags(tie.cells)).toEqual(["alpha", "Beta"]);
    expect(byTag(tie.cells, "Beta")).toBeDefined();
  });

  it("ignores malformed jsonb topics instead of inventing cells", () => {
    expect(parseDrawerTopics(null)).toEqual([]);
    expect(parseDrawerTopics([{ tag: "" }, { tag: "  # " }, 7, { tag: "Vectors" }])).toEqual([
      { tag: "Vectors", mastery: null },
    ]);
    expect(parseDrawerTopics([{ tag: "Vectors", mastery: "expert" }])).toEqual([
      { tag: "Vectors", mastery: null },
    ]);
    const { cells } = buildTopicCells(
      [log("2026-11-01T10:00:00.000Z", [{ tag: "   ", mastery: "weak" }])],
      {},
    );
    expect(cells).toEqual([]);
  });
});
