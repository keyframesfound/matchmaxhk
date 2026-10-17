/**
 * Staff-slice pure helpers for freestyle gigs (#326/#328): the FPS-confirm
 * patch (fail-safe clock stamping), the ghost-strike reason/shaping rules,
 * and the document_review approval blocker the review queue enforces
 * server-side. Pure-helper design — server fns are not testable end-to-end
 * (see tests/materials/checkout-gates.test.ts for the precedent).
 */
import { describe, expect, it } from "vitest";

import {
  buildGhostStrikeReason,
  buildGigPaidPatch,
  gigApprovalBlocker,
  shouldStrikeOnStaffRefund,
} from "../../src/features/gigs/gig-staff.functions";

const NOW = new Date("2026-10-17T09:00:00.000Z");

describe("buildGigPaidPatch", () => {
  it("stamps in_fulfillment with the listing's stated turnaround", () => {
    const patch = buildGigPaidPatch({
      now: NOW,
      turnaroundHours: 24,
      userId: "staff-1",
      fpsReference: "FPS-12345",
    });
    expect(patch.status).toBe("in_fulfillment");
    expect(patch.paid_at).toBe(NOW.toISOString());
    expect(patch.in_fulfillment_at).toBe(NOW.toISOString());
    expect(patch.marked_by).toBe("staff-1");
    expect(patch.fps_reference).toBe("FPS-12345");
    expect(patch.fulfillment_due_at).toBe(new Date(NOW.getTime() + 24 * 3600_000).toISOString());
  });

  it("falls back to the 48h default when the listing has no clock", () => {
    const none = buildGigPaidPatch({
      now: NOW,
      turnaroundHours: null,
      userId: "staff-1",
      fpsReference: "FPS-1",
    });
    expect(none.fulfillment_due_at).toBe(new Date(NOW.getTime() + 48 * 3600_000).toISOString());

    const junk = buildGigPaidPatch({
      now: NOW,
      turnaroundHours: 0,
      userId: "staff-1",
      fpsReference: "FPS-1",
    });
    expect(junk.fulfillment_due_at).toBe(none.fulfillment_due_at);
  });

  it("never touches the money columns (the split rides from checkout)", () => {
    const patch = buildGigPaidPatch({
      now: NOW,
      turnaroundHours: 72,
      userId: "staff-1",
      fpsReference: "FPS-1",
    });
    expect(Object.keys(patch)).not.toContain("gross_hkd");
    expect(Object.keys(patch)).not.toContain("tutor_net_hkd");
    expect(Object.keys(patch)).not.toContain("platform_fee_hkd");
  });
});

describe("buildGhostStrikeReason", () => {
  it("prefixes the fail-safe context onto the staff reason", () => {
    expect(buildGhostStrikeReason("Tutor never delivered the IA review")).toBe(
      "Past-due refund: Tutor never delivered the IA review",
    );
  });

  it("keeps a bare context when staff add nothing usable", () => {
    expect(buildGhostStrikeReason("   ")).toBe("Past-due refund");
    expect(buildGhostStrikeReason("")).toBe("Past-due refund");
  });
});

describe("shouldStrikeOnStaffRefund", () => {
  it("strikes only orders the sweep already flipped to past_due", () => {
    expect(shouldStrikeOnStaffRefund("2026-10-17T09:00:00.000Z")).toBe(true);
    expect(shouldStrikeOnStaffRefund(null)).toBe(false);
  });
});

describe("gigApprovalBlocker", () => {
  it("blocks a document_review gig without the integrity confirmation", () => {
    const blocker = gigApprovalBlocker({
      materialType: "gig",
      gigCategory: "document_review",
      integrityConfirmedAt: null,
    });
    expect(blocker).toContain("academic-integrity confirmation");
  });

  it("allows a document_review gig with the confirmation on file", () => {
    expect(
      gigApprovalBlocker({
        materialType: "gig",
        gigCategory: "document_review",
        integrityConfirmedAt: "2026-10-17T09:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("never demands integrity on non-document gig categories", () => {
    for (const gigCategory of ["speaking_mock", "workshop_package", "other"]) {
      expect(
        gigApprovalBlocker({ materialType: "gig", gigCategory, integrityConfirmedAt: null }),
      ).toBeNull();
    }
  });

  it("refuses to run on non-gig listings", () => {
    const blocker = gigApprovalBlocker({
      materialType: "notes",
      gigCategory: null,
      integrityConfirmedAt: null,
    });
    expect(blocker).toContain("not a gig");
  });
});
