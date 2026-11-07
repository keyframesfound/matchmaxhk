/**
 * Issue #673 — unified deterministic Profile Strength (0–100%) and the
 * single Next-Best-Action (NBA) CTA. One module, so the /calendar empty
 * shell, the Activity dashboard (#670) and any future surface compute the
 * SAME score from the same signals and never diverge.
 *
 * Weighting (sums to 100): the signals mirror the tutor profile fields the
 * marketplace actually ranks on. The 14-day availability freshness rule
 * (#673) temporarily deducts 15 points on top of the earned score.
 */

export type ProfileStrengthSignals = {
  role: "tutor" | "other";
  hasDisplayName: boolean;
  hasBio: boolean;
  subjectsCount: number;
  hasPhoto: boolean;
  isPublished: boolean;
  hasRates: boolean;
  hasAvailability: boolean;
  hasWeeklyWindows: boolean;
  /** #673 14-day freshness: stale grids deduct 15 while unconfirmed. */
  freshnessDeduction?: number;
};

export type ProfileStrengthResult = {
  score: number;
  /** The ONE next-best-action, ordered by weight then effort. */
  nba: NextBestAction | null;
  breakdown: { id: StrengthItem; done: boolean; points: number }[];
};

export type StrengthItem =
  | "display_name"
  | "photo"
  | "subjects"
  | "bio"
  | "rates"
  | "availability"
  | "weekly_windows"
  | "publish";

export type NextBestAction = {
  id: StrengthItem;
  href: string;
  points: number;
};

const WEIGHTS: Record<StrengthItem, number> = {
  display_name: 10,
  photo: 15,
  subjects: 20,
  bio: 10,
  rates: 15,
  availability: 10,
  weekly_windows: 10,
  publish: 10,
};

/** Where each unfinished item is fixed (dashboard hash routes). */
const NBA_HREF: Record<StrengthItem, string> = {
  display_name: "/dashboard#my-tutor",
  photo: "/dashboard#my-tutor",
  subjects: "/dashboard#my-tutor",
  bio: "/dashboard#my-tutor",
  rates: "/dashboard#my-tutor",
  availability: "/dashboard#availability",
  weekly_windows: "/dashboard#availability",
  publish: "/dashboard#my-tutor",
};

/** Deterministic: same signals → same score and same single NBA. */
export function profileStrength(signals: ProfileStrengthSignals): ProfileStrengthResult {
  const breakdown: ProfileStrengthResult["breakdown"] = [];
  const push = (id: StrengthItem, done: boolean) =>
    breakdown.push({ id, done, points: WEIGHTS[id] });

  const hasSubjects = signals.role === "tutor" && signals.subjectsCount > 0;
  push("display_name", signals.hasDisplayName);
  push("photo", signals.hasPhoto);
  push("subjects", hasSubjects);
  push("bio", signals.hasBio);
  push("rates", signals.role === "tutor" && signals.hasRates);
  push("availability", signals.role === "tutor" && signals.hasAvailability);
  push("weekly_windows", signals.role === "tutor" && signals.hasWeeklyWindows);
  push("publish", signals.role === "tutor" && signals.isPublished);

  const earned = breakdown.reduce((sum, b) => sum + (b.done ? b.points : 0), 0);
  const deduction = Math.max(0, signals.freshnessDeduction ?? 0);
  const score = Math.max(0, Math.min(100, earned - deduction));

  // NBA: the highest-weight open item; publish last so the profile is
  // complete before it goes live. Availability freshness owns the CTA when
  // the grid is stale (one tap, no edit).
  const order: StrengthItem[] = [
    "subjects",
    "photo",
    "availability",
    "weekly_windows",
    "rates",
    "publish",
    "display_name",
    "bio",
  ];
  let nba: NextBestAction | null = null;
  if (deduction > 0) {
    nba = { id: "availability", href: NBA_HREF.availability, points: deduction };
  } else {
    const open = order.find((id) => !breakdown.find((b) => b.id === id)?.done);
    nba = open ? { id: open, href: NBA_HREF[open], points: WEIGHTS[open] } : null;
  }

  return { score, nba, breakdown };
}
