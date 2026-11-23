import { describe, expect, it } from "vitest";

import {
  DEFAULT_TUTOR_TIMEZONE,
  formatInTutorZone,
  isSupportedTimezone,
  resolveTutorTimezone,
  timezoneCity,
  timezoneLabel,
  timezoneOffsetLabel,
} from "../../src/features/cases/tutor-timezone";

describe("#798 tutor timezone", () => {
  it("defaults to Hong Kong and rejects unknown zones", () => {
    expect(resolveTutorTimezone(null)).toBe("Asia/Hong_Kong");
    expect(resolveTutorTimezone("Mars/Olympus")).toBe("Asia/Hong_Kong");
    expect(resolveTutorTimezone("Asia/Tokyo")).toBe("Asia/Tokyo");
    expect(DEFAULT_TUTOR_TIMEZONE).toBe("Asia/Hong_Kong");
  });

  it("only offers zones the picker can render", () => {
    expect(isSupportedTimezone("Asia/Hong_Kong")).toBe(true);
    expect(isSupportedTimezone("Europe/London")).toBe(true);
    expect(isSupportedTimezone("Europe/Atlantis")).toBe(false);
    expect(isSupportedTimezone(null)).toBe(false);
  });

  it("labels a zone with its city and current offset", () => {
    expect(timezoneCity("Asia/Hong_Kong")).toBe("Hong Kong");
    expect(timezoneCity("America/New_York")).toBe("New York");
    expect(timezoneOffsetLabel("Asia/Hong_Kong", new Date("2026-11-23T00:00:00Z"))).toBe("GMT+8");
    expect(timezoneLabel("Asia/Hong_Kong", new Date("2026-11-23T00:00:00Z"))).toBe(
      "Hong Kong (GMT+8)",
    );
  });

  it("renders the same instant differently per tutor zone", () => {
    const instant = "2026-11-23T12:00:00Z";
    expect(formatInTutorZone(instant, "Asia/Hong_Kong")).toContain("20:00");
    expect(formatInTutorZone(instant, "Europe/London")).toContain("12:00");
    // An unknown zone must not throw, it falls back to HK.
    expect(formatInTutorZone(instant, "Mars/Olympus")).toContain("20:00");
    expect(formatInTutorZone("not-a-date", "Asia/Hong_Kong")).toBe("");
  });
});
