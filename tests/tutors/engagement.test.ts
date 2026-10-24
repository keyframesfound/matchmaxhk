import { describe, expect, it } from "vitest";

import {
  computePopularityScore,
  ENGAGEMENT_THRESHOLDS,
  isParentFavorite,
  isTopScorer,
  rankTrending,
  selectDemandBadge,
  selectProfileSocialProof,
  type EngagementQuality,
  type TrendingCandidate,
} from "../../src/features/tutors/engagement";

const summary = (overrides: Partial<TrendingCandidate> = {}): TrendingCandidate => ({
  tutor_id: "t1",
  inquiries_7d: 0,
  views_30d: 0,
  requests_30d: 0,
  saves_total: 0,
  saves_30d: 0,
  base_score: 0,
  ...overrides,
});

describe("selectDemandBadge (#102 hierarchy)", () => {
  it("one remaining slot wins over everything", () => {
    expect(
      selectDemandBadge({ remaining_student_slots: 1, inquiries_7d: 99, saves_total: 99 }),
    ).toBe("one_slot_left");
  });

  it("high demand beats popular", () => {
    expect(
      selectDemandBadge({ remaining_student_slots: 3, inquiries_7d: 3, saves_total: 50 }),
    ).toBe("high_demand");
  });

  it("popular needs >= 10 total saves", () => {
    expect(
      selectDemandBadge({ remaining_student_slots: 3, inquiries_7d: 0, saves_total: 10 }),
    ).toBe("popular");
    expect(selectDemandBadge({ remaining_student_slots: 3, inquiries_7d: 0, saves_total: 9 })).toBe(
      null,
    );
  });

  it("below every threshold renders nothing (empty-restaurant guard)", () => {
    expect(selectDemandBadge({ remaining_student_slots: 5, inquiries_7d: 2, saves_total: 4 })).toBe(
      null,
    );
    expect(selectDemandBadge({ remaining_student_slots: 0, inquiries_7d: 0, saves_total: 0 })).toBe(
      null,
    );
    expect(
      selectDemandBadge({ remaining_student_slots: null, inquiries_7d: 0, saves_total: 0 }),
    ).toBe(null);
  });

  it("2 remaining slots is not the one-slot warning", () => {
    expect(selectDemandBadge({ remaining_student_slots: 2, inquiries_7d: 0, saves_total: 0 })).toBe(
      null,
    );
  });
});

describe("isParentFavorite (#151 trigger)", () => {
  it("more than 5 saves in 30 days qualifies", () => {
    expect(isParentFavorite({ saves_30d: 6, requests_30d: 0 })).toBe(true);
  });

  it("exactly 5 saves does not qualify (strictly greater)", () => {
    expect(isParentFavorite({ saves_30d: 5, requests_30d: 0 })).toBe(false);
  });

  it("more than 3 requests in 30 days qualifies", () => {
    expect(isParentFavorite({ saves_30d: 0, requests_30d: 4 })).toBe(true);
    expect(isParentFavorite({ saves_30d: 0, requests_30d: 3 })).toBe(false);
  });

  it("quiet tutors stay badge-less", () => {
    expect(isParentFavorite({ saves_30d: 0, requests_30d: 0 })).toBe(false);
  });
});

describe("computePopularityScore (#151)", () => {
  it("weights views x1, saves x5, requests x15", () => {
    expect(computePopularityScore({ views_30d: 10, saves_30d: 2, requests_30d: 1 })).toBe(
      10 + 10 + 15,
    );
  });

  it("verified tutors get x1.2", () => {
    const quality: EngagementQuality = { verified: true, topScorer: false };
    expect(computePopularityScore({ views_30d: 10, saves_30d: 0, requests_30d: 0 }, quality)).toBe(
      12,
    );
  });

  it("top scorers get x1.5", () => {
    const quality: EngagementQuality = { verified: false, topScorer: true };
    expect(computePopularityScore({ views_30d: 10, saves_30d: 0, requests_30d: 0 }, quality)).toBe(
      15,
    );
  });

  it("multipliers stack to x1.8", () => {
    const quality: EngagementQuality = { verified: true, topScorer: true };
    expect(
      computePopularityScore({ views_30d: 10, saves_30d: 0, requests_30d: 0 }, quality),
    ).toBeCloseTo(18);
  });
});

describe("isTopScorer (#151 quality flag)", () => {
  it("flags IB 44/45 and DSE 5** from approved labels", () => {
    expect(isTopScorer(["IBDP 45"])).toBe(true);
    expect(isTopScorer(["IBDP 44"])).toBe(true);
    expect(isTopScorer(["DSE 5** (Math)"])).toBe(true);
  });

  it("does not flag ordinary grades or partial matches", () => {
    expect(isTopScorer(["IBDP 41"])).toBe(false);
    expect(isTopScorer(["GCE A-Level A*AA"])).toBe(false);
    expect(isTopScorer(["DSE 4"])).toBe(false);
    expect(isTopScorer([])).toBe(false);
    expect(isTopScorer(null)).toBe(false);
  });

  it("44/45 must be a standalone score, not a substring", () => {
    expect(isTopScorer(["Physics 144 marks"])).toBe(false);
  });
});

describe("selectProfileSocialProof (#102 profile block)", () => {
  const base = { tutor_id: "t1", views_30d: 0, requests_30d: 0, saves_30d: 0 };

  it("shows the inquiries line at >= 3 in 7 days", () => {
    expect(selectProfileSocialProof({ ...base, inquiries_7d: 3, saves_total: 0 })).toEqual({
      showInquiries: true,
      showSaves: false,
    });
    expect(
      selectProfileSocialProof({ ...base, inquiries_7d: 2, saves_total: 0 }).showInquiries,
    ).toBe(false);
  });

  it("shows the saves line at >= 5 total saves", () => {
    expect(selectProfileSocialProof({ ...base, inquiries_7d: 0, saves_total: 5 }).showSaves).toBe(
      true,
    );
    expect(selectProfileSocialProof({ ...base, inquiries_7d: 0, saves_total: 4 }).showSaves).toBe(
      false,
    );
  });

  it("renders nothing below both thresholds", () => {
    expect(selectProfileSocialProof({ ...base, inquiries_7d: 1, saves_total: 2 })).toEqual({
      showInquiries: false,
      showSaves: false,
    });
  });
});

describe("rankTrending (#151 re-rank)", () => {
  it("quality multipliers can reorder the SQL base-score candidates", () => {
    const candidates: TrendingCandidate[] = [
      summary({ tutor_id: "plain", views_30d: 100, base_score: 100 }),
      summary({ tutor_id: "verified", views_30d: 90, base_score: 90 }),
    ];
    const ranked = rankTrending(candidates, (id) =>
      id === "verified"
        ? { verified: true, topScorer: false }
        : { verified: false, topScorer: false },
    );
    expect(ranked[0].tutor_id).toBe("verified");
    expect(ranked[0].popularity_score).toBeCloseTo(108);
    expect(ranked[1].popularity_score).toBe(100);
  });

  it("breaks score ties by requests", () => {
    const candidates: TrendingCandidate[] = [
      summary({ tutor_id: "a", views_30d: 30, requests_30d: 1 }),
      summary({ tutor_id: "b", views_30d: 30, requests_30d: 2 }),
    ];
    const ranked = rankTrending(candidates, () => ({ verified: false, topScorer: false }));
    expect(ranked.map((row) => row.tutor_id)).toEqual(["b", "a"]);
  });

  it("thresholds stay exported for surfaces", () => {
    expect(ENGAGEMENT_THRESHOLDS.highDemandInquiries7d).toBe(3);
  });
});
