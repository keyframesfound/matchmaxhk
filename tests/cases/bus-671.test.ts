import { describe, expect, it } from "vitest";

import { debounceCutoffIso } from "../../src/features/cases/bus-pure";

describe("#671 burst debounce window", () => {
  it("cuts off one window back from now", () => {
    const now = new Date("2026-11-07T10:00:00.000Z");
    expect(debounceCutoffIso(now, 60_000)).toBe("2026-11-07T09:59:00.000Z");
  });

  it("a zero window disables the debounce (cutoff == now)", () => {
    const now = new Date("2026-11-07T10:00:00.000Z");
    expect(debounceCutoffIso(now, 0)).toBe(now.toISOString());
  });

  it("events strictly inside the window are collapsed, outside are kept", () => {
    const now = new Date("2026-11-07T10:00:00.000Z");
    const cutoff = new Date(debounceCutoffIso(now, 60_000)).getTime();
    // 30s old: inside the window → the insert collapses.
    expect(new Date("2026-11-07T09:59:30.000Z").getTime()).toBeGreaterThanOrEqual(cutoff);
    // 2 min old: outside → a fresh bell row is created.
    expect(new Date("2026-11-07T09:58:00.000Z").getTime()).toBeLessThan(cutoff);
  });
});
