import { matchesCategoryFilter, matchesSubjectQuery } from "./subjects";

/**
 * #716: "Suggested for you" for signed-in parents / students. Deterministic
 * (no ML): targets come from the learner profiles and this visit's search,
 * subjects with an active case are excluded (never churn a healthy match),
 * only tutors taking students qualify, and every card carries a reason.
 */

export type SuggestionTarget = {
  curriculum: string | null;
  subject: string;
  /** "search" = searched / profile subject, "complementary" = next subject. */
  kind: "search" | "complementary";
  /** Child or learner name for the reason pill, when known. */
  learnerName?: string;
  /** Teaching level the learner needs (tutor target_students vocabulary). */
  level?: "Kindergarten" | "Primary" | "Secondary" | "University" | null;
};

const LEVEL_FOR_CURRICULUM: Record<string, SuggestionTarget["level"]> = {
  IB: "Secondary",
  DSE: "Secondary",
  IGCSE: "Secondary",
  "A-Level": "Secondary",
  "Junior Secondary": "Secondary",
  "Primary School": "Primary",
  Kindergarten: "Kindergarten",
  University: "University",
};

export type SuggestedTutor<T> = { tutor: T; target: SuggestionTarget; score: number };

type SuggestableTutor = {
  id: string;
  subjects: string[];
  target_students: string[];
  card_highlights?: string[] | null;
  experience_years?: number | null;
  verification_tier?: string | null;
};

/** Popular next subjects per curriculum (#716 §3 Priority C). */
const COMPLEMENTARY: Record<string, string[]> = {
  IB: ["English", "Mathematics", "Chemistry", "Biology", "Economics"],
  DSE: ["English", "Mathematics", "Physics", "Chemistry", "Economics"],
  IGCSE: ["English", "Mathematics", "Physics", "Chemistry", "Biology"],
  "A-Level": ["Mathematics", "Physics", "Chemistry", "Economics", "Biology"],
  "Primary School": ["English", "Mathematics", "Chinese"],
};

const norm = (value: string) => value.trim().toLowerCase();

function sameSubject(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return matchesSubjectQuery(x, y) || matchesSubjectQuery(y, x);
}

/** Build ordered, de-duplicated targets minus excluded (actively matched) subjects. */
export function buildSuggestionTargets(input: {
  interests: {
    curriculum: string | null;
    subjects: string[];
    learnerName?: string;
    level?: SuggestionTarget["level"];
  }[];
  excludedSubjects: string[];
}): SuggestionTarget[] {
  const excluded = (subject: string) =>
    input.excludedSubjects.some((ex) => sameSubject(ex, subject));
  const out: SuggestionTarget[] = [];
  const seen = new Set<string>();
  const push = (target: SuggestionTarget) => {
    const key = `${norm(target.curriculum ?? "")}|${norm(target.subject)}`;
    if (seen.has(key) || excluded(target.subject)) return;
    seen.add(key);
    out.push(target);
  };
  for (const interest of input.interests) {
    for (const subject of interest.subjects) {
      if (subject.trim()) {
        push({
          curriculum: interest.curriculum,
          subject: subject.trim(),
          kind: "search",
          learnerName: interest.learnerName,
          level: interest.level ?? LEVEL_FOR_CURRICULUM[interest.curriculum ?? ""] ?? null,
        });
      }
    }
  }
  for (const interest of input.interests) {
    for (const subject of COMPLEMENTARY[interest.curriculum ?? ""] ?? []) {
      push({
        curriculum: interest.curriculum,
        subject,
        kind: "complementary",
        learnerName: interest.learnerName,
        level: interest.level ?? LEVEL_FOR_CURRICULUM[interest.curriculum ?? ""] ?? null,
      });
    }
  }
  return out;
}

function fitsTarget(tutor: SuggestableTutor, target: SuggestionTarget): boolean {
  if (!tutor.subjects.some((s) => sameSubject(s, target.subject))) return false;
  // A tutor who lists teaching levels must list the learner's level.
  if (
    target.level &&
    tutor.target_students.length > 0 &&
    !tutor.target_students.includes(target.level)
  ) {
    return false;
  }
  if (!target.curriculum) return true;
  if (
    ["Primary School", "Kindergarten", "University", "Junior Secondary"].includes(target.curriculum)
  ) {
    return true;
  }
  return matchesCategoryFilter(target.curriculum.toLowerCase(), tutor.subjects, [
    ...tutor.target_students,
    ...(tutor.card_highlights ?? []),
  ]);
}

/**
 * Up to `limit` tutors, each paired with the first (highest-priority) target
 * it fits. `isTakingStudents` keeps full / paused tutors out (#716 rule).
 */
export function suggestTutors<T extends SuggestableTutor>(
  tutors: readonly T[],
  targets: readonly SuggestionTarget[],
  isTakingStudents: (tutor: T) => boolean,
  limit = 6,
): SuggestedTutor<T>[] {
  if (targets.length === 0) return [];
  const picks: SuggestedTutor<T>[] = [];
  for (const tutor of tutors) {
    if (!isTakingStudents(tutor)) continue;
    const index = targets.findIndex((target) => fitsTarget(tutor, target));
    if (index < 0) continue;
    const target = targets[index];
    const score =
      (target.kind === "search" ? 100 : 50) -
      index +
      (tutor.verification_tier === "tier_2_verified" ? 5 : 0) +
      Math.min(tutor.experience_years ?? 0, 10) / 2;
    picks.push({ tutor, target, score });
  }
  picks.sort((a, b) => b.score - a.score || a.tutor.id.localeCompare(b.tutor.id));
  // Spread across targets first so one subject never fills the whole row.
  const byTarget = new Map<string, SuggestedTutor<T>[]>();
  for (const pick of picks) {
    const key = `${pick.target.curriculum}|${pick.target.subject}`;
    byTarget.set(key, [...(byTarget.get(key) ?? []), pick]);
  }
  const queues = [...byTarget.values()];
  const result: SuggestedTutor<T>[] = [];
  while (result.length < limit && queues.some((q) => q.length > 0)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next && result.length < limit) result.push(next);
    }
  }
  return result;
}
