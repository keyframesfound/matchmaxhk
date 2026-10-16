import { describe, expect, it } from "vitest";

import {
  formatAvailabilityDate,
  getTutorAvailabilityState,
  getTutorInquiryAction,
} from "../../src/features/tutors/tutor-display";

/**
 * Epic #280 P5: owner-controlled availability state drives the public
 * Request-tutor CTA. Full/Inactive must render a status chip (kind "status"),
 * never a WhatsApp/deep-link button.
 */

const base = {
  is_accepting_students: true as boolean | null,
  remaining_student_slots: 2 as number | null,
};

describe("getTutorAvailabilityState", () => {
  it("taking when accepting with slots", () => {
    expect(
      getTutorAvailabilityState({ is_accepting_students: true, remaining_student_slots: 2 }),
    ).toBe("taking");
  });

  it("full at the cap (0 slots)", () => {
    expect(
      getTutorAvailabilityState({ is_accepting_students: true, remaining_student_slots: 0 }),
    ).toBe("full");
  });

  it("inactive overrides slots (owner paused the card)", () => {
    expect(
      getTutorAvailabilityState({ is_accepting_students: false, remaining_student_slots: 3 }),
    ).toBe("inactive");
    expect(
      getTutorAvailabilityState({ is_accepting_students: false, remaining_student_slots: 0 }),
    ).toBe("inactive");
  });

  it("null slots counts as taking unless paused", () => {
    expect(
      getTutorAvailabilityState({ is_accepting_students: true, remaining_student_slots: null }),
    ).toBe("taking");
  });
});

describe("getTutorInquiryAction status kind (P5)", () => {
  const tutor = {
    tutor_code: "MM-T129",
    start_immediately: true,
    earliest_start_date: null,
    lesson_mode: "either" as const,
    ...base,
  };

  it("full renders a status chip, not a link", () => {
    const action = getTutorInquiryAction(
      { ...tutor, remaining_student_slots: 0 },
      "85212345678",
      "en",
    );
    expect(action.kind).toBe("status");
    expect(action.href).toBe("");
    expect(action.label).toBe("Full");
  });

  it("inactive renders a status chip, not a link", () => {
    const action = getTutorInquiryAction(
      { ...tutor, is_accepting_students: false },
      "85212345678",
      "en",
    );
    expect(action.kind).toBe("status");
    expect(action.label).toBe("Inactive");
  });

  it("taking tutors keep the request action", () => {
    const action = getTutorInquiryAction(tutor, "85212345678", "en");
    expect(action.kind).toBe("request");
    expect(action.href).toContain("wa.me");
  });
});
