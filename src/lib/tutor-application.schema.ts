import { z } from "zod";

export const MAX_FILES = 5;
export const MAX_ACHIEVEMENT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_BYTES = MAX_ACHIEVEMENT_FILE_BYTES;
export const MAX_TOTAL_BYTES = MAX_FILES * MAX_ACHIEVEMENT_FILE_BYTES;
export const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
export const ACCEPT_ATTRIBUTE = ".pdf,.jpg,.jpeg,.png,.doc,.docx";

export const STATUS_OPTIONS = [
  "Uni student",
  "Full Time tutor",
  "Part time tutor",
  "Pro teacher / examiner",
] as const;
export const PROFESSIONAL_STATUS = "Pro teacher / examiner" as const;

export const CURRICULUM_OPTIONS = [
  "IBDP",
  "A-Level",
  "IGCSE / GCSE",
  "HKDSE",
  "AP",
  "SAT",
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

export const attachmentSchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(120),
  size: z.number().int().positive().max(MAX_ACHIEVEMENT_FILE_BYTES),
  content: z.string().min(1),
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
    graduationYear: z.string().trim().max(40).optional().default(""),
    startDate: z.string().trim().max(40).optional().default(""),
    status: z.enum(STATUS_OPTIONS),
    statusOther: z.string().trim().max(200).optional().default(""),
    professionalRoles: z.array(z.enum(PROFESSIONAL_ROLE_OPTIONS)).default([]),
    examiningBoards: z.array(z.enum(EXAMINING_BOARD_OPTIONS)).default([]),
    teachingQualifications: z.array(z.enum(TEACHING_QUALIFICATION_OPTIONS)).default([]),
    university: z.string().trim().max(200).optional().default(""),
    programme: z.string().trim().max(200).optional().default(""),
    highSchool: z.string().trim().min(1, "Required").max(200),
    curriculum: z.enum(CURRICULUM_OPTIONS),
    curricula: z.array(z.enum(CURRICULUM_OPTIONS)).min(1, "Select at least one curriculum"),
    overallScore: z.string().trim().min(1, "Required").max(200),
    subjectsConfident: z.string().trim().min(1, "Required").max(2000),
    subjectResults: z.string().trim().min(1, "Required").max(2000),
    awards: z.string().trim().max(2000).optional().default(""),
    achievements: z.array(achievementSchema).max(MAX_FILES).default([]),
    academicDocuments: z.array(academicDocumentSchema).max(MAX_FILES).default([]),
    experience: z.string().trim().max(2000).optional().default(""),
    hourlyRate: z.string().trim().min(1, "Required").max(20),
    materials: z.enum(MATERIALS_OPTIONS),
    format: z.enum(FORMAT_OPTIONS),
    maxStudents: z.string().trim().max(20).optional().default(""),
    locations: z.string().trim().max(400).optional().default(""),
    medium: z.string().trim().min(1, "Required").max(200),
    notes: z.string().trim().max(2000).optional().default(""),
    certificatesLater: z.boolean().default(false),
    commissionAck: z.literal(true),
    privacyAck: z.literal(true),
  })
  .superRefine((data, context) => {
    const isProfessional = data.status === PROFESSIONAL_STATUS;

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
  });

export type TutorApplicationInput = z.input<typeof tutorApplicationSchema>;
export type TutorApplication = z.output<typeof tutorApplicationSchema>;

export const COMMISSION_TEXT =
  "I understand that MatchMax will take the 1st and 11th lesson of each new case as commission, and that fees for those lessons are payable to MatchMax.";

export const PRIVACY_TEXT =
  "I consent to MatchMax collecting and using the personal data in this form for tutor recruitment and matching purposes, in accordance with the Personal Data (Privacy) Ordinance (Cap. 486).";

export interface AnswerRow {
  label: string;
  value: string;
}

export function getApplicationPath(data: TutorApplication): string {
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
    { label: "Earliest start date", value: data.startDate || "—" },
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
    { label: "Teaching / tutoring experience", value: data.experience },
    { label: "Normal hourly rate (HKD)", value: data.hourlyRate },
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
