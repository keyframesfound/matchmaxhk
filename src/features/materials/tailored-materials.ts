import { normalizeLearnerCurriculum } from "../children/learner-context";
import { matchesSubjectQuery } from "../tutors/subjects";

/**
 * #700: split the Marketplace feed into "Recommended {curriculum} materials
 * for you" and everything else. Never hides anything: non-matching
 * listings move under the "Explore other curricula" divider.
 */

export type MaterialTailoring = { curriculum: string | null; subjects: string[] };

type TailorableMaterial = { curriculum_tag: string; subject_tag?: string | null };

export function materialMatchesTailoring(
  material: TailorableMaterial,
  tailoring: MaterialTailoring,
): boolean {
  if (tailoring.curriculum) {
    return normalizeLearnerCurriculum(material.curriculum_tag) === tailoring.curriculum;
  }
  const subject = material.subject_tag ?? "";
  return (
    tailoring.subjects.length > 0 &&
    tailoring.subjects.some((wanted) => matchesSubjectQuery(subject, wanted.toLowerCase()))
  );
}

function subjectHits(material: TailorableMaterial, subjects: string[]): number {
  const subject = material.subject_tag ?? "";
  if (!subject) return 0;
  return subjects.filter((wanted) => matchesSubjectQuery(subject, wanted.toLowerCase())).length;
}

/** Stable split: matches first (more subject hits ahead), the rest keep order. */
export function splitTailored<T extends TailorableMaterial>(
  materials: readonly T[],
  tailoring: MaterialTailoring | null,
): { recommended: T[]; others: T[] } {
  if (!tailoring || (!tailoring.curriculum && tailoring.subjects.length === 0)) {
    return { recommended: [], others: [...materials] };
  }
  const recommended: { item: T; hits: number; index: number }[] = [];
  const others: T[] = [];
  materials.forEach((item, index) => {
    if (materialMatchesTailoring(item, tailoring)) {
      recommended.push({ item, hits: subjectHits(item, tailoring.subjects), index });
    } else {
      others.push(item);
    }
  });
  recommended.sort((a, b) => b.hits - a.hits || a.index - b.index);
  return { recommended: recommended.map((entry) => entry.item), others };
}
