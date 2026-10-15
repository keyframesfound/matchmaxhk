import { describe, it, expect } from "vitest";

import {
  buildTutorCardInsert,
  buildQualificationsSummary,
  mapApplicationFormatToLessonMode,
  mapApplicationStatusToTutorStatus,
  mappedCardContactError,
  splitApplicationList,
  type ApplicationAttachmentFile,
} from "../../src/lib/tutor-card-mapping";
import { nextTutorCode } from "../../src/lib/tutor-code";
import type { TutorApplication } from "../../src/lib/tutor-application.schema";

/**
 * Issue #310 — go live on submit. The application→card mapping is pure and
 * deterministic (NO AI), so it is tested directly. The stored application
 * payload is the post-submit normalized shape written by
 * submitTutorApplication.
 */

type StoredApplication = Omit<TutorApplication, "turnstileToken">;

function baseApplication(overrides: Partial<StoredApplication> = {}): StoredApplication {
  return {
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
    highSchool: "Queen's College",
    curriculum: "IBDP",
    curricula: ["IBDP"],
    overallScore: "44/45",
    academicHeadline: "IBDP 44/45",
    subjectsConfident: "IB Maths HL, IB Physics HL, IB Chemistry SL",
    subjectResults: "IBDP (44/45)\nMathematics: 7",
    awards: "",
    achievements: [],
    academicDocuments: [],
    portfolioImages: [],
    portfolioConsent: false,
    experience: "",
    senEnabled: false,
    senCategories: [],
    senExperience: "",
    selfIntroduction: "I teach maths the way I learned it.",
    hourlyRate: "150",
    onlineRate: 200,
    inpersonRate: 150,
    rateRows: [{ label: "Small group (2-3)", rate: 120 }],
    travelNote: "HK Island only",
    rateNote: "",
    pricingStandardized: true,
    pricingTiers: [],
    materials: "Yes",
    format: "Both",
    maxStudents: "4",
    locations: "Admiralty, Central",
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

describe("mapApplicationStatusToTutorStatus (#310 TutorEditor mapping)", () => {
  it("maps all three application statuses to the tutor_status codes", () => {
    expect(mapApplicationStatusToTutorStatus("University Student")).toBe("uni_student");
    expect(mapApplicationStatusToTutorStatus("Full/Part-Time Tutor")).toBe("full_part_time_tutor");
    expect(mapApplicationStatusToTutorStatus("Professional Teacher/ Public Exam Examiner")).toBe(
      "examiner",
    );
  });
});

describe("mapApplicationFormatToLessonMode (#310)", () => {
  it("maps Face to face / Online / Both to the card enum", () => {
    expect(mapApplicationFormatToLessonMode("Face to face")).toBe("in_person");
    expect(mapApplicationFormatToLessonMode("Online")).toBe("online");
    expect(mapApplicationFormatToLessonMode("Both")).toBe("either");
  });
});

describe("splitApplicationList (#310)", () => {
  it("splits comma-joined picker answers and dedupes case-insensitively", () => {
    expect(splitApplicationList("English, Cantonese, english")).toEqual(["English", "Cantonese"]);
  });

  it("drops empty entries and respects the cap", () => {
    const many = Array.from({ length: 30 }, (_, i) => `Subject ${i + 1}`).join(", ");
    expect(splitApplicationList(many)).toHaveLength(20);
    expect(splitApplicationList(", , English")).toEqual(["English"]);
  });
});

describe("buildQualificationsSummary (#310)", () => {
  it("renders achievements as house-style blocks, deterministically", () => {
    const summary = buildQualificationsSummary({
      achievements: [
        {
          title: "Dean's List",
          description: "Awarded for top 5% of the cohort.",
          proofStatus: "not_applicable",
        },
      ],
      awards: "",
    });
    expect(summary).toBe("**• Dean's List :** Awarded for top 5% of the cohort.");
  });

  it("falls back to the awards answer, else empty", () => {
    expect(buildQualificationsSummary({ achievements: [], awards: "HKMO Bronze" })).toBe(
      "HKMO Bronze",
    );
    expect(buildQualificationsSummary({ achievements: [], awards: "" })).toBe("");
  });
});

describe("buildTutorCardInsert (#310 publish-at-submit mapping)", () => {
  const files: ApplicationAttachmentFile[] = [
    { source: "profile_photo", url: "https://r2.example/photo.jpg" },
    { source: "portfolio_image", url: "https://r2.example/trophy-1.jpg" },
    { source: "portfolio_image", url: "https://r2.example/trophy-2.jpg" },
    { source: "transcript", url: "https://r2.example/transcript.pdf" },
  ];

  it("maps every obvious card counterpart and publishes by default", () => {
    const payload = buildTutorCardInsert(baseApplication(), "MM-T042", files);
    expect(payload.tutor_code).toBe("MM-T042");
    expect(payload.display_name).toBe("Chan Tai Man");
    expect(payload.is_published).toBe(true);
    expect(payload.created_by).toBeNull();
    expect(payload.currency).toBe("HKD");
    expect(payload.lesson_mode).toBe("either");
    expect(payload.online_rate).toBe(200);
    expect(payload.inperson_rate).toBe(150);
    expect(payload.rate_rows).toEqual([{ label: "Small group (2-3)", rate: 120 }]);
    expect(payload.travel_note).toBe("HK Island only");
    expect(payload.subjects).toEqual(["IB Maths HL", "IB Physics HL", "IB Chemistry SL"]);
    expect(payload.languages).toEqual(["English", "Cantonese"]);
    expect(payload.stations).toEqual(["Admiralty", "Central"]);
    expect(payload.tutor_status).toBe("uni_student");
    expect(payload.start_immediately).toBe(true);
    expect(payload.earliest_start_date).toBeNull();
    expect(payload.self_introduction).toBe("I teach maths the way I learned it.");
    expect(payload.academic_headline).toBe("IBDP 44/45");
    expect(payload.undergrad_university).toBe("The University of Hong Kong");
    expect(payload.secondary_school).toBe("Queen's College");
    expect(payload.photo_url).toBe("https://r2.example/photo.jpg");
    expect(payload.portfolio_images).toEqual([
      "https://r2.example/trophy-1.jpg",
      "https://r2.example/trophy-2.jpg",
    ]);
    // Genuinely ambiguous fields stay empty — nothing invented.
    expect(payload.target_students).toEqual([]);
    expect(payload.exam_results).toEqual([]);
  });

  it("hourly_rate is the floor of the two base rates", () => {
    const payload = buildTutorCardInsert(baseApplication(), "MM-T001");
    expect(payload.hourly_rate).toBe(150);
    const onlineOnly = buildTutorCardInsert(
      baseApplication({ format: "Online", inpersonRate: null, travelNote: "" }),
      "MM-T001",
    );
    expect(onlineOnly.hourly_rate).toBe(200);
    expect(onlineOnly.lesson_mode).toBe("online");
  });

  it("maps the start date only when not starting immediately", () => {
    const dated = buildTutorCardInsert(
      baseApplication({ startImmediately: false, startDate: "2026-11-01" }),
      "MM-T001",
    );
    expect(dated.start_immediately).toBe(false);
    expect(dated.earliest_start_date).toBe("2026-11-01");
  });

  it("falls back to the generated academic headline when the answer is blank", () => {
    const payload = buildTutorCardInsert(baseApplication({ academicHeadline: "" }), "MM-T001");
    expect(payload.academic_headline).toBe("IBDP 44/45");
  });

  it("keeps per-curriculum pricing tiers via the shared normalizer", () => {
    const payload = buildTutorCardInsert(
      baseApplication({
        pricingStandardized: false,
        pricingTiers: [
          { curriculum: "IBDP", rate: 250 },
          { curriculum: "HKDSE", rate: 0 },
        ],
      }),
      "MM-T001",
    );
    expect(payload.pricing_tiers).toEqual([
      { curriculum: "IBDP", rate: 250 },
      { curriculum: "HKDSE", rate: 250 },
    ]);
  });

  it("maps professional-path applications (placeholder school dropped)", () => {
    const payload = buildTutorCardInsert(
      baseApplication({
        status: "Professional Teacher/ Public Exam Examiner",
        highSchool: "Not provided",
        overallScore: "Not applicable - professional pathway",
      }),
      "MM-T001",
    );
    expect(payload.tutor_status).toBe("examiner");
    expect(payload.secondary_school).toBeNull();
  });
});

describe("mappedCardContactError (#357 / #359)", () => {
  it("accepts a normal card, including R2 photo URLs", () => {
    const payload = buildTutorCardInsert(baseApplication(), "MM-T001", [
      { source: "profile_photo", url: "https://r2.example/photo.jpg" },
    ]);
    expect(mappedCardContactError(payload)).toBeNull();
  });

  it("flags contact text that the mapper copies onto the public card", () => {
    const withAward = buildTutorCardInsert(
      baseApplication({ awards: "Email me at tutor@example.com" }),
      "MM-T001",
    );
    expect(mappedCardContactError(withAward)).toMatch(/email/i);

    const withSubject = buildTutorCardInsert(
      baseApplication({ subjectsConfident: "Maths, whatsapp" }),
      "MM-T001",
    );
    expect(mappedCardContactError(withSubject)).toMatch(/whatsapp/i);

    const withName = buildTutorCardInsert(baseApplication({ name: "Chan 9123 4567" }), "MM-T001");
    expect(mappedCardContactError(withName)).toMatch(/phone/i);
  });
});

describe("nextTutorCode (#310 shared code allocation)", () => {
  it("returns max+1 padded to three digits, case-insensitive", () => {
    expect(nextTutorCode([{ tutor_code: "mm-t007" }, { tutor_code: "MM-T042" }])).toBe("MM-T043");
    expect(nextTutorCode([])).toBe("MM-T001");
    expect(nextTutorCode([{ tutor_code: "LEGACY" }])).toBe("MM-T001");
  });
});
