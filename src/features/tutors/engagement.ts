// Issues #102 + #151, engagement metrics: thresholds, badge selection and
// the trending popularity score. Pure functions (vitest target); the live
// numbers come from the get_tutor_engagement / get_trending_tutors RPCs
// (migration 20261016150000).

export type EngagementSummary = {
  tutor_id: string;
  inquiries_7d: number;
  views_30d: number;
  requests_30d: number;
  saves_total: number;
  saves_30d: number;
};

export type EngagementQuality = {
  /** tier_2 verified tutors get the 1.2x quality multiplier (#151). */
  verified: boolean;
  /** Official-examiner / top-scorer tutors get the 1.5x multiplier (#151). */
  topScorer: boolean;
};

export type DemandBadgeKind = "one_slot_left" | "high_demand" | "popular";

// #102 thresholds. Empty-restaurant guardrail: below these the badge block is
// hidden entirely, never render "0 inquiries" or "1 save".
export const ENGAGEMENT_THRESHOLDS = {
  slotWarning: 1,
  highDemandInquiries7d: 3,
  popularSaves: 10,
  parentFavoriteSaves30d: 5,
  parentFavoriteRequests30d: 3,
  /** #102 profile text block: show the "Saved by X parents" line at >= 5. */
  profileSavesMin: 5,
} as const;

/**
 * #102 profile-detail social-proof block: show each line only above its
 * threshold; with both below, render nothing at all (never "0 inquiries").
 * The "typical response time" line is deliberately NOT part of this, we do
 * not track response times, and inventing the number would be a fake claim.
 */
export function selectProfileSocialProof(summary: EngagementSummary): {
  showInquiries: boolean;
  showSaves: boolean;
} {
  return {
    showInquiries: summary.inquiries_7d >= ENGAGEMENT_THRESHOLDS.highDemandInquiries7d,
    showSaves: summary.saves_total >= ENGAGEMENT_THRESHOLDS.profileSavesMin,
  };
}

/**
 * #102 badge hierarchy on the tutor card:
 * 1. remaining slots == 1        -> "Only 1 slot left" (amber)
 * 2. inquiries last 7 days >= 3  -> "High demand" (red)
 * 3. total saves >= 10           -> "Popular" (neutral)
 * Otherwise null, the card renders no demand badge.
 */
export function selectDemandBadge(input: {
  remaining_student_slots: number | null | undefined;
  inquiries_7d: number;
  saves_total: number;
}): DemandBadgeKind | null {
  if (input.remaining_student_slots === ENGAGEMENT_THRESHOLDS.slotWarning) {
    return "one_slot_left";
  }
  if (input.inquiries_7d >= ENGAGEMENT_THRESHOLDS.highDemandInquiries7d) {
    return "high_demand";
  }
  if (input.saves_total >= ENGAGEMENT_THRESHOLDS.popularSaves) {
    return "popular";
  }
  return null;
}

/**
 * #151 Parent Favorite trigger: MORE than 5 saves OR more than 3 direct
 * requests in the last 30 days (strictly greater, exactly 5/3 stays hidden).
 */
export function isParentFavorite(
  summary: Pick<EngagementSummary, "saves_30d" | "requests_30d">,
): boolean {
  return (
    summary.saves_30d > ENGAGEMENT_THRESHOLDS.parentFavoriteSaves30d ||
    summary.requests_30d > ENGAGEMENT_THRESHOLDS.parentFavoriteRequests30d
  );
}

/**
 * #151 rolling-30-day popularity score: views x1, saves x5, requests x15,
 * with quality multipliers stacking (verified x1.2, top-scorer x1.5).
 */
export function computePopularityScore(
  summary: Pick<EngagementSummary, "views_30d" | "saves_30d" | "requests_30d">,
  quality: EngagementQuality = { verified: false, topScorer: false },
): number {
  const base = summary.views_30d + summary.saves_30d * 5 + summary.requests_30d * 15;
  const multiplier = (quality.verified ? 1.2 : 1) * (quality.topScorer ? 1.5 : 1);
  return base * multiplier;
}

/**
 * #151 quality flag, conservative top-scorer detection over APPROVED grade
 * labels only: IB 44/45 or a DSE 5**. Anything else stays unmultipled until
 * we have a real examiner flag to key off.
 */
export function isTopScorer(approvedGradeLabels: string[] | null | undefined): boolean {
  return (approvedGradeLabels ?? []).some(
    (label) => /\b(44|45)\b/.test(label) || label.includes("5**"),
  );
}

export type TrendingCandidate = EngagementSummary & { base_score: number };

export type RankedTrending = TrendingCandidate & { popularity_score: number };

/**
 * Re-rank the RPC's base-score candidate set with the quality multipliers
 * applied, highest score first (requests break ties).
 */
export function rankTrending(
  candidates: TrendingCandidate[],
  qualityFor: (tutorId: string) => EngagementQuality,
): RankedTrending[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      popularity_score: computePopularityScore(candidate, qualityFor(candidate.tutor_id)),
    }))
    .sort((a, b) => b.popularity_score - a.popularity_score || b.requests_30d - a.requests_30d);
}
