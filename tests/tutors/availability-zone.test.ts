import { describe, expect, it } from "vitest";

import {
  hourLabelAt,
  hourRangeLabelAt,
  shiftGridSlot,
  shiftOpenHours,
  shiftedGridRows,
  zoneOffsetMinutes,
  zoneShiftMinutes,
} from "../../src/features/tutors/availability-zone";
import {
  emptyHourlyOpenHours,
  type HourlyOpenHours,
} from "../../src/features/tutors/availability-grid-model";
import { dateKeyInZone, isDefaultTutorZone } from "../../src/features/cases/tutor-timezone";

// A fixed instant so DST never makes the expectations flicker. 2026-11-23 is
// northern-hemisphere winter: London GMT+0, New York GMT-5, Sydney GMT+11.
const WINTER = new Date("2026-11-23T04:00:00Z");

function grid(entries: Partial<Record<keyof HourlyOpenHours, number[]>>): HourlyOpenHours {
  const base = emptyHourlyOpenHours();
  for (const [day, hours] of Object.entries(entries)) {
    base[day as keyof HourlyOpenHours] = [...(hours ?? [])].sort((a, b) => a - b);
  }
  return base;
}

describe("#798 availability grid in the tutor's zone", () => {
  it("reads zone offsets in minutes, including non-whole-hour zones", () => {
    expect(zoneOffsetMinutes("Asia/Hong_Kong", WINTER)).toBe(480);
    expect(zoneOffsetMinutes("Europe/London", WINTER)).toBe(0);
    expect(zoneOffsetMinutes("Asia/Kolkata", WINTER)).toBe(330);
    // Unknown zones fall back to HKT rather than throwing.
    expect(zoneOffsetMinutes("Mars/Olympus", WINTER)).toBe(480);
  });

  it("maps a slot-grid hour across a zone boundary", () => {
    // HKT -> Sydney in winter is +3h: 18:00 Tue becomes 21:00 Tue.
    expect(shiftGridSlot(1, 18, "Asia/Hong_Kong", "Australia/Sydney", WINTER)).toEqual({
      dayIndex: 1,
      hour: 21,
      minute: 0,
    });
    // HKT -> London in winter is -8h: 18:00 Tue becomes 10:00 Tue.
    expect(shiftGridSlot(1, 18, "Asia/Hong_Kong", "Europe/London", WINTER)).toEqual({
      dayIndex: 1,
      hour: 10,
      minute: 0,
    });
    // Late-night slots roll the day column: Mon 23:00 HKT is Tue 02:00 Sydney.
    expect(shiftGridSlot(0, 23, "Asia/Hong_Kong", "Australia/Sydney", WINTER)).toEqual({
      dayIndex: 1,
      hour: 2,
      minute: 0,
    });
    // And the week wraps at the end: Sun 23:00 HKT is Mon 02:00 Sydney.
    expect(shiftGridSlot(6, 23, "Asia/Hong_Kong", "Australia/Sydney", WINTER)).toEqual({
      dayIndex: 0,
      hour: 2,
      minute: 0,
    });
    // Early mornings roll backwards: Mon 06:00 HKT is Sun 17:00 New York
    // (HKT +8 vs New York -5 in winter, so a 13-hour step back).
    expect(shiftGridSlot(0, 6, "Asia/Hong_Kong", "America/New_York", WINTER)).toEqual({
      dayIndex: 6,
      hour: 17,
      minute: 0,
    });
    // A :30 zone keeps the leftover minutes instead of silently rounding.
    expect(shiftGridSlot(1, 18, "Asia/Hong_Kong", "Asia/Kolkata", WINTER)).toEqual({
      dayIndex: 1,
      hour: 15,
      minute: 30,
    });
  });

  it("is a no-op for the HKT default", () => {
    expect(isDefaultTutorZone(null)).toBe(true);
    expect(isDefaultTutorZone("Asia/Hong_Kong")).toBe(true);
    expect(isDefaultTutorZone("Australia/Sydney")).toBe(false);
    expect(zoneShiftMinutes("Asia/Hong_Kong", "Asia/Hong_Kong", WINTER)).toBe(0);
    // Same map instance: nothing is copied, nothing moves.
    const open = grid({ mon: [6, 18, 23] });
    expect(shiftOpenHours(open, "Asia/Hong_Kong", "Asia/Hong_Kong", WINTER)).toBe(open);
  });

  it("remaps a whole open-hours map, wrapping the day", () => {
    const open = grid({ mon: [23], tue: [18, 19] });
    const sydney = shiftOpenHours(open, "Asia/Hong_Kong", "Australia/Sydney", WINTER);
    // Mon 23:00 HKT -> Tue 02:00 Sydney; Tue 18:00/19:00 -> Tue 21:00/22:00.
    expect(sydney.mon).toEqual([]);
    expect(sydney.tue).toEqual([2, 21, 22]);
    expect(sydney.wed).toEqual([]);

    const london = shiftOpenHours(open, "Asia/Hong_Kong", "Europe/London", WINTER);
    expect(london.mon).toEqual([15]);
    expect(london.tue).toEqual([10, 11]);
  });

  it("keeps the HKT row band and opens the full day only when converting", () => {
    // The default is the same 06:00–23:59 band the grid has always shown.
    const hkt = shiftedGridRows("Asia/Hong_Kong", "Asia/Hong_Kong", WINTER);
    expect(hkt).toHaveLength(18);
    expect(hkt[0]).toBe(6);
    expect(hkt[17]).toBe(23);
    // An unknown zone resolves to HKT, so it takes the same band.
    expect(shiftedGridRows("Asia/Hong_Kong", "Mars/Olympus", WINTER)).toEqual(hkt);

    // Converted zones get the whole day, because the shifted band wraps and a
    // hole in the middle would read as missing data.
    const sydney = shiftedGridRows("Asia/Hong_Kong", "Australia/Sydney", WINTER);
    expect(sydney).toHaveLength(24);
    expect(sydney[0]).toBe(0);
    expect(sydney[23]).toBe(23);
    expect(shiftedGridRows("Asia/Hong_Kong", "Europe/London", WINTER)).toEqual(sydney);
  });

  it("labels rows with the display zone's clock", () => {
    expect(hourLabelAt(18)).toBe("18:00");
    expect(hourLabelAt(15, 30)).toBe("15:30");
    expect(hourRangeLabelAt(18)).toBe("18:00 – 19:00");
    expect(hourRangeLabelAt(23)).toBe("23:00 – 00:00");
    expect(hourRangeLabelAt(15, 30)).toBe("15:30 – 16:30");
  });

  it("buckets a lesson into the tutor's calendar day, not the device day", () => {
    // 2026-11-23T16:30Z is Tue 00:30 in HKT and Mon 11:30 in New York.
    const instant = "2026-11-23T16:30:00Z";
    expect(dateKeyInZone(instant, "Asia/Hong_Kong")).toBe("2026-11-24");
    expect(dateKeyInZone(instant, "America/New_York")).toBe("2026-11-23");
    // Unknown zone falls back to HKT; a bad instant yields "".
    expect(dateKeyInZone(instant, "Mars/Olympus")).toBe("2026-11-24");
    expect(dateKeyInZone("not-a-date", "Asia/Hong_Kong")).toBe("");
  });
});
