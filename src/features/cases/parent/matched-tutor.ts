/**
 * Issue #529 bait-and-switch card (on match confirm): the parent sees who was
 * matched — name, photo, university, locked rate, student count — so the
 * person at the door can be checked against the MatchMax profile. Only
 * public-profile fields; contact details stay behind progressive reveal.
 */

export type MatchedTutorRow = {
  tutor_code: string | null;
  display_name: string | null;
  photo_url: string | null;
  undergrad_university: string | null;
};

export type MatchedTutorCardView = {
  tutorCode: string | null;
  displayName: string;
  initials: string;
  photoUrl: string | null;
  university: string | null;
  hourlyRateHkd: number | null;
  studentCount: number;
};

const blankToNull = (v: string | null | undefined): string | null => {
  const s = (v ?? "").trim();
  return s ? s : null;
};

export function tutorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => Array.from(p)[0]?.toUpperCase() ?? "")
    .join("");
}

export function matchedTutorCard(input: {
  tutor: MatchedTutorRow | MatchedTutorRow[] | null;
  hourlyRateHkd: number | null;
  studentCount: number | null;
}): MatchedTutorCardView | null {
  // The fkey embed's runtime shape oscillates between object and array.
  const tutor = Array.isArray(input.tutor) ? (input.tutor[0] ?? null) : input.tutor;
  if (!tutor) return null;
  const displayName = blankToNull(tutor.display_name) ?? "—";
  const rate = Number(input.hourlyRateHkd);
  const students = Number(input.studentCount);
  return {
    tutorCode: blankToNull(tutor.tutor_code),
    displayName,
    initials: tutorInitials(displayName === "—" ? "" : displayName),
    photoUrl: blankToNull(tutor.photo_url),
    university: blankToNull(tutor.undergrad_university),
    hourlyRateHkd: Number.isFinite(rate) && rate > 0 ? rate : null,
    studentCount: Number.isInteger(students) && students >= 1 ? students : 1,
  };
}
