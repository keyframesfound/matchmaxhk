import { describe, expect, it } from "vitest";

import { generateSlots, lessonConflicts } from "../../src/features/cases/slot";
import { hktFromParts } from "../../src/features/cases/sor";

// Tutor window: Mon 16:00–20:00 HKT (minutes 960–1200), Admiralty.
const MON = { weekday: 0, startMinute: 16 * 60, endMinute: 20 * 60, station: "Admiralty" };

// A Monday: 2026-10-19 (HKT).
const MONDAY = hktFromParts("2026-10-19", 12 * 60);
const NOW = MONDAY; // slots are generated from "now" onwards

describe("slot generation (#204)", () => {
  it("generates 60-minute slots inside the window, 14 days ahead", () => {
    const slots = generateSlots([MON], [], [], MONDAY, NOW, {});
    // 4 slots per Monday (16,17,18,19 HKT) × 3 Mondays in horizon (19, 26, +1 more on day 14)
    const mondaySlots = slots.filter((s) => s.station === "Admiralty");
    expect(mondaySlots.length).toBeGreaterThanOrEqual(4);
    expect(mondaySlots[0].durationMin).toBe(60);
    expect(mondaySlots.every((s) => s.startsAt.getTime() > NOW.getTime())).toBe(true);
  });

  it("skips blackout dates", () => {
    const slots = generateSlots([MON], [{ blackout_date: "2026-10-19" }], [], MONDAY, NOW, {});
    const firstMonday = slots.filter((s) => s.startsAt.toISOString().startsWith("2026-10-19"));
    expect(firstMonday).toHaveLength(0);
  });

  it("excludes slots conflicting with booked lessons (buffer-aware)", () => {
    const booked17 = {
      starts_at: hktFromParts("2026-10-19", 17 * 60).toISOString(),
      duration_min: 60,
      mode: "in_person",
    };
    const slots = generateSlots([MON], [], [booked17], MONDAY, NOW, {});
    const hours = slots
      .filter((s) => s.startsAt.toISOString().startsWith("2026-10-19"))
      .map((s) => s.startsAt.getTime());
    // 17:00 slot overlaps; 16:00 (back-to-back, buffered) and 18:00 (buffered) also blocked.
    expect(hours.includes(hktFromParts("2026-10-19", 17 * 60).getTime())).toBe(false);
    expect(hours.includes(hktFromParts("2026-10-19", 16 * 60).getTime())).toBe(false);
    expect(hours.includes(hktFromParts("2026-10-19", 18 * 60).getTime())).toBe(false);
    expect(hours.includes(hktFromParts("2026-10-19", 19 * 60).getTime())).toBe(true);
  });

  it("online bookings do not block buffered neighbours", () => {
    const bookedOnline = {
      starts_at: hktFromParts("2026-10-19", 17 * 60).toISOString(),
      duration_min: 60,
      mode: "online",
    };
    const slots = generateSlots([MON], [], [bookedOnline], MONDAY, NOW, {});
    const hours = slots
      .filter((s) => s.startsAt.toISOString().startsWith("2026-10-19"))
      .map((s) => s.startsAt.getTime());
    expect(hours.includes(hktFromParts("2026-10-19", 16 * 60).getTime())).toBe(true);
    expect(hours.includes(hktFromParts("2026-10-19", 18 * 60).getTime())).toBe(true);
    expect(hours.includes(hktFromParts("2026-10-19", 17 * 60).getTime())).toBe(false); // hard overlap still blocked
  });

  it("returns slots sorted ascending across weeks", () => {
    const slots = generateSlots([MON], [], [], MONDAY, NOW, {});
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].startsAt.getTime()).toBeGreaterThanOrEqual(slots[i - 1].startsAt.getTime());
    }
  });
});

describe("lessonConflicts direct", () => {
  const base = hktFromParts("2026-10-19", 17 * 60);
  it("exact overlap conflicts", () => {
    expect(
      lessonConflicts(base, 60, [
        { starts_at: base.toISOString(), duration_min: 60, mode: "in_person" },
      ]),
    ).toBe(true);
  });
  it("non-overlapping distant lessons do not", () => {
    expect(
      lessonConflicts(base, 60, [
        { starts_at: hktFromParts("2026-10-19", 19 * 60).toISOString(), duration_min: 60, mode: "in_person" },
      ]),
    ).toBe(false);
  });
});
