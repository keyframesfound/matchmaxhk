import { z } from "zod";

export const MAX_FILES = 5;
export const MAX_ACHIEVEMENT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_BYTES = MAX_ACHIEVEMENT_FILE_BYTES;
export const MAX_TOTAL_BYTES = MAX_FILES * MAX_ACHIEVEMENT_FILE_BYTES;
// Issue #97: Trophy Cabinet — up to 6 public portfolio photos (JPG/PNG/WebP,
// 5MB each), uploaded at intake and shown on the public profile.
export const MAX_PORTFOLIO_FILES = 6;
export const MAX_PORTFOLIO_TOTAL_BYTES =
  MAX_PORTFOLIO_FILES * MAX_ACHIEVEMENT_FILE_BYTES;
export const ACCEPTED_PORTFOLIO_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];
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

export const achievementSchema = z
  .object({
    title: z.string().trim().min(1, "Required").max(200),
    description: z.string().trim().min(1, "Required").max(2000),
    proof: attachmentSchema.optional(),
    proofStatus: z.enum(["upload", "not_applicable", "provide_later"]),
  })
  .superRefine((achievement, context) => {
    if (achievement.proofStatus === "upload" && !achievement.proof) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proof"],
        message: "Choose an evidence file",
      });
    }
  });

export const academicDocumentSchema = z
  .object({
    curriculum: z.enum(CURRICULUM_OPTIONS),
    file: attachmentSchema.optional(),
    status: z.enum(["upload", "not_applicable", "provide_later"]),
  })
  .superRefine((document, context) => {
    if (document.status === "upload" && !document.file) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["file"],
        message: "Choose a transcript file",
      });
    }
  });

export const tutorApplicationSchema = z
  .object({
    turnstileToken: z.string().trim().min(1, "Complete the security check").max(2048),
    name: z.string().trim().min(1, "Required").max(120),
    phone: z.string().trim().min(5, "Required").max(60),
    email: z.string().trim().email("Enter a valid email"),
    country: z.string().trim().min(1, "Required").max(100),
    year: z.string().trim().max(40).optional().default(""),
    graduationYear: z.string().trim().max(40).optional().default(""),
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
    university: z.string().trim().max(200).optional().default(""),
    programme: z.string().trim().max(200).optional().default(""),
    // Issue #107: optional Master's / postgraduate / dual-degree history.
    hasPostgrad: z.boolean().default(false),
    postgradUniversity: z.string().trim().max(200).optional().default(""),
    postgradDegree: z.string().trim().max(200).optional().default(""),
    studentCard: attachmentSchema.optional(),
    highSchool: z.string().trim().min(1, "Required").max(200),
    curriculum: z.enum(CURRICULUM_OPTIONS),
    curricula: z.array(z.enum(CURRICULUM_OPTIONS)).min(1, "Select at least one curriculum"),
    overallScore: z.string().trim().min(1, "Required").max(200),
    subjectsConfident: z.string().trim().min(1, "Required").max(2000),
    subjectResults: z.string().trim().min(1, "Required").max(2000),
    awards: z.string().trim().max(2000).optional().default(""),
    achievements: z.array(achievementSchema).max(MAX_FILES).default([]),
    academicDocuments: z.array(academicDocumentSchema).max(MAX_FILES).default([]),
    // Issue #97: optional Trophy Cabinet photos (public on the profile).
    portfolioImages: z.array(portfolioImageSchema).max(MAX_PORTFOLIO_FILES).default([]),
    // Consent required only when photos are actually uploaded (see superRefine).
    portfolioConsent: z.boolean().default(false),
    profilePhoto: profilePhotoSchema.optional(),
    experience: z.string().trim().max(2000).optional().default(""),
    // Issue #119: optional tutor-written pitch shown on the public profile
    // once the concierge team has proofread it (2,000-char cap, line breaks
    // preserved).
    selfIntroduction: z.string().trim().max(2000).optional().default(""),
    hourlyRate: z.string().trim().min(1, "Required").max(20),
    // Issue #108: per-curriculum pricing tiers. standardize=true means one flat
    // rate across all curricula; false = explicit {curriculum, rate} rows (the
    // schema only enforces shape — blank rates are backfilled to the lowest
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
    locations: z
      .string()
      .trim()
      .max(2000, "Too many teaching locations selected — please narrow your station selection.")
      .optional()
      .default(""),
    medium: z.string().trim().min(1, "Required").max(200),
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
      if (!data.studentCard) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["studentCard"],
          message: "Upload your student ID card as evidence of your university and major",
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
    if (!isProfessional && data.curriculum === "IBDP" && !/^4[0-5]$/.test(data.overallScore)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["overallScore"],
        message: "Enter an IBDP score from 40 to 45",
      });
    }
    if (!isProfessional && data.curriculum === "HKDSE" && !/^\d+$/.test(data.overallScore)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["overallScore"],
        message: "Enter a numeric Best 5 score",
      });
    }
    if (!isProfessional && data.curriculum === "SAT") {
      const satScore = Number(data.overallScore);
      if (!Number.isInteger(satScore) || satScore < 400 || satScore > 1600) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["overallScore"],
          message: "Enter an SAT total score from 400 to 1600",
        });
      }
    }
    if (
      !isProfessional &&
      data.curriculum === "IELTS" &&
      !/^(?:[4-8](?:\.0|\.5)?|9\.0)$/.test(data.overallScore)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["overallScore"],
        message: "Enter an IELTS band from 4.0 to 9.0 (in 0.5 steps)",
      });
    }
    if (!isProfessional && data.curriculum === "ISAT") {
      const isatScore = Number(data.overallScore);
      if (!Number.isInteger(isatScore) || isatScore < 100 || isatScore > 200) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["overallScore"],
          message: "Enter an ISAT scaled score from 100 to 200",
        });
      }
    }
    if (!isProfessional && data.curriculum === "UCAT(3600)") {
      const ucatScore = Number(data.overallScore);
      if (
        !Number.isInteger(ucatScore) ||
        ucatScore < 1200 ||
        ucatScore > 3600 ||
        ucatScore % 10 !== 0
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["overallScore"],
          message: "Enter a UCAT total score from 1200 to 3600 (in 10-point steps)",
        });
      }
    }
    if (!isProfessional && data.curriculum === "UCAT(2700)") {
      const ucatScore = Number(data.overallScore);
      if (
        !Number.isInteger(ucatScore) ||
        ucatScore < 900 ||
        ucatScore > 2700 ||
        ucatScore % 10 !== 0
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["overallScore"],
          message: "Enter a UCAT total score from 900 to 2700 (in 10-point steps)",
        });
      }
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
  });

export type TutorApplicationInput = z.input<typeof tutorApplicationSchema>;
export type TutorApplication = z.output<typeof tutorApplicationSchema>;

/**
 * Issue #108 — normalize the application's per-curriculum pricing into the
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
  "I understand that MatchMax will take the 1st and 11th lesson of each new case as commission, and that fees for those lessons are payable to MatchMax.";

export const PRIVACY_TEXT =
  "I consent to MatchMax collecting and using the personal data in this form for tutor recruitment and matching purposes, in accordance with the Personal Data (Privacy) Ordinance (Cap. 486).";

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
    { label: "Name", value: data.name },
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
    { label: "Student ID card", value: data.studentCard?.filename ?? "—" },
    { label: "Current year of study", value: data.year || "—" },
    { label: "High school and graduation year", value: data.highSchool },
    { label: "Primary curriculum", value: data.curriculum },
    { label: "Curricula completed", value: data.curricula.join(", ") },
    { label: "Overall achieved score", value: data.overallScore },
    { label: "Subjects and levels confident teaching", value: data.subjectsConfident },
    { label: "Relevant subject results / academic strengths", value: data.subjectResults },
    { label: "Awards / scholarships / achievements", value: data.awards || "—" },
    {
      label: "Achievement evidence",
      value: data.achievements
        .map(
          (achievement) =>
            `${achievement.title}: ${achievement.description} (${achievement.proof?.filename ?? (achievement.proofStatus === "provide_later" ? "Provide later" : "N/A")})`,
        )
        .join("\n"),
    },
    {
      label: "Academic documents",
      value:
        data.academicDocuments
          .map(
            (document) =>
              `${document.curriculum}: ${document.file?.filename ?? (document.status === "provide_later" ? "Provide later" : "N/A")}`,
          )
          .join("\n") || "—",
    },
    {
      label: "Trophy cabinet photos",
      value:
        data.portfolioImages.map((image) => image.filename).join("\n") ||
        (data.portfolioConsent ? "— (consent ticked, no photos)" : "—"),
    },
    { label: "Teaching / tutoring experience", value: data.experience },
    { label: "Self-introduction", value: data.selfIntroduction || "—" },
    { label: "Profile photo", value: data.profilePhoto?.filename ?? "—" },
    { label: "Normal hourly rate (HKD)", value: data.hourlyRate },
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
