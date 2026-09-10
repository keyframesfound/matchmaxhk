// Select options shared by the public case request form and the admin edit dialog.
import {
  INTL_PRIMARY_SUBJECTS,
  LOCAL_PRIMARY_SUBJECTS,
  getSubjectOptionsForCategory,
} from "@/features/tutors/subjects";

export const LEVEL_OPTIONS = [
  { value: "Primary", label: "Primary" },
  { value: "Junior secondary", label: "Junior secondary (Year 7–9 / S1–S3)" },
  { value: "Senior secondary", label: "Senior secondary (Year 10–13 / S4–S6)" },
  { value: "University", label: "University" },
  { value: "Other", label: "Other" },
];

export const EXAM_SYSTEM_OPTIONS = [
  { value: "IB", label: "IB" },
  { value: "DSE", label: "DSE" },
  { value: "IGCSE", label: "IGCSE" },
  { value: "AP", label: "AP" },
  { value: "A-Level", label: "A-Level" },
  { value: "Not sure yet", label: "Not sure yet" },
];

// --- 3-step tutor request form options ---

export const REQUESTER_TYPE_OPTIONS = [
  { value: "parent", label: "Parent" },
  { value: "student", label: "Student" },
];

export const SUPPORT_TYPE_OPTIONS = [
  { value: "subject_tutoring", label: "Subject Tutoring & School Exams" },
  {
    value: "admissions",
    label: "University Admissions & Standardized Tests (SAT, IELTS, UCAT, ISAT)",
  },
];

// Values reuse the legacy exam_system vocabulary (IB/DSE/A-Level/IGCSE)
// so board grouping and the admin edit dialog keep working.
export const CURRICULUM_OPTIONS = [
  { value: "IB", label: "IBDP" },
  { value: "DSE", label: "HKDSE" },
  { value: "A-Level", label: "A-Level" },
  { value: "IGCSE", label: "IGCSE" },
  { value: "Local Primary", label: "Local Primary" },
  { value: "Int'l Primary", label: "Int'l Primary" },
];

// Curriculum-specific components. Curricula without components still show
// the dropdown with a single "None" option (decided: show with 'None').
export const CURRICULUM_COMPONENTS: Record<string, string[]> = {
  IB: ["IA", "EE", "TOK"],
  "Local Primary": ["Phonics"],
  "Int'l Primary": ["Phonics"],
};

export const INSTRUCTION_LANGUAGE_OPTIONS = [
  { value: "english_only", label: "English" },
  { value: "cantonese", label: "Cantonese" },
  { value: "mandarin", label: "Mandarin" },
  { value: "bilingual", label: "Bilingual" },
  { value: "any", label: "No preference" },
];

// "offline" maps to DB 'in_person'; "both"/"no_pref" map to DB 'either'.
export const DELIVERY_MODE_OPTIONS = [
  { value: "online", label: "Online" },
  { value: "offline", label: "In Person" },
  { value: "both", label: "Both" },
  { value: "no_pref", label: "No preference" },
];

export const TUTOR_BACKGROUND_OPTIONS = [
  { value: "uni_student", label: "University student" },
  { value: "official_examiner", label: "Official examiner" },
  { value: "any", label: "No preference" },
];

export const TUTOR_BACKGROUND_LABELS: Record<string, string> = {
  uni_student: "University student",
  official_examiner: "Official examiner",
  any: "No preference",
};

export const TARGET_PATHWAY_OPTIONS = [
  { value: "ucas_uk", label: "UCAS / UK" },
  { value: "us_admissions", label: "US Admissions" },
  { value: "hk_jupas", label: "HK JUPAS" },
  { value: "tests", label: "Tests" },
];

export const TARGET_PATHWAY_LABELS: Record<string, string> = {
  ucas_uk: "UCAS / UK",
  us_admissions: "US Admissions",
  hk_jupas: "HK JUPAS",
  tests: "Tests",
};

export const INTERVIEW_TEST_OPTIONS = ["Medicine MMI", "Oxbridge", "IELTS", "SAT", "UCAT", "ISAT"];

// Seed list for the searchable target-school picker; parents can type any
// school/university not listed (allowCustom).
export const TARGET_SCHOOL_OPTIONS = [
  "HKU",
  "CUHK",
  "HKUST",
  "PolyU",
  "CityU",
  "HKBU",
  "Lingnan University",
  "EdUHK",
  "Oxford",
  "Cambridge",
  "Imperial College London",
  "LSE",
  "UCL",
  "University of Edinburgh",
  "University of Manchester",
  "Harvard",
  "Yale",
  "Princeton",
  "Stanford",
  "MIT",
  "UPenn",
  "Columbia",
].sort((a, b) => a.localeCompare(b));

export const SCHOOL_TYPE_OPTIONS = [
  { value: "International school", label: "International school" },
  { value: "Local school", label: "Local school" },
  { value: "DSS school", label: "DSS school" },
  { value: "Private school", label: "Private school" },
  { value: "Other", label: "Other" },
];

export function getComponentOptionsForCurriculum(curriculum: string): string[] {
  return ["None", ...(CURRICULUM_COMPONENTS[curriculum] ?? [])];
}

// Subjects locked to the selected curriculum; empty until one is chosen.
export function getSubjectOptionsForCurriculum(curriculum: string): string[] {
  if (curriculum === "Local Primary") return [...LOCAL_PRIMARY_SUBJECTS];
  if (curriculum === "Int'l Primary") return [...INTL_PRIMARY_SUBJECTS];
  if (!curriculum) return [];
  return getSubjectOptionsForCategory(curriculum);
}
