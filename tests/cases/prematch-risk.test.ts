import { describe, expect, it } from "vitest";

import {
  assessPrematchRisk,
  hasLateNightPattern,
  hasVenueRisk,
  isAdultRequest,
} from "../../src/features/cases/prematch-risk";

describe("#783 §2.6 item 8 pre-match risk rules", () => {
  it("flags an industrial or hotel venue in notes, estate or school type", () => {
    expect(hasVenueRisk({ notes: "Meet at the industrial building in Kwun Tong" })).toBe(true);
    expect(hasVenueRisk({ locationEstate: "Kwai Chung factory building" })).toBe(true);
    expect(hasVenueRisk({ notes: "We booked a hotel room" })).toBe(true);
    expect(hasVenueRisk({ notes: "喺工廈上堂" })).toBe(true);
    expect(hasVenueRisk({ notes: "酒店大堂等" })).toBe(true);
    expect(hasVenueRisk({ schoolType: "guest house" })).toBe(true);
  });

  it("does not flag ordinary home or school wording", () => {
    expect(hasVenueRisk({ notes: "At our flat in Tai Koo" })).toBe(false);
    expect(hasVenueRisk({ notes: "School library after class" })).toBe(false);
    expect(hasVenueRisk({})).toBe(false);
  });

  it("detects late-night times in notes or the schedule note", () => {
    expect(hasLateNightPattern({ scheduleNote: "Saturdays 11pm" })).toBe(true);
    expect(hasLateNightPattern({ notes: "only after 23:30" })).toBe(true);
    expect(hasLateNightPattern({ notes: "2am works" })).toBe(true);
    expect(hasLateNightPattern({ notes: "02:15" })).toBe(true);
    expect(hasLateNightPattern({ notes: "深夜都可以" })).toBe(true);
    expect(hasLateNightPattern({ scheduleNote: "Sundays 10am" })).toBe(false);
    expect(hasLateNightPattern({ scheduleNote: "weekday evenings" })).toBe(false);
  });

  it("treats a university or self/someone-else request as adult", () => {
    expect(isAdultRequest({ academicLevel: "University" })).toBe(true);
    expect(isAdultRequest({ whoFor: "myself" })).toBe(true);
    expect(isAdultRequest({ whoFor: "someone_else" })).toBe(true);
    expect(isAdultRequest({ whoFor: "my_child", academicLevel: "Secondary" })).toBe(false);
  });

  it("holds only the late-night + adult + specific-gender combination", () => {
    const base = {
      scheduleNote: "11pm start",
      academicLevel: "University",
      preferredGender: "female",
    };
    expect(assessPrematchRisk(base)).toEqual({
      hold: true,
      reasons: ["late_night_adult_specific_gender"],
    });
    expect(assessPrematchRisk({ ...base, preferredGender: "any" }).hold).toBe(false);
    expect(
      assessPrematchRisk({ ...base, academicLevel: "Secondary", whoFor: "my_child" }).hold,
    ).toBe(false);
    expect(assessPrematchRisk({ ...base, scheduleNote: "4pm start" }).hold).toBe(false);
  });

  it("reports both reasons when both rules hit", () => {
    const risk = assessPrematchRisk({
      notes: "hotel room, 11pm",
      academicLevel: "University",
      preferredGender: "male",
    });
    expect(risk.hold).toBe(true);
    expect(risk.reasons).toEqual(["venue_industrial_or_hotel", "late_night_adult_specific_gender"]);
  });

  it("returns no hold for a clean child request", () => {
    expect(
      assessPrematchRisk({
        notes: "Primary maths at home",
        scheduleNote: "weekday 4pm",
        academicLevel: "Primary",
        whoFor: "my_child",
        preferredGender: "any",
      }),
    ).toEqual({ hold: false, reasons: [] });
  });
});
