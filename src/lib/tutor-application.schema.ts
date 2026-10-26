import { z } from "zod";

import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from "@/lib/money";
import { contactFilterError } from "@/lib/contact-filter";
import {
  MAX_RATE_ROWS,
  RATE_MAX,
  RATE_MIN,
  RATE_NOTE_MAX,
  RATE_ROW_LABEL_MAX,
  TRAVEL_NOTE_MAX,
  normalizeTutorRateRows,
} from "@/features/tutors/rates";
import { MAX_ACADEMIC_HEADLINE } from "@/lib/academic-headline";
import { SEN_CATEGORY_OPTIONS } from "@/features/tutors/sen";
import {
  COURSE_GRADE_OPTIONS,
  KINDERGARTEN_TOPICS,
  MAX_UNIVERSITY_COURSES,
  TARGET_TEACHING_LEVELS,
  YEARS_OF_STUDY,
  normalizeUniversityGpa,
} from "@/features/tutors/verticals";

/**
 * Issue #357 / #359, every free-text answer that is copied onto the public
 * card must fail intake before the row is stored. `superRefine` runs on the
 * schema output (after trim / default), so empty optional fields pass.
 */
function withContactFilter<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((value, ctx) => {
    if (typeof value !== "string") return;
    const error = contactFilterError(value);
    if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
  });
}

export const MAX_FILES = 5;
export const MAX_ACHIEVEMENT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_BYTES = MAX_ACHIEVEMENT_FILE_BYTES;
export const MAX_TOTAL_BYTES = MAX_FILES * MAX_ACHIEVEMENT_FILE_BYTES;
// Issue #97: Trophy Cabinet, up to 6 public portfolio photos (JPG/PNG/WebP,
// 5MB each), uploaded at intake and shown on the public profile.
export const MAX_PORTFOLIO_FILES = 6;
export const MAX_PORTFOLIO_TOTAL_BYTES = MAX_PORTFOLIO_FILES * MAX_ACHIEVEMENT_FILE_BYTES;
export const ACCEPTED_PORTFOLIO_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PORTFOLIO_ACCEPT_ATTRIBUTE = ".jpg,.jpeg,.png,.webp";
export const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
export const ACCEPT_ATTRIBUTE = ".pdf,.jpg,.jpeg,.png,.doc,.docx";
export const PHONE_REGEX = /^[+(\d][\d\s()./+-]{4,19}\d$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const STATUS_OPTIONS = [
  "University Student",
  "Full/Part-Time Tutor",
  "Professional Teacher/ Public Exam Examiner",
] as const;
export const PROFESSIONAL_STATUS = "Professional Teacher/ Public Exam Examiner" as const;

export const CURRICULUM_OPTIONS = [
  "IBDP",
  "A-Level",
  "IGCSE / GCSE",
  "HKDSE",
  "AP",
  "SAT",
  "IELTS",
  "ISAT",
  "UCAT(3600)",
  "UCAT(2700)",
  "Foundation / other",
  // Issue #190: the new verticals, a University-only or Kindergarten-only
  // tutor picks these instead of a school exam curriculum, so the exam-score
  // fields can stay hidden for them.
  "University",
  "Kindergarten",
] as const;
export const MATERIALS_OPTIONS = ["Yes", "No", "In progress"] as const;
export const FORMAT_OPTIONS = ["Face to face", "Online", "Both"] as const;
export const PROFESSIONAL_ROLE_OPTIONS = [
  "Official examiner / moderator",
  "Current professional teacher",
  "Former professional teacher",
] as const;
export const EXAMINING_BOARD_OPTIONS = [
  "IBO",
  "Cambridge CAIE",
  "Pearson Edexcel",
  "HKEAA",
  "AQA",
  "OCR",
] as const;
export const TEACHING_QUALIFICATION_OPTIONS = [
  "PGDE",
  "PGCE",
  "BEd",
  "MEd",
  "TEFL / TESOL",
  "Registered Teacher (RT)",
] as const;

export const ACCEPTED_PROFILE_PHOTO_TYPES = ["image/jpeg", "image/png"];
export const PROFILE_PHOTO_ACCEPT_ATTRIBUTE = ".jpg,.jpeg,.png";

export const attachmentSchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(120),
  size: z.number().int().positive().max(MAX_ACHIEVEMENT_FILE_BYTES),
  content: z.string().min(1),
});

export const profilePhotoSchema = attachmentSchema.superRefine((photo, context) => {
  if (!ACCEPTED_PROFILE_PHOTO_TYPES.includes(photo.contentType)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["contentType"],
      message: "Profile photo must be a JPG or PNG image",
    });
  }
});

// Issue #97: Trophy Cabinet photos are images only (JPG/PNG/WebP).
export const portfolioImageSchema = attachmentSchema.superRefine((image, context) => {
  if (!ACCEPTED_PORTFOLIO_IMAGE_TYPES.includes(image.contentType)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["contentType"],
      message: "Trophy cabinet photos must be JPG, PNG, or WebP images",
    });
  }
});

export const tutorApplicationSchema = z
  .object({
    turnstileToken: z.string().trim().min(1, "Complete the security check").max(2048),
    // Issue #359: name is the public display_name.
    name: withContactFilter(z.string().trim().min(1, "Required").max(120)),
    // Issue #189: optional preferred name so the WhatsApp activation message
    // and later concierge chats can use what the tutor actually goes by.
    preferredName: z.string().trim().max(80).optional().default(""),
    phone: z.string().trim().min(5, "Required").max(60),
    email: z.string().trim().email("Enter a valid email"),
    country: z.string().trim().min(1, "Required").max(100),
    year: z.string().trim().max(40).optional().default(""),
    graduationYear: withContactFilter(z.string().trim().max(40).optional().default("")),
    // Issue #106: tutors pick "Immediately" or a concrete earliest start date
    // (stored as an ISO yyyy-mm-dd string) so profiles can pre-book or hide
    // themselves from public browse automatically.
    startImmediately: z.boolean().default(true),
    startDate: z.string().trim().max(40).optional().default(""),
    status: z.enum(STATUS_OPTIONS),
    statusOther: z.string().trim().max(200).optional().default(""),
    professionalRoles: z.array(z.enum(PROFESSIONAL_ROLE_OPTIONS)).default([]),
    examiningBoards: z.array(z.enum(EXAMINING_BOARD_OPTIONS)).default([]),
    teachingQualifications: z.array(z.enum(TEACHING_QUALIFICATION_OPTIONS)).default([]),
    university: withContactFilter(z.string().trim().max(200).optional().default("")),
    programme: withContactFilter(z.string().trim().max(200).optional().default("")),
    // Issue #107: optional Master's / postgraduate / dual-degree history.
    hasPostgrad: z.boolean().default(false),
    postgradUniversity: withContactFilter(z.string().trim().max(200).optional().default("")),
    postgradDegree: withContactFilter(z.string().trim().max(200).optional().default("")),
    highSchool: withContactFilter(z.string().trim().min(1, "Required").max(200)),
    curriculum: z.enum(CURRICULUM_OPTIONS),
    curricula: z.array(z.enum(CURRICULUM_OPTIONS)).min(1, "Select at least one curriculum"),
    // Issue #323: overall score is strictly OPTIONAL, tutors select a
    // curriculum and may leave the score blank ("spiky" specialists).
    overallScore: z.string().trim().max(200).optional().default(""),
    // Issue #323: required smart headline (<= 40 chars, contact-filtered),
    // auto-filled from the qualifications but editable; see academic-headline.ts.
    academicHeadline: z
      .string()
      .trim()
      .min(1, "Required")
      .max(
        MAX_ACADEMIC_HEADLINE,
        `Keep the headline to ${MAX_ACADEMIC_HEADLINE} characters or fewer`,
      )
      .superRefine((text, ctx) => {
        const error = contactFilterError(text);
        if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
      }),
    // Issue #359: joined picker text is published as tutors.subjects.
    subjectsConfident: withContactFilter(z.string().trim().min(1, "Required").max(2000)),
    // Issue #190: required only for the school-exam path (Primary/Secondary);
    // University-only tutors report course grades instead, Kindergarten-only
    // tutors report their topics below.
    subjectResults: z.string().trim().max(2000).optional().default(""),
    // Issue #357: awards is the qualifications_summary fallback when there
    // are no achievement blocks, both go live on the card, so both are
    // contact-filtered (issue #357/#359 leak fix preserved post-#309).
    awards: withContactFilter(z.string().trim().max(2000).optional().default("")),
    achievements: z
      .array(
        z.object({
          title: withContactFilter(z.string().trim().min(1, "Required").max(200)),
          description: withContactFilter(z.string().trim().min(1, "Required").max(2000)),
        }),
      )
      .max(MAX_FILES)
      .default([]),
    // Issue #309: join no longer collects evidence files, grade slips are
    // uploaded per-grade from the profile editor and reviewed by staff there.
    // Grade TEXT answers (curriculum/scores) stay plain text above.
    // Issue #190: vertical routing + self-reported vertical fields.
    targetLevels: z
      .array(z.enum(TARGET_TEACHING_LEVELS))
      .min(1, "Select at least one teaching level"),
    universityYearOfStudy: z
      .union([z.enum(YEARS_OF_STUDY), z.literal("")])
      .optional()
      .default(""),
    universityGpa: z
      .string()
      .trim()
      .max(10)
      .optional()
      .default("")
      .refine((text) => text === "" || normalizeUniversityGpa(text) !== null, {
        message: "Enter a GPA between 0 and 4.3",
      }),
    universityCourses: z
      .array(withContactFilter(z.string().trim().min(1, "Required").max(40)))
      .max(MAX_UNIVERSITY_COURSES)
      .default([]),
    courseGrades: z
      .array(
        z.object({
          course: withContactFilter(z.string().trim().min(1, "Required").max(40)),
          grade: z.enum(COURSE_GRADE_OPTIONS),
        }),
      )
      .max(MAX_UNIVERSITY_COURSES)
      .default([]),
    kindergartenTopics: z.array(z.enum(KINDERGARTEN_TOPICS)).default([]),
    // Issue #97: optional Trophy Cabinet photos (public on the profile).
    portfolioImages: z.array(portfolioImageSchema).max(MAX_PORTFOLIO_FILES).default([]),
    // Consent required only when photos are actually uploaded (see superRefine).
    portfolioConsent: z.boolean().default(false),
    profilePhoto: profilePhotoSchema.optional(),
    // Issue #199: SEN experience & qualifications. Revealed by the SEN
    // toggle; at least one HK-common category is required when enabled so
    // the /tutors SEN filter stays meaningful.
    senEnabled: z.boolean().default(false),
    senCategories: z.array(z.enum(SEN_CATEGORY_OPTIONS)).default([]),
    senExperience: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .default("")
      .superRefine((text, ctx) => {
        const error = contactFilterError(text);
        if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
      }),
    experience: z.string().trim().max(2000).optional().default(""),
    // Issue #119: optional tutor-written pitch shown on the public profile
    // once the concierge team has proofread it (2,000-char cap, line breaks
    // preserved). Issue #215: contact details are rejected server-side.
    selfIntroduction: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .default("")
      .superRefine((text, ctx) => {
        const error = contactFilterError(text);
        if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
      }),
    // Issue #319: the single "Proposed Hourly Rate" input is replaced by two
    // base rates (whole HK dollars, 50-3000). Which one is required follows
    // the lesson format, see the superRefine below. The legacy hourlyRate is
    // no longer collected; tutor-application.functions.ts derives it as the
    // Math.min of the two base rates before the application row is stored.
    hourlyRate: z.string().trim().max(20).optional().default(""),
    onlineRate: z.number().int().min(RATE_MIN).max(RATE_MAX).nullable().default(null),
    inpersonRate: z.number().int().min(RATE_MIN).max(RATE_MAX).nullable().default(null),
    // Issue #113: the currency the tutor quotes ALL pricing fields in. The
    // stored rates stay native; tutors_normalize_hkd snapshots the HKD
    // equivalents on publish.
    currency: z.enum(SUPPORTED_CURRENCIES).default(DEFAULT_CURRENCY),
    // Extra rate rows (profile-only): lenient shape here, the same shared
    // rules as the form run in superRefine, and functions.ts stores the
    // normalized output (half-filled/invalid rows never reach the row).
    // Issue #359: labels are contact-filtered inside normalizeTutorRateRows
    // (shared with the profile editor) before a row is accepted.
    rateRows: z
      .array(
        z.object({
          label: z.string().trim().max(RATE_ROW_LABEL_MAX),
          rate: z.union([z.number(), z.string()]),
        }),
      )
      .max(MAX_RATE_ROWS)
      .default([]),
    // Issue #319: optional travel note, only filled when teaching in person.
    travelNote: z
      .string()
      .trim()
      .max(TRAVEL_NOTE_MAX)
      .optional()
      .default("")
      .superRefine((text, ctx) => {
        const error = contactFilterError(text);
        if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
      }),
    // Issue #319: one optional line about anything that changes the rate.
    rateNote: z
      .string()
      .trim()
      .max(RATE_NOTE_MAX)
      .optional()
      .default("")
      .superRefine((text, ctx) => {
        const error = contactFilterError(text);
        if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
      }),
    // Issue #108: per-curriculum pricing tiers. standardize=true means one flat
    // rate across all curricula; false = explicit {curriculum, rate} rows (the
    // schema only enforces shape, blank rates are backfilled to the lowest
    // entered price in normalizeApplicationPricingTiers before insert).
    pricingStandardized: z.boolean().default(true),
    pricingTiers: z
      .array(
        z.object({
          curriculum: z.enum(CURRICULUM_OPTIONS),
          rate: z.number().int().min(0).max(100000),
        }),
      )
      .max(12)
      .default([]),
    materials: z.enum(MATERIALS_OPTIONS),
    format: z.enum(FORMAT_OPTIONS),
    maxStudents: z.string().trim().max(20).optional().default(""),
    // Issue #359: locations and medium are published as stations / languages.
    locations: withContactFilter(
      z
        .string()
        .trim()
        .max(2000, "Too many teaching locations selected, please narrow your station selection.")
        .optional()
        .default(""),
    ),
    medium: withContactFilter(z.string().trim().min(1, "Required").max(200)),
    notes: z.string().trim().max(2000).optional().default(""),
    referralCode: z
      .string()
      .trim()
      .max(64)
      .regex(/^[A-Za-z0-9_-]*$/, "Invalid referral code")
      .optional()
      .default(""),
    certificatesLater: z.boolean().default(false),
    commissionAck: z.literal(true),
    privacyAck: z.literal(true),
    termsAck: z.literal(true),
  })
  .superRefine((data, context) => {
    const isProfessional = data.status === PROFESSIONAL_STATUS;

    // Issue #319: base-rate requirements follow the lesson format. At least
    // one base rate is always required because `format` is mandatory.
    if (data.format === "Online" && data.onlineRate === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["onlineRate"], message: "Required" });
    }
    if (data.format === "Face to face" && data.inpersonRate === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inpersonRate"],
        message: "Required",
      });
    }
    if (data.format === "Both") {
      if (data.onlineRate === null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["onlineRate"],
          message: "Required",
        });
      }
      if (data.inpersonRate === null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["inpersonRate"],
          message: "Required",
        });
      }
    }
    // Extra rate rows run the exact same shared rules as the form: a row saves
    // only when BOTH label and rate are filled; half-filled rows are rejected.
    const rateRowCheck = normalizeTutorRateRows(data.rateRows);
    if (!rateRowCheck.ok) {
      for (const message of rateRowCheck.errors) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["rateRows"], message });
      }
    }

    if (!isProfessional && !data.year) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["year"],
        message: "Required",
      });
    }

    if (!isProfessional) {
      if (!data.university) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["university"],
          message: "Required",
        });
      }
      if (!data.programme) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["programme"],
          message: "Required",
        });
      }
    }

    if (data.hasPostgrad) {
      if (!data.postgradUniversity) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["postgradUniversity"],
          message: "Required",
        });
      }
      if (!data.postgradDegree) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["postgradDegree"],
          message: "Required",
        });
      }
    }

    if (data.format !== "Online" && !data.locations) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["locations"],
        message: "Select at least one teaching location",
      });
    }
    if (isProfessional && data.teachingQualifications.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["teachingQualifications"],
        message: "Select at least one teaching qualification",
      });
    }
    if (
      data.professionalRoles.includes("Official examiner / moderator") &&
      data.examiningBoards.length === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["examiningBoards"],
        message: "Select at least one examining board",
      });
    }
    if (!data.startImmediately) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data.startDate)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["startDate"],
          message: "Pick the date you can start taking students",
        });
      } else if (data.startDate < new Date().toISOString().slice(0, 10)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["startDate"],
          message: "Pick today or a later date",
        });
      }
    }

    // Issue #97: publication consent is mandatory only when photos are
    // uploaded; leaving the section blank keeps the profile fully anonymous.
    if (data.portfolioImages.length > 0 && !data.portfolioConsent) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["portfolioConsent"],
        message: "Tick the consent box to publish your photos",
      });
    }

    // Issue #199: SEN categories are required once the SEN toggle is on.
    if (data.senEnabled && data.senCategories.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["senCategories"],
        message: "Select at least one SEN category",
      });
    }

    // Issue #190: subject results stay required on the school-exam path only.
    const verticalOnly =
      data.targetLevels.length > 0 &&
      data.targetLevels.every((level) => level === "University" || level === "Kindergarten");
    if (!verticalOnly && !data.subjectResults) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subjectResults"],
        message: "Required",
      });
    }
  });

export type TutorApplicationInput = z.input<typeof tutorApplicationSchema>;
export type TutorApplication = z.output<typeof tutorApplicationSchema>;

/**
 * Issue #108, normalize the application's per-curriculum pricing into the
 * tutors.pricing_tiers shape ({curriculum, rate}[]). Unchecking "Standardize"
 * but leaving a tier blank falls back to the lowest entered price (the
 * acceptance-criteria rule); standardized applications produce an empty array
 * so the live card keeps using the flat hourly_rate.
 */
export function normalizeApplicationPricingTiers(
  data: Pick<TutorApplication, "pricingStandardized" | "pricingTiers">,
): { curriculum: string; rate: number }[] {
  if (data.pricingStandardized) return [];
  const entered = data.pricingTiers
    .map((tier) => ({ curriculum: tier.curriculum, rate: Math.round(tier.rate) }))
    .filter((tier) => tier.rate > 0);
  if (entered.length === 0) return [];
  const floor = Math.min(...entered.map((tier) => tier.rate));
  const enteredCurricula = new Set(entered.map((tier) => tier.curriculum));
  const backfilled = data.pricingTiers
    .filter((tier) => tier.rate <= 0 && !enteredCurricula.has(tier.curriculum))
    .map((tier) => ({ curriculum: tier.curriculum, rate: floor }));
  return [...entered, ...backfilled];
}

/** Human-readable pricing line for the admin answer summary. */
export function formatApplicationPricing(
  data: Pick<TutorApplication, "hourlyRate" | "pricingStandardized" | "pricingTiers">,
): string {
  if (data.pricingStandardized) return `${data.hourlyRate} (standardized across all curricula)`;
  const tiers = normalizeApplicationPricingTiers(data);
  if (tiers.length === 0) return `${data.hourlyRate} (no per-curriculum rates entered)`;
  return tiers.map((tier) => `${tier.curriculum}: HK$${tier.rate}`).join("; ");
}

export const COMMISSION_TEXT =
  "I understand that MatchMax will take 100% of my 1st paid lesson and 50% of my 2nd paid lesson as my matching fee for each new student";

export const PRIVACY_TEXT =
  "I consent to MatchMax collecting and using the personal data in this form for tutor listing and matching purposes, in accordance with the Personal Data (Privacy) Ordinance (Cap. 486).";

export interface AnswerRow {
  label: string;
  value: string;
}

export function getApplicationPath(data: Pick<TutorApplication, "status" | "curriculum">): string {
  return data.status === PROFESSIONAL_STATUS ? "Professional / Examiner" : data.curriculum;
}

export function buildAnswerRows(data: TutorApplication): AnswerRow[] {
  return [
    { label: "Application path", value: getApplicationPath(data) },
    {
      label: "Target teaching levels",
      value: (data.targetLevels ?? []).join(", ") || "—",
    },
    { label: "Name", value: data.name },
    { label: "Preferred name", value: data.preferredName || "—" },
    { label: "Contact number / WhatsApp", value: data.phone },
    { label: "Email", value: data.email },
    { label: "Country / region", value: data.country },
    { label: "Graduation year", value: data.graduationYear || "—" },
    {
      label: "Earliest start date",
      value: data.startImmediately ? "Immediately" : data.startDate || "—",
    },
    { label: "Current status", value: data.status },
    ...(data.professionalRoles.length
      ? [{ label: "Professional roles", value: data.professionalRoles.join(", ") }]
      : []),
    ...(data.examiningBoards.length
      ? [{ label: "Examining boards", value: data.examiningBoards.join(", ") }]
      : []),
    ...(data.teachingQualifications.length
      ? [{ label: "Teaching qualifications", value: data.teachingQualifications.join(", ") }]
      : []),
    { label: "University / institution", value: data.university || "—" },
    { label: "Degree / programme", value: data.programme || "—" },
    ...(data.hasPostgrad
      ? [
          { label: "Postgraduate university", value: data.postgradUniversity || "—" },
          {
            label: "Postgraduate degree / qualification",
            value: data.postgradDegree || "—",
          },
        ]
      : []),
    { label: "Current year of study", value: data.year || "—" },
    { label: "High school and graduation year", value: data.highSchool },
    { label: "Primary curriculum", value: data.curriculum },
    { label: "Curricula completed", value: data.curricula.join(", ") },
    { label: "Academic headline", value: data.academicHeadline },
    { label: "Overall achieved score", value: data.overallScore || "—" },
    { label: "Subjects and levels confident teaching", value: data.subjectsConfident },
    { label: "Relevant subject results / academic strengths", value: data.subjectResults },
    { label: "Awards / scholarships / achievements", value: data.awards || "—" },
    {
      label: "Achievements",
      value:
        data.achievements
          .map((achievement) => `${achievement.title}: ${achievement.description}`)
          .join("\n") || "—",
    },
    {
      label: "Trophy cabinet photos",
      value:
        data.portfolioImages.map((image) => image.filename).join("\n") ||
        (data.portfolioConsent ? "— (consent ticked, no photos)" : "—"),
    },
    { label: "Teaching / tutoring experience", value: data.experience },
    // Issue #199: SEN capability captured at intake.
    {
      label: "SEN experience",
      value: data.senEnabled ? `Yes, ${data.senCategories.join(", ")}` : "No",
    },
    {
      label: "SEN experience & qualifications",
      value: data.senEnabled ? data.senExperience || "—" : "—",
    },
    { label: "Self-introduction", value: data.selfIntroduction || "—" },
    { label: "Profile photo", value: data.profilePhoto?.filename ?? "—" },
    { label: "Normal hourly rate (HKD)", value: data.hourlyRate || "—" },
    // Issue #319: the two base rates plus the profile-only extras.
    {
      label: "Online hourly rate (HKD)",
      value: data.onlineRate === null ? "—" : `HK$${data.onlineRate}`,
    },
    {
      label: "In-person hourly rate (HKD)",
      value: data.inpersonRate === null ? "—" : `HK$${data.inpersonRate}`,
    },
    {
      label: "Extra rate rows",
      value: data.rateRows.map((row) => `${row.label}: HK$${row.rate}`).join("\n") || "—",
    },
    { label: "Travel note", value: data.travelNote || "—" },
    { label: "Rate note", value: data.rateNote || "—" },
    {
      label: "Pricing (issue #108)",
      value: formatApplicationPricing(data),
    },
    { label: "Teaching materials available", value: data.materials },
    { label: "Preferred tutoring format", value: data.format },
    { label: "Max number of students", value: data.maxStudents || "—" },
    { label: "Preferred teaching location(s)", value: data.locations || "—" },
    { label: "Preferred medium of instruction", value: data.medium },
    { label: "Anything else / referral", value: data.notes || "—" },
    { label: "Commission acknowledged", value: "Yes" },
    { label: "Privacy notice accepted", value: "Yes" },
  ];
}
