import { describe, expect, it } from "vitest";

import {
  TOPIC_PLAN_MAX,
  mergePlannedTopics,
  rankTopicSuggestions,
  type HeatmapCell,
} from "../../src/features/cases/heatmap-logic";

/** A real (logged) heatmap cell; mastery null = never tagged, the grey pill. */
function cell(tag: string, mastery: HeatmapCell["mastery"] = null): HeatmapCell {
  return { tag, mastery, sightings: mastery ? 2 : 0, weakByMistakes: false };
}

const tags = (cells: HeatmapCell[]) => cells.map((entry) => entry.tag);

describe("planned topics (#796 §2.1) — mergePlannedTopics", () => {
  it("appends only planned topics that are not already cells", () => {
    const merged = mergePlannedTopics(
      [cell("Algebra", "practicing"), cell("Trig", "mastered")],
      ["Trig", "Vectors", "Probability"],
    );
    expect(tags(merged)).toEqual(["Algebra", "Trig", "Vectors", "Probability"]);
  });

  it("preserves the existing order and appends planned topics in stored order", () => {
    const cells = [cell("weak-topic", "weak"), cell("mastered-topic", "mastered")];
    const merged = mergePlannedTopics(cells, ["Zeta", "alpha", "Mid"]);
    // No re-sorting: planned topics keep insertion order even when alphabetical
    // order would disagree.
    expect(tags(merged)).toEqual(["weak-topic", "mastered-topic", "Zeta", "alpha", "Mid"]);
  });

  it("treats a case/whitespace difference as the same topic", () => {
    const merged = mergePlannedTopics(
      [cell("Quadratic Equations", "practicing")],
      ["  #quadratic equations ", "#QUADRATIC EQUATIONS", "Fractions"],
    );
    // The existing cell wins (keeps its mastery); only genuinely new topics append.
    expect(tags(merged)).toEqual(["Quadratic Equations", "Fractions"]);
    expect(merged[0].mastery).toBe("practicing");
  });

  it("gives a planned topic with no log a normal never-mastered cell", () => {
    const merged = mergePlannedTopics([], ["Vectors"]);
    expect(merged).toEqual([
      { tag: "Vectors", mastery: null, sightings: 0, weakByMistakes: false },
    ]);
  });

  it("does not mutate the input cells and drops unusable planned entries", () => {
    const cells = [cell("Algebra", "mastered")];
    const merged = mergePlannedTopics(cells, ["", "   ", "#", "Vectors"]);
    expect(cells).toHaveLength(1);
    expect(tags(merged)).toEqual(["Algebra", "Vectors"]);
  });

  it("keeps the 30-per-case cap constant aligned with the DB trigger", () => {
    expect(TOPIC_PLAN_MAX).toBe(30);
  });
});

describe("planned topics (#796 §2.1) — rankTopicSuggestions", () => {
  it("ranks by total usage, then alphabetically on a tie", () => {
    const ranked = rankTopicSuggestions({
      loggedTags: [
        { tag: "Vectors", count: 2 },
        { tag: "Algebra", count: 5 },
        { tag: "Probability", count: 2 },
        { tag: "Trig", count: 1 },
      ],
      exclude: [],
    });
    expect(ranked).toEqual(["Algebra", "Probability", "Vectors", "Trig"]);
  });

  it("dedupes differently-cased duplicates and keeps the most-used spelling", () => {
    const ranked = rankTopicSuggestions({
      loggedTags: [
        { tag: "algebra", count: 1 },
        { tag: "ALGEBRA", count: 4 },
        { tag: "Algebra", count: 2 },
        { tag: "  #Vectors ", count: 3 },
      ],
      exclude: [],
    });
    expect(ranked).toEqual(["ALGEBRA", "Vectors"]);
  });

  it("drops excluded topics case- and whitespace-insensitively", () => {
    const ranked = rankTopicSuggestions({
      loggedTags: [
        { tag: "Algebra", count: 5 },
        { tag: "Vectors", count: 3 },
        { tag: "Trig", count: 1 },
      ],
      exclude: ["  #ALGEBRA ", "vectors"],
    });
    expect(ranked).toEqual(["Trig"]);
  });

  it("caps the list, defaulting to 12 and honouring an explicit limit", () => {
    const loggedTags = Array.from({ length: 20 }, (_, index) => ({
      tag: `Topic ${String(index + 1).padStart(2, "0")}`,
      count: 20 - index,
    }));
    expect(rankTopicSuggestions({ loggedTags, exclude: [] })).toHaveLength(12);
    expect(rankTopicSuggestions({ loggedTags, exclude: [], limit: 3 })).toEqual([
      "Topic 01",
      "Topic 02",
      "Topic 03",
    ]);
  });

  it("ignores unusable counts and blank tags instead of inventing suggestions", () => {
    const ranked = rankTopicSuggestions({
      loggedTags: [
        { tag: "Algebra", count: 2 },
        { tag: "Vectors", count: 0 },
        { tag: "Trig", count: -3 },
        { tag: "  ", count: 9 },
        { tag: "#", count: 9 },
      ],
      exclude: [],
    });
    expect(ranked).toEqual(["Algebra"]);
    expect(rankTopicSuggestions({ loggedTags: [], exclude: [] })).toEqual([]);
  });
});
