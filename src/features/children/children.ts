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
