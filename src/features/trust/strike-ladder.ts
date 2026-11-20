/**
 * #782 AC-703-3 (CEO lock, 2026-11-20): the concierge strike ladder.
 *
 * Applies ONLY to matching / pre-lesson unresponsiveness, no-shows and bad
 * behaviour (behaviour_reports). Separate from Urgent Safety quarantine and
 * from the Notes shop #559 seller strikes.
 *
 *   1 strike  → warning; staff see the count; no automatic penalty.
 *   2 strikes → no NEW matches for 14 days from the 2nd strike; existing
 *               cases continue.
 *   3 strikes → new matches stay paused, and the Trust & Safety desk is told
 *               to decide on Freeze & Suspend. Staff confirm; the system never
 *               bans or freezes on its own.
 *
 * Strike counts are never shown on a public tutor card.
 */

export const STRIKE_CATEGORIES = ["unresponsive", "no_show", "hostile", "boundary"] as const;
export const PAUSE_DAYS_AT_TWO_STRIKES = 14;
export const FREEZE_REVIEW_STRIKES = 3;

export function isStrikeCategory(category: string): boolean {
  return (STRIKE_CATEGORIES as readonly string[]).includes(category);
}

export type StrikeLadderState = {
  strikes: number;
  level: 0 | 1 | 2 | 3;
  /** New matches are blocked right now. */
  matchPaused: boolean;
  /** End of the 14-day pause at level 2 (null when not time-limited). */
  pausedUntil: string | null;
  /** Level 3: staff must decide on Freeze & Suspend. */
  needsFreezeReview: boolean;
};

/** `activeStrikeTimes`: created_at of non-voided strikes, any order. */
export function strikeLadder(activeStrikeTimes: readonly string[], now: Date): StrikeLadderState {
  const times = [...activeStrikeTimes].sort();
  const strikes = times.length;
  if (strikes >= FREEZE_REVIEW_STRIKES) {
    return { strikes, level: 3, matchPaused: true, pausedUntil: null, needsFreezeReview: true };
  }
  if (strikes === 2) {
    const until = new Date(
      Date.parse(times[1]) + PAUSE_DAYS_AT_TWO_STRIKES * 24 * 60 * 60 * 1000,
    ).toISOString();
    return {
      strikes,
      level: 2,
      matchPaused: now.getTime() < Date.parse(until),
      pausedUntil: until,
      needsFreezeReview: false,
    };
  }
  return {
    strikes,
    level: strikes === 1 ? 1 : 0,
    matchPaused: false,
    pausedUntil: null,
    needsFreezeReview: false,
  };
}

/** Staff / tutor-facing text for the #782 introduction blocks (EN + 繁中). */
export const INTRO_BLOCK_MESSAGES = {
  SAFETY_ATTESTATION_REQUIRED:
    "需先完成安全聲明 / Safety Declaration required first. The tutor sees it on their next apply, submit or dashboard visit; introduce them after they complete it.",
  MATCH_PAUSED_STRIKES:
    "暫停新配對（違規 2 次或以上）/ New matches paused: 2+ concierge strikes. Existing cases continue.",
  PARENT_MATCH_PAUSED_STRIKES:
    "家長暫停新配對（違規 2 次或以上）/ This parent's new matches are paused: 2+ concierge strikes. Existing cases continue.",
} as const;
export type IntroBlockCode = keyof typeof INTRO_BLOCK_MESSAGES;
