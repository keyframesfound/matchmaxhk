import { describe, expect, it } from "vitest";

import {
  MEETING_URL_MAX,
  MEETING_URL_MIN,
  canClearMeetingUrl,
  canEditMeetingUrl,
  normaliseMeetingUrl,
} from "../../src/features/cases/case-manager/meeting-link";

describe("normaliseMeetingUrl", () => {
  it("accepts an https link and trims surrounding space", () => {
    expect(normaliseMeetingUrl("  https://zoom.us/j/123  ")).toEqual({
      ok: true,
      url: "https://zoom.us/j/123",
    });
  });

  it("rejects http, javascript and a bare host", () => {
    for (const bad of ["http://zoom.us/j/123", "javascript:alert(1)", "zoom.us/j/123"]) {
      expect(normaliseMeetingUrl(bad)).toEqual({ ok: false, code: "URL_INVALID" });
    }
  });

  it("rejects a non-string payload", () => {
    expect(normaliseMeetingUrl(42)).toEqual({ ok: false, code: "URL_INVALID" });
    expect(normaliseMeetingUrl({ url: "https://zoom.us/j/1" })).toEqual({
      ok: false,
      code: "URL_INVALID",
    });
  });

  it("treats null, undefined, empty and whitespace-only input as clearing the link", () => {
    for (const blank of [null, undefined, "", "   "]) {
      expect(normaliseMeetingUrl(blank)).toEqual({ ok: true, url: null });
    }
  });

  it("enforces the 12..500 character bounds", () => {
    const tooShort = `https://${"a".repeat(MEETING_URL_MIN - 9)}`; // 11 chars
    expect(tooShort.length).toBe(MEETING_URL_MIN - 1);
    expect(normaliseMeetingUrl(tooShort)).toEqual({ ok: false, code: "URL_INVALID" });

    const justEnough = `https://${"a".repeat(MEETING_URL_MIN - 8)}`; // 12 chars
    expect(justEnough.length).toBe(MEETING_URL_MIN);
    expect(normaliseMeetingUrl(justEnough).ok).toBe(true);

    const tooLong = `https://${"a".repeat(MEETING_URL_MAX)}`;
    expect(normaliseMeetingUrl(tooLong)).toEqual({ ok: false, code: "URL_INVALID" });
    expect(normaliseMeetingUrl(tooLong.slice(0, MEETING_URL_MAX)).ok).toBe(true);
  });
});

describe("meeting link write rules", () => {
  it("lets the matched tutor write the link", () => {
    expect(canEditMeetingUrl("tutor", false)).toBe(true);
  });

  it("never lets a learner write it, even with an Ops flag mismatch", () => {
    expect(canEditMeetingUrl("parent", false)).toBe(false);
  });

  it("lets Ops write it on the tutor's behalf", () => {
    expect(canEditMeetingUrl("parent", true)).toBe(true);
    expect(canEditMeetingUrl("tutor", true)).toBe(true);
  });

  it("allows clearing wherever setting is allowed, and nowhere else", () => {
    expect(canClearMeetingUrl("tutor", false)).toBe(true);
    expect(canClearMeetingUrl("parent", true)).toBe(true);
    expect(canClearMeetingUrl("parent", false)).toBe(false);
  });
});
