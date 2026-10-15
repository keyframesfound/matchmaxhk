import { describe, expect, it } from "vitest";

import { tutorApplicationSchema } from "../../src/lib/tutor-application.schema";

/**
 * Issue #357 / #359 — contact details in any field that is copied onto the
 * live card fail intake. Nothing is stored when the schema rejects.
 */

const studentCard = {
  filename: "student-id.png",
  contentType: "image/png",
  size: 4,
  content: "aaaa",
};

function application(overrides: Record<string, unknown> = {}) {
  return {
    turnstileToken: "token",
    name: "Chan Tai Man",
    preferredName: "",
    phone: "+852 9123 4567",
    email: "chantaiman@example.com",
    country: "Hong Kong",
    year: "2",
    graduationYear: "2027",
    startImmediately: true,
    startDate: "",
    status: "University Student",
    statusOther: "",
    professionalRoles: [],
    examiningBoards: [],
    teachingQualifications: [],
    university: "The University of Hong Kong",
    programme: "BSc",
    hasPostgrad: false,
    postgradUniversity: "",
    postgradDegree: "",
    studentCard,
    highSchool: "Queen's College",
    curriculum: "IBDP",
    curricula: ["IBDP"],
    overallScore: "44/45",
    academicHeadline: "IBDP 44/45",
    subjectsConfident: "IB Maths HL, IB Physics HL",
    subjectResults: "IBDP (44/45)\nMathematics: 7",
    awards: "",
    achievements: [],
    academicDocuments: [],
    portfolioImages: [],
    portfolioConsent: false,
    senEnabled: false,
    senCategories: [],
    senExperience: "",
    experience: "",
    selfIntroduction: "I teach maths the way I learned it.",
    hourlyRate: "",
    onlineRate: 200,
    inpersonRate: null,
    rateRows: [],
    travelNote: "",
    rateNote: "",
    pricingStandardized: true,
    pricingTiers: [],
    materials: "Yes",
    format: "Online",
    maxStudents: "",
    locations: "",
    medium: "English, Cantonese",
    notes: "",
    referralCode: "",
    certificatesLater: false,
    commissionAck: true,
    privacyAck: true,
    termsAck: true,
    ...overrides,
  };
}

function rejected(overrides: Record<string, unknown>) {
  const parsed = tutorApplicationSchema.safeParse(application(overrides));
  expect(parsed.success).toBe(false);
  if (parsed.success) return;
  expect(parsed.error.issues.some((issue) => /contact details/i.test(issue.message))).toBe(true);
}

describe("tutor application contact filter (#357 / #359)", () => {
  it("accepts a normal application", () => {
    expect(tutorApplicationSchema.safeParse(application()).success).toBe(true);
  });

  it("rejects contact details in every field that maps onto the live card", () => {
    rejected({ name: "Chan 9123 4567" });
    rejected({ awards: "Write to tutor@example.com" });
    rejected({
      achievements: [
        {
          title: "Dean's List",
          description: "WhatsApp me for the certificate",
          proofStatus: "not_applicable",
        },
      ],
    });
    rejected({
      achievements: [
        {
          title: "Ping me on telegram",
          description: "School prize",
          proofStatus: "not_applicable",
        },
      ],
    });
    rejected({ subjectsConfident: "Maths, whatsapp" });
    rejected({ medium: "English, signal" });
    rejected({
      format: "Face to face",
      onlineRate: null,
      inpersonRate: 200,
      locations: "Central, 9123 4567",
    });
    rejected({ rateRows: [{ label: "WhatsApp group", rate: 120 }] });
    rejected({ university: "HKU tutor@example.com" });
    rejected({ programme: "BSc — ig me" });
    rejected({ highSchool: "Queen's College 9123 4567" });
    rejected({ graduationYear: "class of 9123 4567" });
    rejected({
      hasPostgrad: true,
      postgradUniversity: "Email the dept at dept@example.com",
      postgradDegree: "MSc",
    });
    rejected({
      hasPostgrad: true,
      postgradUniversity: "University of Edinburgh",
      postgradDegree: "MSc whatsapp",
    });
  });
});
