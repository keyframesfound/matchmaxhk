import { z } from "zod";

export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
export const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
export const ACCEPT_ATTRIBUTE = ".pdf,.jpg,.jpeg,.png,.doc,.docx";

export const STATUS_OPTIONS = [
  "University student",
  "Graduate",
  "Full-time tutor",
  "Part-time tutor",
  "Other",
] as const;

export const CURRICULUM_OPTIONS = ["IBDP", "A-Level", "AP", "Other"] as const;
export const MATERIALS_OPTIONS = ["Yes", "No", "In progress"] as const;
export const FORMAT_OPTIONS = ["Face to face", "Online", "Both"] as const;

export const attachmentSchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(120),
  size: z.number().int().positive().max(MAX_FILE_BYTES),
  content: z.string().min(1),
});

export const tutorApplicationSchema = z.object({
  name: z.string().trim().min(1, "Required").max(120),
  phone: z.string().trim().min(5, "Required").max(60),
  email: z.string().trim().email("Enter a valid email"),
  startDate: z.string().trim().max(40).optional().default(""),
  status: z.enum(STATUS_OPTIONS),
  statusOther: z.string().trim().max(200).optional().default(""),
  university: z.string().trim().max(200).optional().default(""),
  programme: z.string().trim().max(200).optional().default(""),
  highSchool: z.string().trim().min(1, "Required").max(200),
  curriculum: z.enum(CURRICULUM_OPTIONS),
  curriculumOther: z.string().trim().max(200).optional().default(""),
  overallScore: z.string().trim().min(1, "Required").max(200),
  subjectsConfident: z.string().trim().min(1, "Required").max(2000),
  subjectResults: z.string().trim().min(1, "Required").max(2000),
  awards: z.string().trim().max(2000).optional().default(""),
  experience: z.string().trim().min(1, "Required").max(2000),
  hourlyRate: z.string().trim().min(1, "Required").max(20),
  materials: z.enum(MATERIALS_OPTIONS),
  format: z.enum(FORMAT_OPTIONS),
  maxStudents: z.string().trim().max(20).optional().default(""),
  locations: z.string().trim().max(400).optional().default(""),
  medium: z.string().trim().min(1, "Required").max(200),
  notes: z.string().trim().max(2000).optional().default(""),
  commissionAck: z.literal(true),
  privacyAck: z.literal(true),
  attachments: z.array(attachmentSchema).min(1, "Please attach your results").max(MAX_FILES),
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

export function buildAnswerRows(data: TutorApplication): AnswerRow[] {
  const status =
    data.status === "Other" && data.statusOther ? `Other — ${data.statusOther}` : data.status;
  const curriculum =
    data.curriculum === "Other" && data.curriculumOther
      ? `Other — ${data.curriculumOther}`
      : data.curriculum;

  return [
    { label: "Name", value: data.name },
    { label: "Contact number / WhatsApp", value: data.phone },
    { label: "Email", value: data.email },
    { label: "Earliest start date", value: data.startDate || "—" },
    { label: "Current status", value: status },
    { label: "University / institution", value: data.university || "—" },
    { label: "Degree / programme", value: data.programme || "—" },
    { label: "High school and graduation year", value: data.highSchool },
    { label: "Curriculum completed", value: curriculum },
    { label: "Overall achieved score", value: data.overallScore },
    { label: "Subjects and levels confident teaching", value: data.subjectsConfident },
    { label: "Relevant subject results / academic strengths", value: data.subjectResults },
    { label: "Awards / scholarships / achievements", value: data.awards || "—" },
    { label: "Teaching / tutoring experience", value: data.experience },
    { label: "Normal hourly rate (HKD)", value: data.hourlyRate },
    { label: "Teaching materials available", value: data.materials },
    { label: "Preferred tutoring format", value: data.format },
    { label: "Max number of students", value: data.maxStudents || "—" },
    { label: "Preferred teaching location(s)", value: data.locations || "—" },
    { label: "Preferred medium of instruction", value: data.medium },
    { label: "Anything else / referral", value: data.notes || "—" },
    { label: "Attachments", value: data.attachments.map((f) => f.filename).join(", ") },
    { label: "Commission acknowledged", value: "Yes" },
    { label: "Privacy notice accepted", value: "Yes" },
  ];
}
