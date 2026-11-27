/**
 * Issue #816 §2.7 / AC-428-3 — explainable shortlist, pure helpers.
 *
 * The RPC emits machine tokens (never prose) so the SQL and the desk copy can
 * move independently. The desk is English-first; the labels live here, not in
 * the locale files. Unknown tokens are dropped: the UI must never show a raw
 * token even if the function grows a term before this file does.
 */

/** Desk Top-8 shortlist size (the RPC default is also 8). */
export const SHORTLIST_LIMIT = 8;

/** A score at or above this counts as a strong match for the desk warning. */
export const STRONG_MATCH_SCORE = 40;

/**
 * Every token public.match_tutors_for_case can emit, in the SQL's stable
 * order (see 20261127130000_issue_816_shortlist_why.sql).
 */
export const WHY_TOKENS = [
  "subject",
  "district",
  "rate_full",
  "rate_partial",
  "mode",
  "gender",
  "background",
  "language",
  "experience",
  "paid_fee",
  "easy_desk",
] as const;

export type WhyToken = (typeof WHY_TOKENS)[number];

export const WHY_LABELS: Record<WhyToken, string> = {
  subject: "Same subject",
  district: "Same district",
  rate_full: "Rate fit",
  rate_partial: "Rate close",
  mode: "Mode fit",
  gender: "Gender fit",
  background: "Background fit",
  language: "Language fit",
  experience: "Experience",
  paid_fee: "Past paid fee",
  easy_desk: "Easy desk",
};

const WHY_TOKEN_SET: ReadonlySet<string> = new Set(WHY_TOKENS);

/** Token list → desk labels, ignoring anything the RPC does not define. */
export function whyLabels(tokens: readonly string[] | null | undefined): string[] {
  if (!tokens) return [];
  const labels: string[] = [];
  for (const token of tokens) {
    if (!WHY_TOKEN_SET.has(token)) continue;
    labels.push(WHY_LABELS[token as WhyToken]);
  }
  return labels;
}

export function isStrongMatch(score: number): boolean {
  return Number.isFinite(score) && score >= STRONG_MATCH_SCORE;
}

/** How many shortlist rows clear the strong-match bar (drives the warning). */
export function strongMatchCount(rows: readonly { score: number }[]): number {
  return rows.reduce((count, row) => (isStrongMatch(row.score) ? count + 1 : count), 0);
}

/**
 * What getShortlistPin read from tutoring_cases. `available: false` means the
 * #816 migration is not applied in this environment yet (undefined column).
 */
export type ShortlistPinRead = {
  pinnedTutorId: string | null;
  available: boolean;
};

export type ShortlistPinView = {
  pinnedTutorId: string | null;
  /** Pin/Unpin and the code input render only when the column exists. */
  showControls: boolean;
};

/**
 * Deploy-order guard: before the migration lands, an unavailable read must
 * look exactly like "no pin" AND hide the controls, so no browser query ever
 * selects a missing column and no pin write can 400.
 */
export function pinAvailability(read: ShortlistPinRead | null | undefined): ShortlistPinView {
  if (!read || !read.available) return { pinnedTutorId: null, showControls: false };
  return { pinnedTutorId: read.pinnedTutorId ?? null, showControls: true };
}

/** Pinned tutor first, everyone else in RPC score order (stable). */
export function sortPinnedFirst<T extends { id: string }>(
  rows: readonly T[],
  pinnedId: string | null | undefined,
): T[] {
  if (!pinnedId) return [...rows];
  const pinned = rows.filter((row) => row.id === pinnedId);
  if (pinned.length === 0) return [...rows];
  return [...pinned, ...rows.filter((row) => row.id !== pinnedId)];
}
