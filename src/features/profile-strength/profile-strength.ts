/**
 * Issue #576 §10: the one Profile Strength checklist. Account, Channel Profile
 * and Case Manager all read this, and exactly one next-best-action shows at a
 * time, in the issue's priority order.
 */

export type TutorSignals = {
  kind: "tutor";
  hasWindows: boolean;
  hasSubjects: boolean;
  hasRate: boolean;
  hasPhoto: boolean;
  hasBlueTick: boolean;
  blueTickInReview: boolean;
  isPublished: boolean;
};

export type ParentSignals = {
  kind: "parent";
  hasCase: boolean;
  hasBriefing: boolean;
  hasPreferredTimes: boolean;
};

export type StrengthSignals = TutorSignals | ParentSignals;

export type NextAction =
  | "availability"
  | "subjects_rate"
  | "blue_tick"
  | "publish"
  | "post_case"
  | "briefing"
  | "preferred_times";

export type ProfileStrength = {
  pct: number;
  next: NextAction | null;
  blueTick: "verified" | "in_review" | "none" | null;
};

function percent(checks: readonly boolean[]): number {
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function computeStrength(signals: StrengthSignals): ProfileStrength {
  if (signals.kind === "parent") {
    const order: [boolean, NextAction][] = [
      [signals.hasCase, "post_case"],
      [signals.hasBriefing, "briefing"],
      [signals.hasPreferredTimes, "preferred_times"],
    ];
    return {
      pct: percent(order.map(([done]) => done)),
      next: order.find(([done]) => !done)?.[1] ?? null,
      blueTick: null,
    };
  }
  const hasSubjectsRate = signals.hasSubjects && signals.hasRate;
  // A credential already in review is not the user's next step.
  const blueTickDone = signals.hasBlueTick || signals.blueTickInReview;
  const order: [boolean, NextAction][] = [
    [signals.hasWindows, "availability"],
    [hasSubjectsRate, "subjects_rate"],
    [signals.hasPhoto && blueTickDone, "blue_tick"],
    [signals.isPublished, "publish"],
  ];
  return {
    pct: percent([
      signals.hasWindows,
      signals.hasSubjects,
      signals.hasRate,
      signals.hasPhoto,
      signals.hasBlueTick,
      signals.isPublished,
    ]),
    next: order.find(([done]) => !done)?.[1] ?? null,
    blueTick: signals.hasBlueTick ? "verified" : signals.blueTickInReview ? "in_review" : "none",
  };
}
