import { describe, expect, it } from "vitest";

import { decideNoteUpsell } from "../../src/features/materials/note-tutor-upsell";

const base = {
  isOwner: false,
  isCommunitySeller: false,
  tutorCode: "MM-T040",
  tutorTakingStudents: true,
  noteSubject: "Mathematics",
  viewerCases: [],
};

describe("#731 note → 1-on-1 upsell", () => {
  it("shows for an independent tutor taking students", () => {
    expect(decideNoteUpsell(base)).toBe("show");
  });

  it("hides for community sellers, own listings and full tutors", () => {
    expect(decideNoteUpsell({ ...base, isCommunitySeller: true })).toBe("hidden");
    expect(decideNoteUpsell({ ...base, isOwner: true })).toBe("hidden");
    expect(decideNoteUpsell({ ...base, tutorTakingStudents: false })).toBe("hidden");
  });

  it("hides when the viewer has an active case in that subject with another tutor", () => {
    expect(
      decideNoteUpsell({
        ...base,
        viewerCases: [{ subject: "Mathematics", tutorCode: "MM-T001", sorStatus: "active" }],
      }),
    ).toBe("hidden");
  });

  it("shows for a different subject, and ignores closed cases", () => {
    expect(
      decideNoteUpsell({
        ...base,
        viewerCases: [
          { subject: "English", tutorCode: "MM-T001", sorStatus: "active" },
          { subject: "Mathematics", tutorCode: "MM-T001", sorStatus: "closed" },
        ],
      }),
    ).toBe("show");
  });

  it("marks the viewer's current tutor instead of a new booking", () => {
    expect(
      decideNoteUpsell({
        ...base,
        viewerCases: [{ subject: "Mathematics", tutorCode: "mm-t040", sorStatus: "fee_paid" }],
      }),
    ).toBe("current_tutor");
  });
});
