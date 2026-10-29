import { describe, expect, it } from "vitest";

import {
  bellLinkFor,
  DELIVERY_MAX_ATTEMPTS,
  planDeliveriesForEvent,
  redactBellPayload,
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
    for (const t of [
      "lesson.done",
      "lesson.reminder_due",
      "lesson.review_prompt",
      "review.published",
      "admin_fee.invoiced",
    ]) {
      const res = planDeliveriesForEvent(t);
      if (res.kind === "deliver") {
        expect(
          res.deliveries.some((d) => d.channel === "email"),
          t,
        ).toBe(false);
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

  it("#387 notification leg: a logged session reaches the parent in-app only", () => {
    const res = planDeliveriesForEvent("experience.session_logged");
    expect(res.kind).toBe("deliver");
    if (res.kind === "deliver") {
      expect(res.deliveries).toEqual([{ channel: "in_app", role: "parent" }]);
    }
    // The bell item deep-links to the case page — the Dispute button lives there.
    expect(bellLinkFor("experience.session_logged", { case_id: "c1" })).toBe("/account/cases/c1");
    expect(bellLinkFor("experience.session_logged", {})).toBe("/account");
  });

  it("#503: an End Case tap prompts only the OTHER party, in-app", () => {
    // The event type names the ACTOR; the plan reaches the other side only.
    const byParent = planDeliveriesForEvent("case.end_requested_by_parent");
    expect(byParent).toEqual({
      kind: "deliver",
      deliveries: [{ channel: "in_app", role: "tutor" }],
    });
    const byTutor = planDeliveriesForEvent("case.end_requested_by_tutor");
    expect(byTutor).toEqual({
      kind: "deliver",
      deliveries: [{ channel: "in_app", role: "parent" }],
    });
    // Deep links: the tutor lands on their Schedule hub, the parent on the case.
    expect(bellLinkFor("case.end_requested_by_parent", { case_id: "c1" }, "tutor")).toBe(
      "/dashboard#lessons",
    );
    expect(bellLinkFor("case.end_requested_by_tutor", { case_id: "c1" }, "parent")).toBe(
      "/account/cases/c1",
    );
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

  it("tutor bell items link to the tutor surface, never the parent case route (#375 QA)", () => {
    const payload = { case_id: "c1", lesson_id: "l1", starts_at: "2026-10-19T08:00:00Z" };
    expect(bellLinkFor("lesson.reminder_due", payload, "tutor")).toBe("/dashboard#lessons");
    expect(bellLinkFor("lesson.reminder_due", payload, "parent")).toBe("/account/cases/c1");
    // review.published carries no tutor_slug from the trigger — a tutor lands
    // on their Lessons tab, not the parent-owned /account/cases route.
    expect(bellLinkFor("review.published", { case_id: "c1" }, "tutor")).toBe("/dashboard#lessons");
    expect(bellLinkFor("review.published", { case_id: "c1" }, "parent")).toBe("/account/cases/c1");
    expect(bellLinkFor("review.published", { tutor_slug: "me" }, "tutor")).toBe("/tutors/me");
  });

  it("redacts tutor-side money from the buyer's bell payload (#375 back-end)", () => {
    const payload = {
      order_id: "o1",
      material_id: "m1",
      tutor_id: "t1",
      buyer_account_id: "b1",
      gross_hkd: 500,
      tutor_net_hkd: 400,
    };
    const forBuyer = redactBellPayload("note_order.delivered", payload, "parent");
    expect(forBuyer).not.toHaveProperty("tutor_net_hkd");
    expect(forBuyer).not.toHaveProperty("gross_hkd");
    expect(forBuyer).toMatchObject({ order_id: "o1", material_id: "m1" });

    const forTutor = redactBellPayload("note_order.delivered", payload, "tutor");
    expect(forTutor).toMatchObject({ gross_hkd: 500, tutor_net_hkd: 400 });

    // Non-delivery events are untouched for every role.
    expect(redactBellPayload("admin_fee.invoiced", { amount_hkd: 750 }, "parent")).toEqual({
      amount_hkd: 750,
    });
  });
});
