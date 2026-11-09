import { normalizeProfileTag } from "../tutors/profile-tags";
import { caseAcademicTier, tutorTierMembership } from "../tutors/verticals";

/**
 * #699: "Best Match for You" on the case board, the tutor-side mirror of
 * #698. A deterministic, soft score of an open case against the signed-in
 * independent tutor's own profile. It only orders the board (never hides a
 * case) and badges strong fits. Same signals as the #657 match waves, but
 * without the hard exclusions, because the tutor chose to browse.
 */

export type TutorMatchProfile = {
  subjects: string[];
  targetStudents: string[];
  lessonMode: string | null;
  stations: string[];
  district: string | null;
  gender: string | null;
  tutorStatus: string | null;
  profileTags: string[];
};

export type BoardCase = {
  subjects: string[];
  studentLevel: string;
  academicTier: string | null;
  examSystem: string | null;
  district: string | null;
  mode: string;
  preferredGender: string;
  tutorBackground: string | null;
  tags: string[];
};

export type CaseMatch = { score: number; matched: boolean };

/** Score at or above which a case shows "Matches your profile". */
export const MATCH_BADGE_SCORE = 70;

const lower = (value: string) => value.trim().toLowerCase();

/** A profile without subjects or teaching levels cannot be matched. */
export function isMatchProfileComplete(profile: TutorMatchProfile | null): boolean {
  return Boolean(profile && profile.subjects.length > 0 && profile.targetStudents.length > 0);
}

function subjectOverlap(c: BoardCase, p: TutorMatchProfile): number {
  const taught = p.subjects.map(lower);
  return c.subjects.filter((subject) => {
    const wanted = lower(subject);
    return taught.some((own) => own === wanted || own.includes(wanted) || wanted.includes(own));
  }).length;
}

export function scoreCaseForTutor(c: BoardCase, p: TutorMatchProfile | null): CaseMatch {
  if (!isMatchProfileComplete(p) || !p) return { score: 0, matched: false };
  let score = 0;

  // (1) Subject: the strongest signal.
  const overlap = subjectOverlap(c, p);
  const subjectFit = overlap > 0;
  if (subjectFit) score += 40 + Math.min(overlap - 1, 2) * 5;

  // (2) Student stage (Kindergarten / Primary & Secondary / University).
  const tier = caseAcademicTier(c.academicTier, c.studentLevel);
  const stageFit = !tier || tutorTierMembership(p.targetStudents).has(tier);
  if (tier && stageFit) score += 20;

  // (3) Curriculum: the case's exam system named in the tutor's targets or subjects.
  const exam = lower(c.examSystem ?? "");
  const curriculumFit =
    !exam ||
    p.targetStudents.some((target) => lower(target) === exam) ||
    p.subjects.some((subject) => lower(subject).includes(exam));
  if (exam && curriculumFit) score += 15;

  // (4) Mode / area.
  const offers = p.lessonMode ?? "either";
  if (
    c.mode === "online"
      ? offers !== "in_person"
      : c.mode === "in_person"
        ? offers !== "online"
        : true
  ) {
    const areas = [...p.stations, ...(p.district ? [p.district] : [])];
    if (c.mode !== "in_person" || !c.district || areas.includes(c.district)) score += 15;
  }

  // (5) Soft extras: gender preference, shared tag or the asked-for background.
  const wanted = lower(c.preferredGender ?? "any");
  if (wanted === "any" || !p.gender || lower(p.gender) === wanted) score += 5;
  const owned = new Set(p.profileTags.map(normalizeProfileTag));
  const sharesTag = c.tags.some((tag) => owned.has(normalizeProfileTag(tag)));
  const fitsBackground =
    (c.tutorBackground === "official_examiner" && p.tutorStatus === "examiner") ||
    (c.tutorBackground === "uni_student" &&
      (p.tutorStatus === "uni_student" || p.tutorStatus === "uni_undergrad"));
  if (sharesTag || fitsBackground) score += 5;

  score = Math.max(0, Math.min(100, score));
  return {
    score,
    matched: subjectFit && stageFit && curriculumFit && score >= MATCH_BADGE_SCORE,
  };
}

/** Stable re-order, best match first; ties keep the incoming (latest) order. */
export function sortCasesByBestMatch<T extends BoardCase & { id: string }>(
  cases: readonly T[],
  profile: TutorMatchProfile | null,
): { items: T[]; matches: Map<string, CaseMatch> } {
  const matches = new Map<string, CaseMatch>();
  for (const item of cases) matches.set(item.id, scoreCaseForTutor(item, profile));
  if (!isMatchProfileComplete(profile)) return { items: [...cases], matches };
  const items = cases
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        (matches.get(b.item.id)?.score ?? 0) - (matches.get(a.item.id)?.score ?? 0) ||
        a.index - b.index,
    )
    .map((entry) => entry.item);
  return { items, matches };
}
