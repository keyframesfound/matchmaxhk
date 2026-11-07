import { z } from "zod";

import { MAX_ACADEMIC_HEADLINE } from "@/lib/academic-headline";
import { contactFilterError } from "@/lib/contact-filter";
import { STATUS_FORM_OPTIONS, type TutorApplication } from "@/lib/tutor-application.schema";
import { RATE_MAX, RATE_MIN } from "@/features/tutors/rates";
import { TEACHING_CURRICULA } from "@/features/tutors/subjects";
import {
  MORE_TUTOR_STATUSES,
  PRIMARY_TUTOR_STATUSES,
  type TutorStatusCode,
} from "@/features/tutors/status-taxonomy";

/**
 * Issue #576 Stage 2: the 60-second Activate Tutor Card sheet. It collects only
 * what a non-empty public card needs, then becomes an ordinary stored
 * application so the existing publish path, contact scans and join-request
 * archive keep working. Rich detail moves to the Channel Profile (Stage 3).
 */

export const ACTIVATION_LANGUAGES = ["English", "Cantonese", "Mandarin"] as const;
export const ACTIVATION_GENDERS = ["female", "male", "prefer_not_to_say"] as const;
export const ACTIVATION_FORMATS = ["Online", "Face to face", "Both"] as const;
export const PHONE_MIN_DIGITS = 8;
const MAX_SUBJECTS = 30;
const MAX_STATIONS = 100;
const NOT_PROVIDED = "Not provided";

const CURRICULUM_VALUES = TEACHING_CURRICULA.map((c) => c.value);

const STATUS_LABEL_BY_CODE: Record<TutorStatusCode, (typeof STATUS_FORM_OPTIONS)[number]> = {
  uni_undergrad: "Uni Student Tutor",
  part_time: "Part-Time Tutor",
  full_time: "Full-Time Tutor",
  uni_grad: "Uni Graduate",
  school_teacher: "Certified Teacher",
  examiner: "Exam Marker / Specialist",
  sub_degree: "Associate / HD Student",
  native_speaker: "NET / Native Speaker",
};

const APPLICATION_CURRICULUM: Record<string, TutorApplication["curriculum"]> = {
  IB: "IBDP",
  DSE: "HKDSE",
  "A-Level": "A-Level",
  IGCSE: "IGCSE / GCSE",
  AP: "AP",
};

const safeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .superRefine((text, ctx) => {
      const error = contactFilterError(text);
      if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    });

export type ActivationValues = {
  statusCode: TutorStatusCode | null;
  institution: string;
  headline: string;
  curricula: string[];
  subjects: string[];
  format: (typeof ACTIVATION_FORMATS)[number] | null;
  stations: string[];
  onlineRate: number | null;
  inpersonRate: number | null;
  languages: string[];
  gender: (typeof ACTIVATION_GENDERS)[number] | null;
  phone: string;
  capAck: boolean;
  feeAck: boolean;
  legalAgreed: boolean;
};

export type ActivationField =
  | "status"
  | "headline"
  | "subjects"
  | "format"
  | "stations"
  | "onlineRate"
  | "inpersonRate"
  | "languages"
  | "gender"
  | "phone"
  | "acks";

const validRate = (rate: number | null) =>
  rate !== null && Number.isInteger(rate) && rate >= RATE_MIN && rate <= RATE_MAX;

export const phoneIsValid = (phone: string) => phone.replace(/\D/g, "").length >= PHONE_MIN_DIGITS;

/** Every unmet publish gate. Publish stays disabled until this is empty. */
export function activationMissing(
  values: ActivationValues,
  { needsPhone }: { needsPhone: boolean },
): ActivationField[] {
  const missing: ActivationField[] = [];
  if (!values.statusCode) missing.push("status");
  if (!values.headline.trim() || values.headline.trim().length > MAX_ACADEMIC_HEADLINE) {
    missing.push("headline");
  }
  if (values.subjects.length === 0) missing.push("subjects");
  if (!values.format) missing.push("format");
  if (values.format !== "Face to face" && values.format && !validRate(values.onlineRate)) {
    missing.push("onlineRate");
  }
  if (values.format !== "Online" && values.format) {
    if (!validRate(values.inpersonRate)) missing.push("inpersonRate");
    if (values.stations.length === 0) missing.push("stations");
  }
  if (values.languages.length === 0) missing.push("languages");
  if (!values.gender) missing.push("gender");
  if (needsPhone && !phoneIsValid(values.phone)) missing.push("phone");
  if (!values.capAck || !values.feeAck || !values.legalAgreed) missing.push("acks");
  return missing;
}

export const activationSchema = z
  .object({
    turnstileToken: z.string().trim().min(1).max(2048),
    statusCode: z.enum([...PRIMARY_TUTOR_STATUSES, ...MORE_TUTOR_STATUSES]),
    institution: safeText(200),
    headline: safeText(MAX_ACADEMIC_HEADLINE).pipe(z.string().min(1)),
    curricula: z.array(z.string().refine((value) => CURRICULUM_VALUES.includes(value))).max(12),
    subjects: z
      .array(safeText(80).pipe(z.string().min(1)))
      .min(1)
      .max(MAX_SUBJECTS),
    format: z.enum(ACTIVATION_FORMATS),
    stations: z.array(safeText(80)).max(MAX_STATIONS),
    onlineRate: z.number().int().min(RATE_MIN).max(RATE_MAX).nullable(),
    inpersonRate: z.number().int().min(RATE_MIN).max(RATE_MAX).nullable(),
    languages: z.array(z.enum(ACTIVATION_LANGUAGES)).min(1),
    gender: z.enum(ACTIVATION_GENDERS),
    phone: z.string().trim().max(60),
    capAck: z.literal(true),
    feeAck: z.literal(true),
    legalAgreed: z.literal(true),
    referralCode: z
      .string()
      .trim()
      .max(64)
      .regex(/^[A-Za-z0-9_-]*$/),
  })
  .superRefine((data, ctx) => {
    const issue = (path: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: "Required" });
    if (data.format !== "Face to face" && data.onlineRate === null) issue("onlineRate");
    if (data.format !== "Online") {
      if (data.inpersonRate === null) issue("inpersonRate");
      if (data.stations.length === 0) issue("stations");
    }
  });

export type ActivationInput = z.infer<typeof activationSchema>;

function targetLevelsFor(curricula: readonly string[]): TutorApplication["targetLevels"] {
  const primary = curricula.includes("Primary School");
  const secondary = curricula.some((value) => value !== "Primary School");
  const levels: TutorApplication["targetLevels"] = [];
  if (primary) levels.push("Primary");
  if (secondary || !primary) levels.push("Secondary");
  return levels;
}

/** Maps the short sheet onto the stored application the publish path reads. */
export function buildActivationApplication(
  input: ActivationInput,
  identity: { email: string; displayName: string; phone: string },
): Omit<TutorApplication, "turnstileToken"> {
  const onlineRate = input.format === "Face to face" ? null : input.onlineRate;
  const inpersonRate = input.format === "Online" ? null : input.inpersonRate;
  const curriculum =
    input.curricula.map((value) => APPLICATION_CURRICULUM[value]).find(Boolean) ??
    "Foundation / other";
  const rates = [onlineRate, inpersonRate].filter((rate): rate is number => rate !== null);
  return {
    name: identity.displayName,
    preferredName: identity.displayName,
    phone: identity.phone,
    email: identity.email,
    country: "Hong Kong",
    year: "",
    graduationYear: "",
    startImmediately: true,
    startDate: "",
    status: STATUS_LABEL_BY_CODE[input.statusCode],
    statusOther: "",
    professionalRoles: [],
    examiningBoards: [],
    teachingQualifications: [],
    university: input.institution,
    programme: "",
    hasPostgrad: false,
    postgradUniversity: "",
    postgradDegree: "",
    highSchool: NOT_PROVIDED,
    curriculum,
    curricula: [curriculum],
    overallScore: "",
    academicHeadline: input.headline,
    subjectsConfident: input.subjects.join(", "),
    subjectResults: "",
    awards: "",
    achievements: [],
    targetLevels: targetLevelsFor(input.curricula),
    universityYearOfStudy: "",
    universityGpa: "",
    universityCourses: [],
    courseGrades: [],
    kindergartenTopics: [],
    portfolioImages: [],
    portfolioConsent: false,
    senEnabled: false,
    senCategories: [],
    senExperience: "",
    experience: "",
    selfIntroduction: "",
    hourlyRate: String(Math.min(...rates)),
    onlineRate,
    inpersonRate,
    currency: "HKD",
    rateRows: [],
    travelNote: "",
    rateNote: "",
    pricingStandardized: true,
    pricingTiers: [],
    materials: "In progress",
    format: input.format,
    maxStudents: "",
    locations: inpersonRate === null ? "" : input.stations.join(", "),
    medium: input.languages.join(", "),
    notes: "",
    referralCode: input.referralCode,
    certificatesLater: true,
    commissionAck: true,
    privacyAck: true,
    termsAck: true,
  };
}
