/**
 * #613 roster/attendance pure-logic tests. Vitest run standalone:
 *   npx vitest run src/features/rosters/roster-logic.test.ts
 * (imports via RELATIVE paths — the @/ alias does not resolve under vitest).
 */
import { describe, expect, it } from "vitest";

import {
  ATTENDANCE_STATUSES,
  CLAIM_TOKEN_DAYS,
  CORRECTION_WINDOW_MS,
  LOCKED_ENGAGEMENT,
  buildShareTextBoth,
  buildShareTextEn,
  buildShareTextZh,
  canCorrectAttendance,
  claimTokenState,
  completedCountDelta,
  contactKind,
  correctionSecondsLeft,
  duplicateStudentKey,
  editCountDelta,
  engagementLockedFor,
  formatHktDateTime,
  hktCheckInDefaults,
  hktWallClockToUtcIso,
  isAttendanceStatus,
  isStaleVersion,
  isValidSessionKey,
  normalizeContact,
  normalizeStudentName,
  sourceTagForRoster,
} from "./roster-logic";

// ---------------------------------------------------------------------------
// Completed-count rules
// ---------------------------------------------------------------------------
describe("completedCountDelta", () => {
  it("increments for PRESENT and LATE only", () => {
    expect(completedCountDelta("present")).toBe(1);
    expect(completedCountDelta("late")).toBe(1);
  });

  it("increments 0 for both absent states", () => {
    expect(completedCountDelta("absent_excused")).toBe(0);
    expect(completedCountDelta("absent_unexcused")).toBe(0);
  });

  it("increments 0 for no status", () => {
    expect(completedCountDelta(null)).toBe(0);
  });
});

describe("editCountDelta", () => {
  it("Present→Absent at hour 2 decrements the count", () => {
    expect(editCountDelta("present", "absent_unexcused")).toBe(-1);
    expect(editCountDelta("present", "absent_excused")).toBe(-1);
  });

  it("Absent→Present restores the count", () => {
    expect(editCountDelta("absent_unexcused", "present")).toBe(1);
    expect(editCountDelta("absent_excused", "late")).toBe(1);
  });

  it("Present↔Late keeps the count at 1", () => {
    expect(editCountDelta("present", "late")).toBe(0);
    expect(editCountDelta("late", "present")).toBe(0);
  });

  it("absent↔absent keeps the count at 0", () => {
    expect(editCountDelta("absent_excused", "absent_unexcused")).toBe(0);
  });
});

describe("isAttendanceStatus", () => {
  it("accepts exactly the four pill states", () => {
    for (const s of ATTENDANCE_STATUSES) expect(isAttendanceStatus(s)).toBe(true);
  });

  it("rejects junk and session states", () => {
    expect(isAttendanceStatus("PRESENT")).toBe(false);
    expect(isAttendanceStatus("voided")).toBe(false);
    expect(isAttendanceStatus(42)).toBe(false);
    expect(isAttendanceStatus(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 24-hour correction window
// ---------------------------------------------------------------------------
describe("24h correction window", () => {
  const now = new Date("2026-11-07T10:00:00Z");

  it("allows a correction at hour 2", () => {
    expect(canCorrectAttendance("2026-11-07T08:00:00Z", now)).toBe(true);
  });

  it("locks the record after 24 hours", () => {
    expect(canCorrectAttendance("2026-11-06T10:00:01Z", now)).toBe(true);
    expect(canCorrectAttendance("2026-11-06T10:00:00Z", now)).toBe(false);
    expect(canCorrectAttendance("2026-11-05T10:00:00Z", now)).toBe(false);
  });

  it("window is exactly 24h", () => {
    expect(CORRECTION_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("counts down the seconds left", () => {
    expect(correctionSecondsLeft("2026-11-06T10:00:20Z", now)).toBe(20);
    expect(correctionSecondsLeft("2026-11-06T10:00:00Z", now)).toBe(0);
  });

  it("treats an unparsable date as locked", () => {
    expect(canCorrectAttendance("not-a-date", now)).toBe(false);
    expect(correctionSecondsLeft("not-a-date", now)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Idempotency + duplicates
// ---------------------------------------------------------------------------
describe("isValidSessionKey", () => {
  it("accepts uuid-ish and url-safe keys", () => {
    expect(isValidSessionKey("9f1c0b2e-3d4a-4f5b-8c6d-7e8f9a0b1c2d")).toBe(true);
    expect(isValidSessionKey("sess_9f1C0b2e")).toBe(true);
  });

  it("rejects short, empty or junk keys", () => {
    expect(isValidSessionKey("short")).toBe(false);
    expect(isValidSessionKey("")).toBe(false);
    expect(isValidSessionKey("has spaces in it ok?")).toBe(false);
    expect(isValidSessionKey(123)).toBe(false);
    expect(isValidSessionKey(null)).toBe(false);
  });
});

describe("duplicate student blocking key", () => {
  it("same name + same contact collide regardless of case/spacing", () => {
    expect(duplicateStudentKey("parent@example.com", "Chan Tai Man")).toBe(
      duplicateStudentKey("Parent@Example.com", "  chan   TAI man "),
    );
  });

  it("different contact = different student", () => {
    expect(duplicateStudentKey("a@example.com", "Chan Tai Man")).not.toBe(
      duplicateStudentKey("b@example.com", "Chan Tai Man"),
    );
  });

  it("different name = different student", () => {
    expect(duplicateStudentKey("a@example.com", "Chan Tai Man")).not.toBe(
      duplicateStudentKey("a@example.com", "Chan Siu Man"),
    );
  });

  it("CJK names normalize (NFC) without case damage", () => {
    expect(normalizeStudentName("陳大文")).toBe("陳大文");
    // NFC decomposes then recomposes visually-identical hangul/latin mixes.
    expect(normalizeStudentName("Ｃｈａｎ")).not.toBe("Chan"); // fullwidth ≠ ascii
  });
});

// ---------------------------------------------------------------------------
// Contact parsing
// ---------------------------------------------------------------------------
describe("contactKind + normalizeContact", () => {
  it("classifies emails", () => {
    expect(contactKind("parent@example.com")).toBe("email");
  });

  it("classifies HK phones with or without +852", () => {
    const local = "9123" + "4567";
    expect(contactKind(local)).toBe("phone");
    expect(contactKind(`+852${local}`)).toBe("phone");
  });

  it("rejects junk", () => {
    expect(contactKind("not-a-contact")).toBe(null);
    expect(contactKind("123")).toBe(null);
    expect(contactKind("a@b")).toBe(null);
  });

  it("normalizes emails to lowercase", () => {
    expect(normalizeContact("  Parent@Example.COM ")).toBe("parent@example.com");
  });

  it("normalizes phone formats to one canonical number", () => {
    const local = "9123" + "4567";
    expect(normalizeContact("+852 9123-4567")).toBe(`+852${local}`);
    expect(normalizeContact("9123 4567")).toBe(`+${local}`);
  });

  it("phone normalization makes formats collide", () => {
    const local = "9123" + "4567";
    expect(normalizeContact(`+852${local}`)).toBe(
      normalizeContact(`852-${local.slice(0, 4)} ${local.slice(4)}`),
    );
  });
});

// ---------------------------------------------------------------------------
// Claim tokens
// ---------------------------------------------------------------------------
describe("claimTokenState", () => {
  const now = new Date("2026-11-07T10:00:00Z");
  const base = {
    used_at: null,
    revoked_at: null,
    expires_at: new Date(now.getTime() + CLAIM_TOKEN_DAYS * 86_400_000).toISOString(),
  };

  it("valid inside the 14-day window", () => {
    expect(claimTokenState(base, now)).toBe("valid");
    expect(CLAIM_TOKEN_DAYS).toBe(14);
  });

  it("expired after 14 days", () => {
    expect(claimTokenState(base, new Date("2026-11-21T10:00:01Z"))).toBe("expired");
  });

  it("used beats expiry (single-use)", () => {
    expect(claimTokenState({ ...base, used_at: "2026-11-08T00:00:00Z" }, now)).toBe("used");
  });

  it("revoked beats validity", () => {
    expect(claimTokenState({ ...base, revoked_at: "2026-11-07T00:00:00Z" }, now)).toBe("revoked");
  });

  it("revoked is reported even past expiry", () => {
    expect(
      claimTokenState(
        { ...base, revoked_at: "2026-12-01T00:00:00Z" },
        new Date("2027-01-01T00:00:00Z"),
      ),
    ).toBe("revoked");
  });
});

// ---------------------------------------------------------------------------
// HKT wall clock
// ---------------------------------------------------------------------------
describe("HKT helpers", () => {
  // 2026-11-07T16:30:00Z = 2026-11-08 00:30 HKT (UTC+8, past midnight).
  const lateNightUtc = new Date("2026-11-07T16:30:00Z");

  it("todayHkt rolls over at the HKT day boundary", () => {
    expect(hktCheckInDefaults(lateNightUtc).date).toBe("2026-11-08");
  });

  it("check-in defaults are the HKT wall clock", () => {
    const d = hktCheckInDefaults(new Date("2026-11-07T04:05:00Z"));
    expect(d).toEqual({ date: "2026-11-07", time: "12:05" });
  });

  it("wall-clock → UTC round trip", () => {
    const iso = hktWallClockToUtcIso("2026-11-07", "14:05");
    expect(iso).toBe("2026-11-07T06:05:00.000Z");
  });

  it("formats UTC timestamps as fixed HKT in both languages", () => {
    expect(formatHktDateTime("2026-11-07T06:05:00Z", "en")).toBe("7 Nov 14:05 HKT");
    expect(formatHktDateTime("2026-11-07T06:05:00Z", "zh-HK")).toBe("11月7日 14:05 (HKT)");
  });
});

// ---------------------------------------------------------------------------
// Optimistic concurrency
// ---------------------------------------------------------------------------
describe("isStaleVersion", () => {
  it("flags a moved row", () => {
    expect(isStaleVersion("2026-11-07T10:00:00Z", "2026-11-07T10:00:01Z")).toBe(true);
  });

  it("accepts the current version", () => {
    expect(isStaleVersion("2026-11-07T10:00:00Z", "2026-11-07T10:00:00Z")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Engagement + source-tag locks
// ---------------------------------------------------------------------------
describe("engagement + source tags", () => {
  it("matched cases lock the engagement type", () => {
    expect(engagementLockedFor("matched_case")).toBe(true);
    expect(engagementLockedFor("partner_course")).toBe(false);
    expect(engagementLockedFor("private_class")).toBe(false);
    expect(LOCKED_ENGAGEMENT).toBe("standard_ongoing");
  });

  it("matched-case rosters tag MATCHMAX_MATCHED, everything else SELF_BROUGHT", () => {
    expect(sourceTagForRoster("matched_case")).toBe("matchmax_matched");
    expect(sourceTagForRoster("partner_course")).toBe("self_brought");
    expect(sourceTagForRoster("private_class")).toBe("self_brought");
  });
});

// ---------------------------------------------------------------------------
// Share text
// ---------------------------------------------------------------------------
describe("parent share text", () => {
  const input = {
    courseName: "DSE Math Intensive",
    studentName: "Chan Tai Man",
    claimUrl: "https://matchmax.hk/claim-roster/abc123",
  };

  it("builds the exact EN copy from §4.3", () => {
    expect(buildShareTextEn(input)).toBe(
      "Hi! We use MatchMax to send real-time attendance notifications for DSE Math Intensive. Tap here to link Chan Tai Man's attendance record (free): https://matchmax.hk/claim-roster/abc123",
    );
  });

  it("builds the 繁中 equivalent", () => {
    expect(buildShareTextZh(input)).toBe(
      "您好！我們透過 MatchMax 為 DSE Math Intensive 發送即時課堂點名通知。請點擊以下連結，免費綁定 Chan Tai Man 的點名紀錄：https://matchmax.hk/claim-roster/abc123",
    );
  });

  it("both = EN newline 繁中", () => {
    expect(buildShareTextBoth(input)).toBe(
      `${buildShareTextEn(input)}\n${buildShareTextZh(input)}`,
    );
  });
});
