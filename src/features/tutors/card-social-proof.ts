// Issue #768 (Part 2 §3.A / §5): a public tutor discovery card shows at most
// ONE muted social-proof line, with strict thresholds, plus a separate muted
// "Last slot" line. Pure function so the thresholds stay unit-tested; the card
// feeds it through its optional `socialProof` prop. Never render 0.

export type TutorCardSocialProofInput = {
  activeCasesCount?: number | null;
  engagementCount?: number | null;
  slotsLeft?: number | null;
};

export type TutorCardSocialProof = {
  /** Render only when !== null. */
  activeStudents: number | null;
  /** Render only when !== null (and no active-students line wins). */
  savedByParents: number | null;
  /** Render only when true. */
  lastSlot: boolean;
};

// Issue #768 thresholds — do not lower.
const ACTIVE_STUDENTS_MIN = 2;
const SAVED_BY_PARENTS_MIN = 3;
const LAST_SLOT_SLOTS_LEFT = 1;

/** Non-finite / negative / missing inputs are treated as 0. */
function toCount(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return value;
}

export function selectTutorCardSocialProof(
  input?: TutorCardSocialProofInput | null,
): TutorCardSocialProof {
  const activeCasesCount = toCount(input?.activeCasesCount);
  const engagementCount = toCount(input?.engagementCount);
  const slotsLeft = toCount(input?.slotsLeft);

  // Active students wins; the parents line only fills the gap when it is absent.
  const activeStudents = activeCasesCount >= ACTIVE_STUDENTS_MIN ? activeCasesCount : null;
  const savedByParents =
    activeStudents === null && engagementCount >= SAVED_BY_PARENTS_MIN ? engagementCount : null;

  // "Last slot" needs a real class already running, never a raw slot count.
  const lastSlot = slotsLeft === LAST_SLOT_SLOTS_LEFT && activeCasesCount >= ACTIVE_STUDENTS_MIN;

  return { activeStudents, savedByParents, lastSlot };
}
