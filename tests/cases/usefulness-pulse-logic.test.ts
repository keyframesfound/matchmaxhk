import { describe, expect, it } from "vitest";

import {
  PULSE_MILESTONE_FIRST,
  PULSE_MILESTONE_STEP,
  PULSE_TAGS,
  PULSE_VERDICTS,
  duePulseMilestone,
  flagsOpsForVerdict,
  isPulseVerdict,
  sanitizePulseTags,
} from "../../src/features/cases/usefulness-pulse-logic";

describe("private lesson usefulness pulse (#796 §2.4, was #733) — pure rules", () => {
  it("locks the milestone cadence to every fifth verified lesson", () => {
    expect(PULSE_MILESTONE_FIRST).toBe(5);
    expect(PULSE_MILESTONE_STEP).toBe(5);
  });

  it("fires at 5, 10, 15 and nowhere off-cadence", () => {
    expect(duePulseMilestone(4)).toBeNull();
    expect(duePulseMilestone(5)).toBe(5);
    expect(duePulseMilestone(6)).toBeNull();
    expect(duePulseMilestone(9)).toBeNull();
    expect(duePulseMilestone(10)).toBe(10);
    expect(duePulseMilestone(15)).toBe(15);
  });

  it("never carries a milestone to a non-integer or pre-first lesson", () => {
    expect(duePulseMilestone(0)).toBeNull();
    expect(duePulseMilestone(1)).toBeNull();
    expect(duePulseMilestone(-5)).toBeNull();
    expect(duePulseMilestone(5.5)).toBeNull();
    expect(duePulseMilestone(Number.NaN)).toBeNull();
  });

  it("keeps the ticket's verdict order", () => {
    expect(PULSE_VERDICTS).toEqual(["very_useful", "okay", "needs_adjustment"]);
    expect(isPulseVerdict("okay")).toBe(true);
    expect(isPulseVerdict("great")).toBe(false);
    expect(isPulseVerdict(null)).toBe(false);
  });

  it("keeps the canonical tag order", () => {
    expect(PULSE_TAGS).toEqual([
      "clear_concepts",
      "good_pace",
      "pace_too_fast",
      "more_past_papers",
    ]);
  });

  it("drops unknown tags and keeps recognised ones", () => {
    expect(sanitizePulseTags(["good_pace", "not_a_tag", 42, null])).toEqual(["good_pace"]);
  });

  it("dedupes and returns canonical order regardless of input order", () => {
    expect(sanitizePulseTags(["more_past_papers", "clear_concepts", "more_past_papers"])).toEqual([
      "clear_concepts",
      "more_past_papers",
    ]);
  });

  it("caps the pulse at two preset tags", () => {
    expect(
      sanitizePulseTags(["good_pace", "clear_concepts", "pace_too_fast", "more_past_papers"]),
    ).toEqual(["clear_concepts", "good_pace"]);
  });

  it("treats a non-array (or missing) input as no tags", () => {
    expect(sanitizePulseTags(undefined)).toEqual([]);
    expect(sanitizePulseTags(null)).toEqual([]);
    expect(sanitizePulseTags("good_pace")).toEqual([]);
    expect(sanitizePulseTags({ 0: "good_pace" })).toEqual([]);
  });

  it("flags ops only for needs_adjustment", () => {
    expect(flagsOpsForVerdict("very_useful")).toBe(false);
    expect(flagsOpsForVerdict("okay")).toBe(false);
    expect(flagsOpsForVerdict("needs_adjustment")).toBe(true);
  });
});
