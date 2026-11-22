import { describe, expect, it } from "vitest";

import { isTutorPoolRequest } from "../../src/features/cases/centre-request-rules";

describe("#815 §2.8 one named student, no tutor pools (AC-C1-1)", () => {
  it("rejects requests for several tutors", () => {
    for (const text of [
      "We need 5 tutors for our summer programme",
      "Looking for a pool of tutors",
      "please send several tutors",
      "想搵五位導師",
      "需要幾位老師",
      "建立導師團隊",
    ]) {
      expect(isTutorPoolRequest(text), text).toBe(true);
    }
  });

  it("allows an ordinary one-student request", () => {
    for (const text of [
      "Chloe needs help with IB Chemistry HL paper 2",
      "Her previous tutor left in September",
      "學生需要一位導師教 DSE 數學",
      "Two lessons a week, Tuesday and Thursday",
    ]) {
      expect(isTutorPoolRequest(text), text).toBe(false);
    }
  });
});
