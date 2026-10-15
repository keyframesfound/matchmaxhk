import { buildAcademicHeadline } from "@/lib/academic-headline";
import {
  normalizeApplicationPricingTiers,
  type TutorApplication,
} from "@/lib/tutor-application.schema";

/**
 * Issue #310 — go live on submit.
 *
 * Deterministic mapping from a stored tutor application (the jsonb `data`
 * written by submitTutorApplication) to a `tutors` INSERT payload. This is
 * intentionally NOT the AI autofill: no field is invented. Fields without an
 * obvious application counterpart (gender, headline, card_highlights,
 * exam_results, target_students, experience_years) are left empty so staff
 * can fill them from /admin/tutors later.
 */

export type TutorCardLessonMode = "online" | "in_person" | "either";

export type TutorCardTutorStatus = "uni_student" | "full_part_time_tutor" | "examiner";

/** Application "Current status" answer → tutors.tutor_status badge code. */
export function mapApplicationStatusToTutorStatus(
  status: TutorApplication["status"],
): TutorCardTutorStatus {
  switch (status) {
    case "University Student":
      return "uni_student";
    case "Full/Part-Time Tutor":
      return "full_part_time_tutor";
    case "Professional Teacher/ Public Exam Examiner":
      return "examiner";
  }
}

/** Application lesson format answer → tutors.lesson_mode enum value. */
export function mapApplicationFormatToLessonMode(
  format: TutorApplication["format"],
): TutorCardLessonMode {
  if (format === "Online") return "online";
  if (format === "Face to face") return "in_person";
  return "either";
}

/**
 * Splits a comma/newline-joined application answer (subjects, languages,
 * stations) into the card's string[] columns. Trims, drops empties, dedupes,
 * and caps each entry — the answers are picker-joined text, so this is a
 * faithful round-trip, not parsing prose.
 */
export function splitApplicationList(value: string, maxEntries = 20): string[] {
  const seen = new Set<string>();
  const entries: string[] = [];
  for (const raw of value.split(/[,，\n]/)) {
    const entry = raw.trim();
    if (!entry) continue;
    const key = entry.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(entry);
    if (entries.length >= maxEntries) break;
  }
  return entries;
}

/** House-style block per achievement; deterministic, no invented content. */
export function buildQualificationsSummary(
  application: Pick<TutorApplication, "achievements" | "awards">,
): string {
  const blocks = application.achievements
    .filter((achievement) => achievement.title.trim() && achievement.description.trim())
    .map((achievement) => `**• ${achievement.title.trim()} :** ${achievement.description.trim()}`);
  if (blocks.length > 0) return blocks.join("\n\n");
  return application.awards.trim();
}

/** Minimal shape of the R2 attachment records stored on the application row. */
export type ApplicationAttachmentFile = { source?: string; url?: string };

export type TutorCardInsert = {
  tutor_code: string;
  display_name: string;
  is_published: true;
  currency: "HKD";
  lesson_mode: TutorCardLessonMode;
  hourly_rate: number;
  online_rate: number | null;
  inperson_rate: number | null;
  rate_rows: { label: string; rate: number }[];
  travel_note: string;
  rate_note: string;
  pricing_tiers: { curriculum: string; rate: number }[];
  subjects: string[];
  languages: string[];
  stations: string[];
  target_students: string[];
  exam_results: unknown[];
  tutor_status: TutorCardTutorStatus;
  start_immediately: boolean;
  earliest_start_date: string | null;
  self_introduction: string;
  qualifications_summary: string;
  academic_headline: string;
  undergrad_university: string | null;
  undergrad_degree: string | null;
  undergrad_graduation_year: string | null;
  has_postgrad: boolean;
  postgrad_university: string | null;
  postgrad_degree: string | null;
  secondary_school: string | null;
  photo_url: string | null;
  portfolio_images: string[];
  created_by: null;
};

/**
 * Builds the tutors INSERT payload for a stored application.
 *
 * `application` is the stored jsonb `data` (post-submit normalization: base
 * rates already blanked per format, rate rows already normalized, hourlyRate
 * already the min-of-base-rates floor). `files` is the row's stored
 * attachment_files (profile photo + trophy cabinet URLs).
 */
export function buildTutorCardInsert(
  application: Omit<TutorApplication, "turnstileToken">,
  tutorCode: string,
  files: ApplicationAttachmentFile[] = [],
): TutorCardInsert {
  // Same floor rule as the stored payload: Math.min of the two base rates
  // (the schema guarantees at least one is set per the format rules).
  const baseRates = [application.onlineRate, application.inpersonRate].filter(
    (rate): rate is number => typeof rate === "number",
  );

  const photoUrl = files.find((file) => file.source === "profile_photo")?.url ?? null;
  const portfolioImages = files
    .filter((file) => file.source === "portfolio_image" && typeof file.url === "string" && file.url)
    .map((file) => file.url as string);

  return {
    tutor_code: tutorCode,
    display_name: application.name,
    is_published: true,
    currency: "HKD",
    lesson_mode: mapApplicationFormatToLessonMode(application.format),
    hourly_rate: baseRates.length > 0 ? Math.min(...baseRates) : 0,
    online_rate: application.onlineRate,
    inperson_rate: application.inpersonRate,
    rate_rows: application.rateRows.map((row) => ({ label: row.label, rate: Number(row.rate) })),
    travel_note: application.travelNote,
    rate_note: application.rateNote,
    pricing_tiers: normalizeApplicationPricingTiers(application),
    subjects: splitApplicationList(application.subjectsConfident),
    languages: splitApplicationList(application.medium),
    stations: splitApplicationList(application.locations, 100),
    target_students: [],
    exam_results: [],
    tutor_status: mapApplicationStatusToTutorStatus(application.status),
    start_immediately: application.startImmediately,
    earliest_start_date: application.startImmediately ? null : application.startDate || null,
    self_introduction: application.selfIntroduction,
    qualifications_summary: buildQualificationsSummary(application),
    // The stored headline was required and contact-filtered, and may contain
    // manual edits — it wins; the generator is only the fallback.
    academic_headline:
      application.academicHeadline ||
      buildAcademicHeadline([
        { curriculum: application.curriculum, score: application.overallScore },
      ]),
    undergrad_university: application.university || null,
    undergrad_degree: application.programme || null,
    undergrad_graduation_year: application.graduationYear || null,
    has_postgrad: application.hasPostgrad,
    postgrad_university: application.postgradUniversity || null,
    postgrad_degree: application.postgradDegree || null,
    // Professional-path applications store a literal placeholder here.
    secondary_school: application.highSchool === "Not provided" ? null : application.highSchool,
    photo_url: photoUrl,
    portfolio_images: portfolioImages,
    created_by: null,
  };
}
