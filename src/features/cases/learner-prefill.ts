import { getCurriculumOptionsForLevel } from "./case-options";
import { storedStudentLevel } from "./case-verticals";
import {
  learnerFunnelLevel,
  learnerSecondaryBand,
  type LearnerContext,
} from "../children/learner-context";

/**
 * #698 §3.6: Case Request fields pre-filled from the selected learner
 * (grade → level/band, curriculum when coherent with that level, subjects).
 * Everything stays editable; the form only writes a field that is empty or
 * still holds the previous pre-fill, so manual edits are never overwritten.
 */
export type LearnerPrefill = {
  whoFor?: string;
  studentId?: string;
  supportType?: string;
  academicLevel?: string;
  secondaryBand?: string;
  year?: string;
  curriculum?: string;
  subject1?: string;
  subject2?: string;
  subject3?: string;
  subject4?: string;
};

export function learnerPrefill(ctx: LearnerContext | null): LearnerPrefill {
  if (!ctx) return {};
  const patch: LearnerPrefill = {};
  if (ctx.source === "child" && ctx.childId) {
    patch.whoFor = "my_child";
    patch.studentId = ctx.childId;
  }
  const funnel = learnerFunnelLevel(ctx.level);
  if (funnel) {
    patch.supportType = "subject_tutoring";
    patch.academicLevel = funnel;
    const band = learnerSecondaryBand(ctx.level);
    if (funnel === "Secondary" && band) patch.secondaryBand = band;
    const year = storedStudentLevel(funnel, band);
    if (year) patch.year = year;
  }
  const allowed = getCurriculumOptionsForLevel(funnel).map((option) => option.value);
  if (ctx.curriculum && allowed.includes(ctx.curriculum)) patch.curriculum = ctx.curriculum;
  else if (funnel && allowed.length === 1) patch.curriculum = allowed[0];
  const [s1, s2, s3, s4] = ctx.subjects;
  if (s1) patch.subject1 = s1;
  if (s2) patch.subject2 = s2;
  if (s3) patch.subject3 = s3;
  if (s4) patch.subject4 = s4;
  return patch;
}

/**
 * Merge a new pre-fill into the current form: a field takes the new value
 * only when it is empty or still equals what the last pre-fill wrote.
 */
export function applyLearnerPrefill<T extends Record<string, unknown>>(
  form: T,
  next: LearnerPrefill,
  previous: LearnerPrefill,
): T {
  const out: Record<string, unknown> = { ...form };
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]) as Set<
    keyof LearnerPrefill
  >;
  for (const key of keys) {
    const current = out[key];
    const untouched = current === "" || current === undefined || current === previous[key];
    if (!untouched) continue;
    out[key] = next[key] ?? (current === previous[key] ? "" : current);
  }
  return out as T;
}
