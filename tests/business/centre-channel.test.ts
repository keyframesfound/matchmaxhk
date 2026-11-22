import { describe, expect, it } from "vitest";

import {
  affiliateCards,
  hasHireLanguage,
  isVerifiedPartner,
  type AffiliateTutorRow,
} from "../../src/features/business/centre-channel";

const row = (over: Partial<AffiliateTutorRow> = {}): AffiliateTutorRow => ({
  user_id: "u1",
  tutor_code: "MM-T001",
  display_name: "Amy",
  photo_url: null,
  headline: "IB Physics",
  subjects: ["Physics"],
  hourly_rate: 400,
  min_hourly_rate_hkd: 350,
  verification_tier: "tier_2_verified",
  is_published: true,
  card_hidden_by_ban: false,
  owner_account_status: "active",
  ...over,
});

describe("#815 centre channel", () => {
  it("Verified Partner only when active and BR-reviewed (AC-CH-2)", () => {
    expect(isVerifiedPartner({ status: "active", br_reviewed_at: "2026-11-01" })).toBe(true);
    expect(isVerifiedPartner({ status: "active", br_reviewed_at: null })).toBe(false);
    expect(isVerifiedPartner({ status: "pending", br_reviewed_at: "2026-11-01" })).toBe(false);
    expect(isVerifiedPartner(null)).toBe(false);
  });

  it("lists only approved, live affiliates and never carries contact fields (AC-TUT-1, AC-CH-5)", () => {
    const cards = affiliateCards(
      ["u1", "u3", "u4"],
      [
        row({ phone: "+852 9123 4567", email: "a@b.c" } as Partial<AffiliateTutorRow>),
        row({ user_id: "u2", tutor_code: "MM-T002" }), // not approved
        row({ user_id: "u3", tutor_code: "MM-T003", is_published: false }),
        row({ user_id: "u4", tutor_code: "MM-T004", card_hidden_by_ban: true }),
      ],
    );
    expect(cards.map((c) => c.tutorCode)).toEqual(["MM-T001"]);
    expect(cards[0]).toEqual({
      tutorCode: "MM-T001",
      displayName: "Amy",
      photoUrl: null,
      headline: "IB Physics",
      subjects: ["Physics"],
      fromRateHkd: 350,
      verified: true,
    });
    expect(JSON.stringify(cards)).not.toMatch(/9123|a@b\.c/);
  });

  it("flags hire / vacancy wording in EN and 繁中 (AC-CH-3)", () => {
    expect(hasHireLanguage("We are hiring tutors")).toBe(true);
    expect(hasHireLanguage("中心聘請導師")).toBe(true);
    expect(hasHireLanguage("職位空缺")).toBe(true);
    expect(hasHireLanguage("Small-group DSE Chemistry classes")).toBe(false);
  });
});
