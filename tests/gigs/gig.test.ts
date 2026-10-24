/**
 * Freestyle gig helpers (#326/#327/#328/#329): submit validation, integrity
 * merge semantics, red-flag hints, the #328 fulfillment clock + order state
 * machine, completion-note filtering, and the money/bought-count rules.
 * Pure helpers only — server fns are not testable end-to-end.
 */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_TURNAROUND_HOURS,
  GIG_CATEGORIES,
  GIG_DELIVERY_TYPES,
  UPHELD_CONTACT_REPORTS_TO_PAUSE_GIGS,
  canParentRequestRefund,
  countsTowardBoughtCount,
  findIntegrityRedFlags,
  gigFulfillmentDueAt,
  gigFreestylePrivilegePaused,
  gigOrderBuyerAction,
  gigPastDueCutoff,
  mergeGigIntegrity,
  splitGigMoney,
  transitionGigOrder,
  validateCompletionNote,
  validateGigForSubmit,
  validateGigPartial,
} from "../../src/features/gigs/gig";

const CLEAN_SUBMIT = {
  title: "IB Physics IA review — 48h turnaround",
  description: "Rubric annotations and conceptual feedback on one IA draft.",
  priceHkd: 250,
  category: "document_review",
  deliveryType: "file_back",
  turnaroundNote: "48 hours",
  turnaroundHours: 48,
  hasCover: true,
  integrityConfirmed: true,
};

describe("validateGigForSubmit", () => {
  it("accepts a clean document_review submission", () => {
    expect(validateGigForSubmit(CLEAN_SUBMIT)).toEqual([]);
  });

  it("requires a title within 80 characters", () => {
    const short = validateGigForSubmit({ ...CLEAN_SUBMIT, title: "ab" });
    expect(short.some((e) => e.includes("Title"))).toBe(true);

    const long = validateGigForSubmit({ ...CLEAN_SUBMIT, title: "x".repeat(81) });
    expect(long.some((e) => e.includes("80 characters"))).toBe(true);
  });

  it("requires a description within 2000 characters", () => {
    const missing = validateGigForSubmit({ ...CLEAN_SUBMIT, description: "   " });
    expect(missing.some((e) => e.includes("Description is required"))).toBe(true);

    const long = validateGigForSubmit({ ...CLEAN_SUBMIT, description: "x".repeat(2001) });
    expect(long.some((e) => e.includes("2000 characters"))).toBe(true);
  });

  it("requires a whole-HKD price of at least HK$1 (no free gigs in v1)", () => {
    for (const priceHkd of [null, 0, -5, 12.5, Number.NaN]) {
      const errors = validateGigForSubmit({ ...CLEAN_SUBMIT, priceHkd });
      expect(errors.some((e) => e.includes("whole HK$"))).toBe(true);
    }
    expect(validateGigForSubmit({ ...CLEAN_SUBMIT, priceHkd: 1 })).toEqual([]);
  });

  it("rejects unknown category and delivery type", () => {
    const badCategory = validateGigForSubmit({ ...CLEAN_SUBMIT, category: "examiner_payroll" });
    expect(badCategory.some((e) => e.includes("Category"))).toBe(true);

    const badDelivery = validateGigForSubmit({ ...CLEAN_SUBMIT, deliveryType: "zoom_call" });
    expect(badDelivery.some((e) => e.includes("Delivery type"))).toBe(true);
  });

  it("requires a cover image before pending_review", () => {
    const errors = validateGigForSubmit({ ...CLEAN_SUBMIT, hasCover: false });
    expect(errors.some((e) => e.includes("cover image"))).toBe(true);
  });

  it("#330: rejects contact details in the buyer-visible turnaround note", () => {
    const phone = validateGigForSubmit({
      ...CLEAN_SUBMIT,
      turnaroundNote: "Message me at 9123 4567 first",
    });
    expect(phone.some((e) => e.includes("No contact details"))).toBe(true);

    const channel = validateGigForSubmit({
      ...CLEAN_SUBMIT,
      turnaroundNote: "WhatsApp me after payment",
    });
    expect(channel.some((e) => e.includes("No contact details"))).toBe(true);

    expect(validateGigForSubmit({ ...CLEAN_SUBMIT, turnaroundNote: "48 hours" })).toEqual([]);
    expect(validateGigForSubmit({ ...CLEAN_SUBMIT, turnaroundNote: null })).toEqual([]);
  });

  it("gates document_review behind the integrity checkbox only", () => {
    const without = validateGigForSubmit({ ...CLEAN_SUBMIT, integrityConfirmed: false });
    expect(without.some((e) => e.includes("academic-integrity"))).toBe(true);

    const otherCategory = validateGigForSubmit({
      ...CLEAN_SUBMIT,
      category: "other",
      integrityConfirmed: undefined,
    });
    expect(otherCategory).toEqual([]);
  });

  it("enforces turnaround caps", () => {
    const noteTooLong = validateGigForSubmit({
      ...CLEAN_SUBMIT,
      turnaroundNote: "x".repeat(41),
    });
    expect(noteTooLong.some((e) => e.includes("Turnaround"))).toBe(true);

    const hoursOutOfRange = validateGigForSubmit({ ...CLEAN_SUBMIT, turnaroundHours: 400 });
    expect(hoursOutOfRange.some((e) => e.includes("between 1 and 336"))).toBe(true);
  });
});

describe("validateGigPartial", () => {
  it("passes on empty input (draft saves may omit everything)", () => {
    expect(validateGigPartial({})).toEqual([]);
  });

  it("still rejects bad enums and cap overruns on partial saves", () => {
    expect(validateGigPartial({ category: "seats", title: "x".repeat(81) }).length).toBe(2);
    expect(validateGigPartial({ priceHkd: -1 }).length).toBe(1);
    expect(validateGigPartial({ deliveryType: "chat" }).length).toBe(1);
  });
});

describe("mergeGigIntegrity", () => {
  it("timestamps a document_review confirmation", () => {
    const merged = mergeGigIntegrity({ category: "document_review", integrityConfirmed: true });
    expect(merged.category).toBe("document_review");
    expect(merged.integrityConfirmedAt).toBeTruthy();
  });

  it("clears when the category moves away from document_review", () => {
    const merged = mergeGigIntegrity(
      { category: "speaking_mock" },
      { category: "document_review", integrityConfirmedAt: "2026-10-01T00:00:00Z" },
    );
    expect(merged.integrityConfirmedAt).toBeNull();
  });

  it("keeps an existing timestamp on undefined and clears on explicit false", () => {
    const existing = { category: "document_review", integrityConfirmedAt: "2026-10-01T00:00:00Z" };
    expect(mergeGigIntegrity({ category: "document_review" }, existing).integrityConfirmedAt).toBe(
      "2026-10-01T00:00:00Z",
    );
    expect(
      mergeGigIntegrity({ category: "document_review", integrityConfirmed: false }, existing)
        .integrityConfirmedAt,
    ).toBeNull();
  });
});

describe("findIntegrityRedFlags", () => {
  it("flags seat scarcity, recruiting, and ghostwriting copy", () => {
    expect(findIntegrityRedFlags("Only 8 seats left, enrol closes Friday!").length).toBeGreaterThan(
      0,
    );
    expect(findIntegrityRedFlags("We are hiring tutors for our team").length).toBeGreaterThan(0);
    expect(findIntegrityRedFlags("I'll write your IA for a 7").length).toBeGreaterThan(0);
    expect(findIntegrityRedFlags("guaranteed grade via rewrite").length).toBeGreaterThan(0);
  });

  it("leaves honest copy clean", () => {
    expect(
      findIntegrityRedFlags("Structural feedback and rubric annotations on your draft."),
    ).toEqual([]);
    expect(findIntegrityRedFlags("")).toEqual([]);
  });
});

describe("fulfillment clock (#328)", () => {
  it("defaults to 48 hours when no turnaround is stated", () => {
    const paidAt = new Date("2026-10-17T10:00:00Z");
    const due = gigFulfillmentDueAt(paidAt, null);
    expect(due.getTime() - paidAt.getTime()).toBe(DEFAULT_TURNAROUND_HOURS * 60 * 60 * 1000);
  });

  it("honours the stated turnaround hours", () => {
    const paidAt = new Date("2026-10-17T10:00:00Z");
    const due = gigFulfillmentDueAt(paidAt, 24);
    expect(due.toISOString()).toBe("2026-10-18T10:00:00.000Z");
  });

  it("adds the 24h grace for the past_due cutoff", () => {
    const due = new Date("2026-10-18T10:00:00Z");
    expect(gigPastDueCutoff(due).toISOString()).toBe("2026-10-19T10:00:00.000Z");
  });
});

describe("gig order state machine (#328)", () => {
  it("moves awaiting_payment to in_fulfillment when staff mark paid", () => {
    expect(transitionGigOrder("awaiting_payment", "mark_paid")).toBe("in_fulfillment");
    expect(transitionGigOrder("in_fulfillment", "mark_paid")).toBeNull();
  });

  it("delivers from in_fulfillment and from past_due (late delivery allowed)", () => {
    expect(transitionGigOrder("in_fulfillment", "deliver")).toBe("delivered");
    expect(transitionGigOrder("past_due", "deliver")).toBe("delivered");
    expect(transitionGigOrder("awaiting_payment", "deliver")).toBeNull();
  });

  it("sweeps only in_fulfillment orders to past_due", () => {
    expect(transitionGigOrder("in_fulfillment", "sweep_past_due")).toBe("past_due");
    expect(transitionGigOrder("delivered", "sweep_past_due")).toBeNull();
  });

  it("lets the parent self-serve refund from past_due only", () => {
    expect(transitionGigOrder("past_due", "request_refund")).toBe("refunded");
    expect(transitionGigOrder("in_fulfillment", "request_refund")).toBeNull();
    expect(canParentRequestRefund("past_due")).toBe(true);
    expect(canParentRequestRefund("in_fulfillment")).toBe(false);
  });

  it("lets staff refund at any pre-refunded stage", () => {
    for (const status of ["awaiting_payment", "in_fulfillment", "past_due", "delivered"]) {
      expect(transitionGigOrder(status, "staff_refund")).toBe("refunded");
    }
    expect(transitionGigOrder("refunded", "staff_refund")).toBeNull();
  });

  it("rejects payments only while awaiting", () => {
    expect(transitionGigOrder("awaiting_payment", "reject_payment")).toBe("rejected");
    expect(transitionGigOrder("in_fulfillment", "reject_payment")).toBeNull();
  });
});

describe("buyer action mapping", () => {
  it("maps each gig status to the buyer control", () => {
    expect(gigOrderBuyerAction("awaiting_payment")).toBe("pay");
    expect(gigOrderBuyerAction("rejected")).toBe("pay");
    expect(gigOrderBuyerAction("in_fulfillment")).toBe("awaiting_delivery");
    expect(gigOrderBuyerAction("past_due")).toBe("request_refund");
    expect(gigOrderBuyerAction("delivered")).toBe("download");
    expect(gigOrderBuyerAction("refunded")).toBe("refunded");
  });
});

describe("completion notes (#328)", () => {
  it("accepts a clean short note", () => {
    expect(validateCompletionNote("Session done — recording summary in the file.")).toEqual([]);
  });

  it("rejects notes over 300 characters", () => {
    expect(validateCompletionNote("x".repeat(301)).length).toBe(1);
  });

  it("always runs the contact filter", () => {
    const errors = validateCompletionNote("Done! Email me at tutor@example.com for more.");
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("money and bought counts", () => {
  it("splits money exactly like notes (20% platform fee)", () => {
    expect(splitGigMoney(500)).toEqual({ platformFeeHkd: 100, tutorNetHkd: 400 });
    expect(splitGigMoney(33)).toEqual({ platformFeeHkd: 6.6, tutorNetHkd: 26.4 });
  });

  it("counts only delivered orders toward the public bought figure (#329)", () => {
    expect(countsTowardBoughtCount("delivered")).toBe(true);
    for (const status of [
      "awaiting_payment",
      "in_fulfillment",
      "past_due",
      "refunded",
      "rejected",
    ]) {
      expect(countsTowardBoughtCount(status)).toBe(false);
    }
  });
});

describe("taxonomy constants", () => {
  it("exposes the four categories and three delivery types", () => {
    expect(GIG_CATEGORIES).toEqual([
      "document_review",
      "speaking_mock",
      "workshop_package",
      "other",
    ]);
    expect(GIG_DELIVERY_TYPES).toEqual(["file_back", "session_confirm", "package_handoff"]);
  });
});

describe("freestyle privilege pause (#330)", () => {
  it("pauses only after the second upheld contact report", () => {
    expect(gigFreestylePrivilegePaused(0)).toBe(false);
    expect(gigFreestylePrivilegePaused(1)).toBe(false);
    expect(gigFreestylePrivilegePaused(UPHELD_CONTACT_REPORTS_TO_PAUSE_GIGS)).toBe(true);
    expect(gigFreestylePrivilegePaused(5)).toBe(true);
  });
});
