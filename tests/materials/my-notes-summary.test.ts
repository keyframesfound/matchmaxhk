/**
 * Tests for the #202 tutor-home notes summary (PR #384 review blocker):
 * the server fn's tutor-card lookup must use .maybeSingle() (a bare
 * .eq() filter resolves an ARRAY, which silently zeroed the summary), and
 * the counting core summarizeMyNotesOrders must give a linked tutor with a
 * delivered order a non-zero delivered count and net.
 */
import { describe, expect, it } from "vitest";

import { summarizeMyNotesOrders } from "../../src/features/materials/orders.functions";

// Fixed clock: 2026-10-19T04:00:00Z = 2026-10-19 12:00 HKT → month 2026-10.
const NOW = new Date("2026-10-19T04:00:00Z");

function row(overrides: {
  delivered_at: string;
  tutor_net_hkd?: number | string;
  is_grant?: boolean;
}) {
  return {
    delivered_at: overrides.delivered_at,
    tutor_net_hkd: overrides.tutor_net_hkd ?? 0,
    is_grant: overrides.is_grant ?? false,
  };
}

describe("summarizeMyNotesOrders — #202 notes block", () => {
  it("returns zeros with no rows", () => {
    expect(summarizeMyNotesOrders([], NOW)).toEqual({
      deliveredThisMonth: 0,
      netOwedHkd: 0,
    });
  });

  it("counts a delivered in-month order: non-zero count AND net", () => {
    const summary = summarizeMyNotesOrders(
      [row({ delivered_at: "2026-10-15T03:00:00Z", tutor_net_hkd: 120 })],
      NOW,
    );
    // 2026-10-15 11:00 HKT — inside the current HKT month.
    expect(summary.deliveredThisMonth).toBe(1);
    expect(summary.netOwedHkd).toBe(120);
  });

  it("grant rows count as deliveries but add nothing to net", () => {
    const summary = summarizeMyNotesOrders(
      [
        row({ delivered_at: "2026-10-15T03:00:00Z", tutor_net_hkd: 120 }),
        row({ delivered_at: "2026-10-16T01:00:00Z", is_grant: true, tutor_net_hkd: 0 }),
      ],
      NOW,
    );
    expect(summary.deliveredThisMonth).toBe(2);
    expect(summary.netOwedHkd).toBe(120);
  });

  it("out-of-month deliveries stay out of the count but remain in all-time net", () => {
    const summary = summarizeMyNotesOrders(
      [
        row({ delivered_at: "2026-10-15T03:00:00Z", tutor_net_hkd: 120 }),
        row({ delivered_at: "2026-09-25T10:00:00Z", tutor_net_hkd: 80 }),
      ],
      NOW,
    );
    expect(summary.deliveredThisMonth).toBe(1);
    expect(summary.netOwedHkd).toBe(200);
  });

  it("the window is HKT-based: 30 Sep 16:30Z is an October delivery, 31 Oct 16:30Z is not", () => {
    const summary = summarizeMyNotesOrders(
      [
        // 2026-10-01 00:30 HKT → first minute of the month counts.
        row({ delivered_at: "2026-09-30T16:30:00Z", tutor_net_hkd: 50 }),
        // 2026-11-01 00:30 HKT → next month, must NOT count.
        row({ delivered_at: "2026-10-31T16:30:00Z", tutor_net_hkd: 70 }),
      ],
      NOW,
    );
    expect(summary.deliveredThisMonth).toBe(1);
    expect(summary.netOwedHkd).toBe(120);
  });

  it("rounds the net to whole cents", () => {
    const summary = summarizeMyNotesOrders(
      [
        row({ delivered_at: "2026-10-15T03:00:00Z", tutor_net_hkd: 20.005 }),
        row({ delivered_at: "2026-10-16T03:00:00Z", tutor_net_hkd: 20.005 }),
      ],
      NOW,
    );
    expect(summary.netOwedHkd).toBe(40.01);
  });
});
