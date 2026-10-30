import { describe, expect, it } from "vitest";

import {
  isGhostRisk,
  isSerialHopper,
  latestMentionedMinutes,
  screenCaseRequest,
} from "../../src/features/trust/safety-screen";

const types = (input: Parameters<typeof screenCaseRequest>[0]) =>
  screenCaseRequest(input).hits.map((h) => h.flagType);

describe("screenCaseRequest (#529 rules, not an LLM)", () => {
  it("passes an ordinary request with no flags and no hold", () => {
    const r = screenCaseRequest({ notes: "DSE Chem, weekends please", district: "Sha Tin" });
    expect(r).toEqual({ hits: [], hold: false });
  });

  it("flags industrial and hotel venues (EN + 繁中)", () => {
    expect(types({ district: "Kwun Tong Industrial Centre" })).toEqual(["HIGH_RISK_LOCATION"]);
    expect(types({ notes: "lessons at the hotel lobby" })).toEqual(["HIGH_RISK_LOCATION"]);
    expect(types({ notes: "喺觀塘工業大廈上堂" })).toEqual(["HIGH_RISK_LOCATION"]);
  });

  it("holds a venue hit only for adult learners; a child's request is flag-only", () => {
    expect(screenCaseRequest({ whoFor: "myself", notes: "酒店房上堂" }).hold).toBe(true);
    expect(screenCaseRequest({ whoFor: "my_child", notes: "酒店房上堂" }).hold).toBe(false);
  });

  it("never matches study subjects that mention hotels or industry", () => {
    expect(types({ notes: "Hotel management student needs stats help" })).toEqual([]);
    expect(types({ notes: "HKU industrial engineering, year 2" })).toEqual([]);
    expect(types({ notes: "讀緊酒店管理" })).toEqual([]);
  });

  it("ordinary payment wording is not a scam hit", () => {
    expect(types({ notes: "I don't want to overpay" })).toEqual([]);
    expect(types({ notes: "Can pay 3 months in advance" })).toEqual([]);
  });

  it("holds late-night adult requests with a specific gender", () => {
    const base = { whoFor: "myself", preferredGender: "female" };
    expect(types({ ...base, notes: "English chat 10pm" })).toEqual(["LATE_NIGHT_ADULT"]);
    expect(types({ ...base, notes: "around 21:45" })).toEqual(["LATE_NIGHT_ADULT"]);
    expect(types({ ...base, notes: "晚上9點半" })).toEqual(["LATE_NIGHT_ADULT"]);
    expect(types({ ...base, notes: "晚上十點" })).toEqual(["LATE_NIGHT_ADULT"]);
    expect(types({ ...base, notes: "晚上12點" })).toEqual(["LATE_NIGHT_ADULT"]);
  });

  it("does not hold late lessons for children, any-gender, or early times", () => {
    expect(types({ whoFor: "my_child", preferredGender: "female", notes: "10pm" })).toEqual([]);
    expect(types({ whoFor: "myself", preferredGender: "any", notes: "10pm" })).toEqual([]);
    expect(types({ whoFor: "myself", preferredGender: "male", notes: "9pm" })).toEqual([]);
  });

  it("holds overpayment scam language", () => {
    const r = screenCaseRequest({ notes: "I will send a cashier cheque, refund the difference" });
    expect(r.hits.map((h) => h.flagType)).toEqual(["SCAM_OVERPAYMENT"]);
    expect(r.hold).toBe(true);
  });

  it("flags bypass and serial-hopper language as advisory only", () => {
    const r = screenCaseRequest({
      notes: "Tried 5 agencies already, can we pay the tutor directly?",
    });
    expect(r.hits.map((h) => h.flagType).sort()).toEqual([
      "BYPASS_COLLUSION_RISK",
      "SERIAL_HOPPER_PARENT",
    ]);
    expect(r.hold).toBe(false);
  });

  it("keeps only the matched keyword as evidence (privacy)", () => {
    const r = screenCaseRequest({ notes: "My name is Chan, flat 3, Hotel Grand, call me" });
    expect(r.hits[0].evidence).toBe("Hotel");
  });
});

describe("latestMentionedMinutes", () => {
  it("reads 24h, pm and Chinese evening times and returns the latest", () => {
    expect(latestMentionedMinutes("7:00 or 21:30")).toBe(21 * 60 + 30);
    expect(latestMentionedMinutes("10.15pm")).toBe(22 * 60 + 15);
    expect(latestMentionedMinutes("晚上10點")).toBe(22 * 60);
    expect(latestMentionedMinutes("no time here")).toBeNull();
  });
});

describe("isSerialHopper", () => {
  const now = new Date("2026-10-30T00:00:00Z");
  it("needs 3 early drops inside 30 days", () => {
    const recent = ["2026-10-01T00:00:00Z", "2026-10-15T00:00:00Z", "2026-10-29T00:00:00Z"];
    expect(isSerialHopper(recent, now)).toBe(true);
    expect(isSerialHopper(recent.slice(1), now)).toBe(false);
    expect(isSerialHopper(["2026-08-01T00:00:00Z", ...recent.slice(1)], now)).toBe(false);
  });
});

describe("isGhostRisk (T-12h unconfirmed tutor)", () => {
  const now = new Date("2026-10-30T00:00:00Z");
  const at = (hours: number) => new Date(now.getTime() + hours * 3600_000).toISOString();

  it("flags an unconfirmed L1 starting within 12h", () => {
    expect(isGhostRisk({ startsAt: at(6), status: "planned", confirmedByTutorAt: null }, now)).toBe(
      true,
    );
  });

  it("ignores confirmed, far-off, past or cancelled lessons", () => {
    const base = { status: "planned", confirmedByTutorAt: null };
    expect(isGhostRisk({ ...base, startsAt: at(6), confirmedByTutorAt: at(-1) }, now)).toBe(false);
    expect(isGhostRisk({ ...base, startsAt: at(13) }, now)).toBe(false);
    expect(isGhostRisk({ ...base, startsAt: at(-1) }, now)).toBe(false);
    expect(isGhostRisk({ ...base, status: "cancelled", startsAt: at(6) }, now)).toBe(false);
  });
});
