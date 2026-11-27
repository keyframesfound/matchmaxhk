import { describe, expect, it } from "vitest";

import {
  cooldownOpen,
  isSuggestionSlot,
  pickSuggestionTutors,
  recentlySuggested,
  suggestionInterests,
  withoutActiveSubjects,
  type SuggestionTutor,
} from "../../src/features/search/tutor-suggestions";

const now = new Date("2026-11-26T03:00:00Z"); // Thu 11:00 HKT
let n = 0;
const tutor = (over: Partial<SuggestionTutor> = {}): SuggestionTutor => {
  n += 1;
  return {
    id: `t${n}`,
    tutorCode: `MM-T${String(n).padStart(3, "0")}`,
    userId: `u${n}`,
    subjects: ["Chemistry"],
    stations: [],
    district: "Sha Tin",
    lessonMode: "either",
    gender: null,
    tutorStatus: null,
    targetStudents: ["IBDP"],
    profileTags: [],
    isAccepting: true,
    accountStatus: "active",
    hasPhoto: true,
    hasHeadline: true,
    updatedAt: now.toISOString(),
    matchAlertsMuted: false,
    shadowbanned: false,
    remainingSlots: 2,
    rateHkd: 400,
    displayName: `Tutor ${n}`,
    verified: false,
    credential: null,
    ...over,
  };
};

describe("#717 tutor suggestion email rules", () => {
  it("runs only Tue / Thu 11:00 HKT, at most every 14 days per parent", () => {
    expect(isSuggestionSlot(now)).toBe(true);
    expect(isSuggestionSlot(new Date("2026-11-26T04:00:00Z"))).toBe(false); // 12:00
    expect(isSuggestionSlot(new Date("2026-11-25T03:00:00Z"))).toBe(false); // Wed
    expect(cooldownOpen(null, now)).toBe(true);
    expect(cooldownOpen("2026-11-20T00:00:00Z", now)).toBe(false);
    expect(cooldownOpen("2026-11-10T00:00:00Z", now)).toBe(true);
  });

  it("reads interests from recent tutor searches and child profiles, minus live subjects", () => {
    const interests = suggestionInterests({
      savedSearches: [
        {
          scope: "tutors",
          params: { subject: "Chemistry", category: "IBDP" },
          at: "2026-11-20T00:00:00Z",
        },
        { scope: "cases", params: { subject: "Physics" }, at: "2026-11-20T00:00:00Z" },
        { scope: "tutors", params: { subject: "Biology" }, at: "2026-09-01T00:00:00Z" },
      ],
      children: [
        { subjects: ["Math", "Chemistry"], curriculum: "IBDP", at: "2026-11-01T00:00:00Z" },
      ],
      now,
    });
    expect(interests).toEqual([
      { subject: "Chemistry", curriculum: "IBDP" },
      { subject: "Math", curriculum: "IBDP" },
    ]);
    expect(withoutActiveSubjects(interests, ["math"])).toEqual([
      { subject: "Chemistry", curriculum: "IBDP" },
    ]);
  });

  it("sends exactly 3 open-capacity tutors or nothing, never repeating within 30 days", () => {
    const interest = { subject: "Chemistry", curriculum: "IBDP" };
    const full = tutor({ remainingSlots: 0 });
    const closed = tutor({ isAccepting: false });
    const otherCurriculum = tutor({ targetStudents: ["HKDSE"] });
    const ok = [tutor(), tutor(), tutor()];
    const picks = pickSuggestionTutors(
      interest,
      [full, closed, otherCurriculum, ...ok],
      new Set(),
      "p1",
      now,
    );
    expect(picks.map((p) => p.tutorId).sort()).toEqual(ok.map((t) => t.id).sort());
    expect(picks[0].reason).toBe("Tutors IBDP Chemistry with open slots");

    const sent = recentlySuggested(
      [{ tutor_ids: [ok[0].id], sent_at: "2026-11-12T00:00:00Z" }],
      now,
    );
    expect(pickSuggestionTutors(interest, ok, sent, "p1", now)).toEqual([]); // only 2 left → no email
    expect(
      recentlySuggested([{ tutor_ids: ["x"], sent_at: "2026-10-01T00:00:00Z" }], now).size,
    ).toBe(0);
  });
});

describe("#717 template and policy", () => {
  it("is automated marketing (opt-in + 7-day cap + unsubscribe)", async () => {
    const { emailClassFor } = await import("../../src/lib/email-templates/email-policy");
    expect(emailClassFor("tutor-suggestions")).toBe("automated_marketing");
  });

  it("renders the locked bilingual copy with 3 tutors and the 1-click unsubscribe", async () => {
    const React = await import("react");
    const { render } = await import("@react-email/components");
    const { TutorSuggestionsEmail } =
      await import("../../src/lib/email-templates/tutor-suggestions");
    const tutors = [1, 2, 3].map((i) => ({
      name: `Tutor ${i}`,
      verified: i === 1,
      credential: null,
      subjects: ["Chemistry"],
      area: "Sha Tin",
      remainingSlots: 2,
      rateHkd: 400,
      reason: "Tutors IBDP Chemistry with open slots",
      url: `https://matchmax.hk/en/tutors/MM-T00${i}`,
    }));
    const en = await render(
      React.createElement(TutorSuggestionsEmail, {
        parentName: "Amy",
        subjectLabel: "IBDP Chemistry",
        tutors,
        unsubscribeUrl: "https://matchmax.hk/api/email/unsubscribe?token=x",
      }),
      { plainText: true },
    );
    expect(en).toContain("3 independent tutors");
    expect(en).toContain("Parents pay $0 matching fee");
    expect(en).toContain("Unsubscribe from tutor suggestions in 1 click");
    expect(en.match(/View Tutor \d's Profile/g)).toHaveLength(3);
    const zh = await render(
      React.createElement(TutorSuggestionsEmail, {
        subjectLabel: "IBDP Chemistry",
        tutors,
        locale: "zh-HK",
        unsubscribeUrl: "https://matchmax.hk/x",
      }),
      { plainText: true },
    );
    expect(zh).toContain("（$0 中介費）");
    expect(zh).toContain("按此一鍵取消訂閱導師推薦");
  });
});
