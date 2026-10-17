import { describe, expect, it } from "vitest";

import {
  bellLinkFor,
  DELIVERY_MAX_ATTEMPTS,
  planDeliveriesForEvent,
  REVIEW_PROMPT_DELAY_MS,
  SKIPPED_EVENT_TYPES,
} from "../../src/features/cases/bus";

describe("bus planning (#205/#292)", () => {
  it("plans in-app for the bell events", () => {
    const res = planDeliveriesForEvent("note_order.delivered");
    expect(res.kind).toBe("deliver");
    if (res.kind === "deliver") {
      expect(res.deliveries).toContainEqual({ channel: "in_app", role: "tutor" });
      expect(res.deliveries).toContainEqual({ channel: "in_app", role: "parent" });
      // No buyer contact leaks: the tutor delivery is just a role target.
    }
  });

  it("email only for fee-unpaid and order-delivered", () => {
    for (const t of ["lesson.done", "lesson.reminder_due", "lesson.review_prompt", "review.published", "admin_fee.invoiced"]) {
      const res = planDeliveriesForEvent(t);
      if (res.kind === "deliver") {
        expect(res.deliveries.some((d) => d.channel === "email"), t).toBe(false);
      }
    }
    expect(planDeliveriesForEvent("note_order.delivered")).toMatchObject({ kind: "deliver" });
    expect(planDeliveriesForEvent("admin_fee.unpaid")).toMatchObject({ kind: "deliver" });
  });

  it("stores unconsumed known types as skipped", () => {
    for (const t of SKIPPED_EVENT_TYPES) {
      expect(planDeliveriesForEvent(t)).toEqual({ kind: "skip" });
    }
  });

  it("lesson.done itself produces no direct message (its consumer is the review prompt)", () => {
    expect(planDeliveriesForEvent("lesson.done")).toEqual({ kind: "skip" });
  });

  it("unknown types are unknown (stored failed, not dropped)", () => {
    expect(planDeliveriesForEvent("marketing.blast")).toEqual({ kind: "unknown" });
    expect(planDeliveriesForEvent("discord.invite")).toEqual({ kind: "unknown" });
  });

  it("retry policy is 3 attempts then failed", () => {
    expect(DELIVERY_MAX_ATTEMPTS).toBe(3);
  });

  it("review prompt delay is 2 hours", () => {
    expect(REVIEW_PROMPT_DELAY_MS).toBe(2 * 60 * 60 * 1000);
  });

  it("bell links open the related page", () => {
    expect(bellLinkFor("note_order.delivered", { order_id: "o1" })).toBe("/orders/o1");
    expect(bellLinkFor("lesson.review_prompt", { case_id: "c1" })).toBe("/account/cases/c1#review");
    expect(bellLinkFor("admin_fee.unpaid", { case_id: "c1" })).toBe("/account/cases/c1");
    expect(bellLinkFor("review.published", { tutor_slug: "someone" })).toBe("/tutors/someone");
    expect(bellLinkFor("listing.saved", {})).toBeNull();
  });

  it("never plans a save ping (#292: someone saved your note is not an event)", () => {
    expect(planDeliveriesForEvent("listing.saved")).toEqual({ kind: "skip" });
  });
});
