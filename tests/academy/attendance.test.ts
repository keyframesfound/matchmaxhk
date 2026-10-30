import { describe, expect, it } from "vitest";

import {
  countSentences,
  creditBurn,
  lessonStatusFor,
  noteGateError,
  occupancyPct,
  parentSummaryMessage,
  settlementFor,
} from "@/features/academy/attendance";

const gate = {
  managed: true,
  note: "",
  skipNote: false,
  skipAlreadyUsed: false,
  adminOverride: false,
};

describe("lessonStatusFor / settlementFor", () => {
  it("maps attendance to the lesson status and the credit outcome", () => {
    expect(lessonStatusFor("present")).toBe("done");
    expect(lessonStatusFor("late")).toBe("done");
    expect(lessonStatusFor("left_early")).toBe("done");
    expect(lessonStatusFor("absent_billable")).toBe("no_show");
    expect(lessonStatusFor("absent_excused")).toBe("cancelled");
    expect(settlementFor("absent_billable")).toBe("CONSUME");
    expect(settlementFor("absent_excused")).toBe("RELEASE");
  });
});

describe("noteGateError", () => {
  it("never gates pure-matching lessons", () => {
    expect(noteGateError({ ...gate, managed: false })).toBeNull();
  });

  it("requires two sentences on managed lessons", () => {
    expect(noteGateError(gate)).toBe("NOTE_REQUIRED");
    expect(noteGateError({ ...gate, note: "Did algebra." })).toBe("NOTE_REQUIRED");
    expect(
      noteGateError({ ...gate, note: "Did algebra. Next week we start functions." }),
    ).toBeNull();
  });

  it("allows one skip per case, then blocks; admin override always passes", () => {
    expect(noteGateError({ ...gate, skipNote: true })).toBeNull();
    expect(noteGateError({ ...gate, skipNote: true, skipAlreadyUsed: true })).toBe(
      "NOTE_SKIP_USED",
    );
    expect(noteGateError({ ...gate, skipAlreadyUsed: true, adminOverride: true })).toBeNull();
  });
});

describe("countSentences", () => {
  it("counts English and Chinese sentence endings and ignores fragments", () => {
    expect(countSentences("One. Two!")).toBe(2);
    expect(countSentences("今日做咗代數。下星期開始函數。")).toBe(2);
    expect(countSentences("Ok. .")).toBe(0);
  });
});

describe("parentSummaryMessage", () => {
  it("reports attendance, note and credits left without fee talk", () => {
    const msg = parentSummaryMessage({
      studentName: "Chloe",
      tutorName: "Ms Wong",
      attendance: "late",
      note: "Covered vectors. Homework is page 12.",
      creditsLeft: 3,
    });
    expect(msg).toContain("Chloe attended today's lesson (arrived late) with Ms Wong.");
    expect(msg).toContain("Tutor's note: Covered vectors.");
    expect(msg).toContain("Lessons left: 3.");
    expect(msg.toLowerCase()).not.toContain("fee");
  });

  it("says no credit was used on an excused absence", () => {
    const msg = parentSummaryMessage({
      studentName: "Chloe",
      tutorName: "Ms Wong",
      attendance: "absent_excused",
      note: "",
      creditsLeft: 4,
    });
    expect(msg).toContain("No credit used. Lessons left: 4.");
    expect(msg).not.toContain("Tutor's note");
  });
});

describe("occupancyPct / creditBurn", () => {
  it("caps occupancy at 100 and returns 0 with no availability", () => {
    expect(occupancyPct(600, 300)).toBe(50);
    expect(occupancyPct(60, 120)).toBe(100);
    expect(occupancyPct(0, 60)).toBe(0);
  });

  it("sums CONSUME credits inside the window only", () => {
    const now = new Date("2026-10-31T00:00:00Z");
    const burn = creditBurn(
      [
        { entry_type: "CONSUME", held_delta: "-1.00", created_at: "2026-10-30T00:00:00Z" },
        { entry_type: "CONSUME", held_delta: -0.5, created_at: "2026-10-20T00:00:00Z" },
        { entry_type: "RELEASE", held_delta: "-1.00", created_at: "2026-10-30T00:00:00Z" },
        { entry_type: "CONSUME", held_delta: "-1.00", created_at: "2026-08-01T00:00:00Z" },
      ],
      now,
    );
    expect(burn).toBe(1.5);
  });
});
