import { describe, expect, it } from "vitest";

import {
  BEHAVIOUR_SEVERITIES,
  BEHAVIOUR_SUBJECT_PARTIES,
  countStrikesBySubject,
  isBehaviourSeverity,
  isBehaviourSubjectParty,
  strikeCountFor,
  strikeSubjectKey,
} from "../../src/features/trust/behaviour-strikes";

const PARENT_A = "11111111-1111-1111-1111-111111111111";
const TUTOR_B = "22222222-2222-2222-2222-222222222222";

describe("enum guards (#782 §2.5)", () => {
  it("accepts only the three severities", () => {
    expect(isBehaviourSeverity("low")).toBe(true);
    expect(isBehaviourSeverity("high")).toBe(true);
    expect(isBehaviourSeverity("critical")).toBe(false);
    expect(isBehaviourSeverity(1)).toBe(false);
    expect(BEHAVIOUR_SEVERITIES).toHaveLength(3);
  });

  it("accepts only parent / tutor subject parties", () => {
    expect(isBehaviourSubjectParty("parent")).toBe(true);
    expect(isBehaviourSubjectParty("tutor")).toBe(true);
    expect(isBehaviourSubjectParty("student")).toBe(false);
    expect(BEHAVIOUR_SUBJECT_PARTIES).toHaveLength(2);
  });
});

describe("strikeSubjectKey", () => {
  it("keys a tutor subject when set, regardless of party columns order", () => {
    expect(strikeSubjectKey({ subject_parent_id: null, subject_tutor_id: TUTOR_B })).toBe(
      `tutor:${TUTOR_B}`,
    );
  });

  it("keys a parent subject when only the parent column is set", () => {
    expect(strikeSubjectKey({ subject_parent_id: PARENT_A, subject_tutor_id: null })).toBe(
      `parent:${PARENT_A}`,
    );
  });

  it("falls back to a null-subject bucket, never crashes", () => {
    expect(strikeSubjectKey({ subject_parent_id: null, subject_tutor_id: null })).toBe(
      "parent:none",
    );
  });
});

describe("countStrikesBySubject", () => {
  const rows = [
    { subject_parent_id: PARENT_A, subject_tutor_id: null },
    { subject_parent_id: PARENT_A, subject_tutor_id: null },
    { subject_parent_id: null, subject_tutor_id: TUTOR_B },
  ];

  it("accumulates strike counts per subject", () => {
    expect(countStrikesBySubject(rows)).toEqual({
      [`parent:${PARENT_A}`]: 2,
      [`tutor:${TUTOR_B}`]: 1,
    });
  });

  it("returns an empty map for an empty ledger", () => {
    expect(countStrikesBySubject([])).toEqual({});
  });
});

describe("strikeCountFor", () => {
  const rows = [
    { subject_parent_id: PARENT_A, subject_tutor_id: null },
    { subject_parent_id: null, subject_tutor_id: TUTOR_B },
  ];

  it("counts strikes for the exact parent or tutor subject", () => {
    expect(strikeCountFor(rows, { party: "parent", id: PARENT_A })).toBe(1);
    expect(strikeCountFor(rows, { party: "tutor", id: TUTOR_B })).toBe(1);
  });

  it("returns 0 for a subject with no strikes", () => {
    expect(
      strikeCountFor(rows, {
        party: "tutor",
        id: "33333333-3333-3333-3333-333333333333",
      }),
    ).toBe(0);
  });
});
