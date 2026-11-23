/**
 * #815 §2.5: pure rules for the thin Partner Centre course showcase.
 *
 * Enquire-only: a course card is a lead magnet, never a paid enrolment.
 * Nothing in this module touches the database, so the vitest suite can pin
 * the shape of the enquiry row and the field limits without a live client.
 * Server code and UI both import from here so the caps cannot drift.
 */

export const COURSE_FORMATS = [
  "small_group",
  "bootcamp",
  "one_on_one_centre",
  "admissions_consultation",
] as const;

export type CourseFormat = (typeof COURSE_FORMATS)[number];

/** Locale keys under `centre_channel.` for each format. */
export const COURSE_FORMAT_LABEL_KEYS: Record<CourseFormat, string> = {
  small_group: "format_small_group",
  bootcamp: "format_bootcamp",
  one_on_one_centre: "format_one_on_one",
  admissions_consultation: "format_admissions",
};

/** English labels for the workspace (the console is not localised). */
export const COURSE_FORMAT_LABELS: Record<CourseFormat, string> = {
  small_group: "Small Group",
  bootcamp: "Intensive Bootcamp",
  one_on_one_centre: "1-on-1 Centre Tuition",
  admissions_consultation: "Admissions Consultation",
};

export const COURSE_INSTRUCTION_LANGUAGES = ["english", "cantonese", "mandarin"] as const;
export type CourseInstructionLanguage = (typeof COURSE_INSTRUCTION_LANGUAGES)[number];

/** Human labels shared by the workspace form and the public channel. */
export const COURSE_INSTRUCTION_LANGUAGE_LABELS: Record<CourseInstructionLanguage, string> = {
  english: "English",
  cantonese: "Cantonese",
  mandarin: "Mandarin",
};

export const COURSE_HIGHLIGHTS_MAX = 3;
export const COURSE_HIGHLIGHT_MAX_CHARS = 300;
export const COURSE_SCHEDULE_SUMMARY_MAX_CHARS = 100;
export const COURSE_PRICE_DISPLAY_MAX_CHARS = 40;
export const COURSE_ENQUIRY_MESSAGE_MAX_CHARS = 500;

export function isCourseFormat(value: unknown): value is CourseFormat {
  return typeof value === "string" && (COURSE_FORMATS as readonly string[]).includes(value);
}

export function courseFormatLabel(format: string | null | undefined): string | null {
  return isCourseFormat(format) ? COURSE_FORMAT_LABELS[format] : null;
}

/** Trim, drop blanks, cap length, then cap the number of rows. */
export function normalizeHighlights(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().slice(0, COURSE_HIGHLIGHT_MAX_CHARS))
    .filter(Boolean)
    .slice(0, COURSE_HIGHLIGHTS_MAX);
}

export function normalizeInstructionLanguages(values: unknown): CourseInstructionLanguage[] {
  if (!Array.isArray(values)) return [];
  const allowed = new Set<string>(COURSE_INSTRUCTION_LANGUAGES);
  return Array.from(
    new Set(
      values
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim().toLowerCase())
        .filter((v) => allowed.has(v)),
    ),
  ) as CourseInstructionLanguage[];
}

export type CourseEnquiryWhoFor = "myself" | "my_child";

export type CourseEnquiryInput = {
  orgSlug: string;
  courseId: string;
  /** Optional: the visitor asked for a specific affiliate from Our Tutors. */
  requestedTutorCode?: string | null;
  name: string;
  phone: string;
  email?: string | null;
  whoFor: CourseEnquiryWhoFor;
  message?: string | null;
  /** Hidden honeypot: must be empty, a filled field is a bot. */
  botField?: string | null;
  /** Signed-in visitor, optional; enquiries work for guests too. */
  userId?: string | null;
};

export type CourseEnquiryOrg = {
  id: string;
  name: string;
  slug: string;
};

export type CourseEnquiryCourse = {
  id: string;
  title: string;
  subject: string | null;
  curriculum: string | null;
  target_grade: string | null;
  district: string | null;
  mode: "online" | "in_person" | "either";
};

export type CourseEnquiryTutor = {
  userId: string;
  displayName: string;
  tutorCode: string;
};

/**
 * The exact row written to `tutoring_cases`. A lead, not a dispatch: it is
 * never board-published, so the desk (and the centre) still see it before
 * any tutor is approached. There is deliberately no fee, no Stripe and no
 * tuition amount here.
 */
export function buildCourseEnquiryRow(
  input: Pick<CourseEnquiryInput, "name" | "phone" | "email" | "whoFor" | "message" | "userId">,
  org: CourseEnquiryOrg,
  course: CourseEnquiryCourse | null,
  requestedTutor: CourseEnquiryTutor | null,
): Record<string, unknown> {
  const name = input.name.trim().slice(0, 80);
  const phone = input.phone.trim().slice(0, 30);
  const email = (input.email ?? "").trim().slice(0, 120) || null;
  const message = (input.message ?? "").trim().slice(0, COURSE_ENQUIRY_MESSAGE_MAX_CHARS) || null;
  const forChild = input.whoFor === "my_child";

  const tags = ["Course enquiry"];
  if (requestedTutor) {
    tags.push(`[Requested Tutor: ${requestedTutor.displayName || requestedTutor.tutorCode}]`);
  }

  const title = course
    ? requestedTutor
      ? `${course.title} (tutor request)`
      : `${course.title}: course enquiry`
    : `Tutor request: ${requestedTutor?.displayName || requestedTutor?.tutorCode || "Affiliate"}`;

  return {
    parent_id: input.userId ?? null,
    title: title.slice(0, 200),
    description: message,
    subjects: course?.subject ? [course.subject] : ["General"],
    exam_system: course?.curriculum ?? null,
    student_level: course?.target_grade ?? "Unspecified",
    learner_nickname: forChild ? "My child" : name,
    requester_type: "parent",
    who_for: input.whoFor,
    support_type: "subject_tutoring",
    tutor_background: "any",
    language_of_instruction: "either",
    mode: course?.mode ?? "either",
    district: course?.district ?? null,
    sessions_per_week: 1,
    session_length_minutes: 60,
    preferred_gender: "any",
    package_type: "ongoing_1_5",
    student_count: 1,
    rate_unit: "hr",
    budget_currency: "HKD",
    contact_name: name,
    contact_phone: phone,
    contact_email: email,
    course_id: course?.id ?? null,
    requested_tutor_id: requestedTutor?.userId ?? null,
    organisation_id: org.id,
    case_type: "centre",
    tags,
    sen_required: false,
    sen_categories: [],
    source: "website_centre_course",
    status: "new",
    board_published_at: null,
    compliance_triage: {
      scope: "centre_course_enquiry",
      org_slug: org.slug,
      course_title: course?.title ?? null,
      requested_tutor: requestedTutor?.tutorCode ?? null,
    },
  };
}
