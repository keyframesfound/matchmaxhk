import { describe, expect, it } from "vitest";

import { canClaimDelivery } from "../../src/features/cases/bus";

const NOW = Date.parse("2026-11-27T08:00:00Z");
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

describe("canClaimDelivery — resend-loop guard (2026-11-27)", () => {
  it("allows a pending delivery", () => {
    expect(canClaimDelivery("pending", null, NOW)).toBe(true);
  });

  it("allows a sent delivery row to be re-checked (no resend by caller)", () => {
    expect(canClaimDelivery("sent", null, NOW)).toBe(true);
  });

  it("blocks a fresh in-flight claim", () => {
    expect(canClaimDelivery("sending", minutesAgo(1), NOW)).toBe(false);
  });

  it("retakes a stale claim from a dead worker", () => {
    expect(canClaimDelivery("sending", minutesAgo(11), NOW)).toBe(true);
  });

  it("treats a claimless sending row as claimable", () => {
    expect(canClaimDelivery("sending", null, NOW)).toBe(true);
  });
});
