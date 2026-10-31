import { z } from "zod";

/**
 * Issue #459 slice 2: child sub-profiles live in public.students (created by
 * #530 as the per-student pack holder, "#459 will own the full profile").
 * A parent can add several; a case links to one so siblings never mix.
 */

/** Soft warning only past this many children; never a hard block (#459 §4.3). */
export const CHILD_SOFT_LIMIT = 5;

const NICKNAME_MAX = 40;
const SCHOOL_MAX = 120;
const CURRICULUM_MAX = 40;
const GRAD_YEAR_MIN = 2000;
const GRAD_YEAR_MAX = 2100;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));

export const ChildInput = z.object({
  nickname: z.string().trim().min(1).max(NICKNAME_MAX),
  school: optionalText(SCHOOL_MAX),
  curriculum: optionalText(CURRICULUM_MAX),
  gradYear: z
    .number()
    .int()
    .min(GRAD_YEAR_MIN)
    .max(GRAD_YEAR_MAX)
    .nullish()
    .transform((value) => value ?? null),
});

export type ChildInputValue = z.infer<typeof ChildInput>;

export type ChildProfile = {
  id: string;
  nickname: string;
  school: string | null;
  curriculum: string | null;
  gradYear: number | null;
  /** #459: managed_by_parent until the child claims their own account. */
  status: "managed_by_parent" | "linked_independent" | "claimed_independent";
  /** #459 §4.4: what the parent keeps once the child claims the profile. */
  canViewSchedule: boolean;
  canManageBilling: boolean;
};

export function shouldWarnChildCount(count: number): boolean {
  return count > CHILD_SOFT_LIMIT;
}

/**
 * A case may only link a child the submitting parent owns and hasn't
 * archived. Anything else is dropped, never rejected (#396 precedent), so a
 * stale picker or tampered id can't fail the whole request.
 */
export function ownedChildIdOrNull(
  requested: string | null | undefined,
  owned: readonly { id: string; archived_at: string | null }[],
): string | null {
  if (!requested) return null;
  const match = owned.find((child) => child.id === requested);
  return match && !match.archived_at ? match.id : null;
}

/** #459 §C "Who is learning?" pill value: everyone, the account holder, or a child id. */
export type LearnerFilter = "all" | "myself" | string;

type LearnerCase = { student_id: string | null; who_for: string | null };

export function filterCasesByLearner<T extends LearnerCase>(
  cases: readonly T[],
  filter: LearnerFilter,
): T[] {
  if (filter === "all") return [...cases];
  if (filter === "myself") return cases.filter((row) => row.who_for === "myself");
  return cases.filter((row) => row.student_id === filter);
}

/**
 * #459 §4.4: claimed children whose parent switched schedule view off. A
 * parent-set preference (they still own the case rows), so it filters the
 * parent's lists rather than gating access.
 */
export function hiddenChildIds(children: readonly ChildProfile[]): Set<string> {
  return new Set(
    children
      .filter((child) => child.status === "claimed_independent" && !child.canViewSchedule)
      .map((child) => child.id),
  );
}
