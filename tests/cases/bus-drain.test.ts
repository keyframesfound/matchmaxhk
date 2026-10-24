import { describe, expect, it } from "vitest";

import {
  eventKey,
  MAX_DELIVERY_ATTEMPTS,
  nextDeliveryStatus,
  shouldCreateConciergeDigest,
  shouldCreateParentFeeReminder,
  shouldCreateReminder,
  shouldCreateReviewPrompt,
} from "../../src/features/cases/bus-pure";
import { hktFromParts, reminderDueAt } from "../../src/features/cases/sor";

// Lesson at 2026-10-21 16:00 HKT.
const LESSON_AT = hktFromParts("2026-10-21", 16 * 60);
const lesson = (status: string, startsAt = LESSON_AT) => ({
  id: "l1",
  starts_at: startsAt.toISOString(),
  status,
});

describe("reminder generation (#204 day-before 18:00 HKT)", () => {
  const dueAt = reminderDueAt(LESSON_AT); // 2026-10-20 18:00 HKT

  it("fires from 18:00 HKT the day before until start, once per lesson", () => {
    const keys = new Set<string>();
    expect(shouldCreateReminder(lesson("confirmed"), new Date(dueAt.getTime() - 1), keys)).toBe(
      false,
    );
    expect(shouldCreateReminder(lesson("confirmed"), dueAt, keys)).toBe(true);
    // Idempotent: the existing event key blocks a second creation.
    keys.add(eventKey("lesson.reminder_due", "l1"));
    expect(shouldCreateReminder(lesson("confirmed"), dueAt, keys)).toBe(false);
  });

  it("never reminds after the lesson started, and not for dead statuses", () => {
    expect(
      shouldCreateReminder(lesson("confirmed"), new Date(LESSON_AT.getTime() + 1), new Set()),
    ).toBe(false);
    expect(shouldCreateReminder(lesson("cancelled"), dueAt, new Set())).toBe(false);
    expect(shouldCreateReminder(lesson("done"), dueAt, new Set())).toBe(false);
  });
});

describe("review prompt gate (#205 one prompt, 2h delay)", () => {
  const doneAt = new Date("2026-10-20T10:00:00Z");
  const doneEvent = {
    id: "e1",
    payload: { lesson_id: "l1", case_id: "c1" },
    created_at: doneAt.toISOString(),
  };

  it("waits 2 hours, then fires once when no review exists", () => {
    const keys = new Set<string>();
    const tooEarly = new Date(doneAt.getTime() + 2 * 3600000 - 1);
    const onTime = new Date(doneAt.getTime() + 2 * 3600000);
    expect(shouldCreateReviewPrompt(doneEvent, tooEarly, false, keys)).toBe(false);
    expect(shouldCreateReviewPrompt(doneEvent, onTime, false, keys)).toBe(true);
    keys.add(eventKey("lesson.review_prompt", "l1"));
    expect(shouldCreateReviewPrompt(doneEvent, onTime, false, keys)).toBe(false);
  });

  it("never fires when a review already exists for the lesson", () => {
    expect(
      shouldCreateReviewPrompt(
        doneEvent,
        new Date(doneAt.getTime() + 3 * 3600000),
        true,
        new Set(),
      ),
    ).toBe(false);
  });

  it("skips malformed payloads", () => {
    expect(
      shouldCreateReviewPrompt(
        { id: "e2", payload: {}, created_at: doneAt.toISOString() },
        new Date(),
        false,
        new Set(),
      ),
    ).toBe(false);
  });
});

describe("parent fee reminders (#205 day 3 and day 7)", () => {
  const invoicedAt = new Date("2026-10-01T02:00:00Z");
  const dueAt = new Date(invoicedAt.getTime() + 3 * 86400000); // day 3
  const fee = { id: "f1", due_at: dueAt.toISOString(), status: "invoiced" };

  it("no reminder before due", () => {
    expect(shouldCreateParentFeeReminder(fee, new Date(dueAt.getTime() - 1), null)).toBeNull();
  });

  it("day 3 at due, day 7 four days later, no repeats", () => {
    expect(shouldCreateParentFeeReminder(fee, dueAt, null)).toEqual({ day: 3 });
    expect(shouldCreateParentFeeReminder(fee, dueAt, 3)).toBeNull(); // already reminded
    const day7 = new Date(dueAt.getTime() + 4 * 86400000);
    expect(shouldCreateParentFeeReminder(fee, day7, 3)).toEqual({ day: 7 });
    expect(shouldCreateParentFeeReminder(fee, day7, 7)).toBeNull();
  });

  it("waived/paid fees never remind", () => {
    expect(shouldCreateParentFeeReminder({ ...fee, status: "paid" }, dueAt, null)).toBeNull();
    expect(shouldCreateParentFeeReminder({ ...fee, status: "waived" }, dueAt, null)).toBeNull();
  });
});

describe("concierge digest dedupe", () => {
  const now = new Date("2026-10-17T09:00:00Z");
  it("fires when unpaid fees exist and none sent in 24h", () => {
    expect(shouldCreateConciergeDigest(2, null, now)).toBe(true);
    expect(shouldCreateConciergeDigest(1, new Date(now.getTime() - 25 * 3600000), now)).toBe(true);
  });
  it("stays quiet within 24h or with nothing unpaid", () => {
    expect(shouldCreateConciergeDigest(1, new Date(now.getTime() - 2 * 3600000), now)).toBe(false);
    expect(shouldCreateConciergeDigest(0, null, now)).toBe(false);
  });
});

describe("delivery retry policy (#205 retries 3 then failed)", () => {
  it("success -> sent; <3 failures -> pending; 3rd failure -> failed", () => {
    expect(nextDeliveryStatus(0, true)).toBe("sent");
    expect(nextDeliveryStatus(0, false)).toBe("pending");
    expect(nextDeliveryStatus(1, false)).toBe("pending");
    expect(nextDeliveryStatus(2, false)).toBe("failed");
    expect(MAX_DELIVERY_ATTEMPTS).toBe(3);
  });
});
