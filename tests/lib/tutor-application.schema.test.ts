import { describe, expect, it } from "vitest";

import { buildAnswerRows, tutorApplicationSchema } from "@/lib/tutor-application.schema";

// Minimal valid application: student path, IBDP, online-only so no
// locations are required. Individual tests override single fields.
function validApplication() {
  return {
    turnstileToken: "tok-".concat("x".repeat(16)),
    name: "Chan Tai Man",
    phone: "+852 9123 4567",
    email: "tutor@example.com",
    country: "Hong Kong",
    status: "University Student" as const,
    year: "2",
    university: "The University of Hong Kong",
    programme: "BSc Mathematics",
    studentCard: { filename: "student-id.jpg", contentType: "image/png", size: 2048, content: "x" },
    highSchool: "St Stephen's College",
    curriculum: "IBDP" as const,
    curricula: ["IBDP" as const],
    overallScore: "42",
    subjectsConfident: "Maths AA HL",
    subjectResults: "7 in Maths AA HL",
    hourlyRate: "350",
    materials: "Yes" as const,
    format: "Online" as const,
    medium: "English",
    commissionAck: true,
    privacyAck: true,
    termsAck: true,
  };
}

function parse(data: ReturnType<typeof validApplication>) {
  return tutorApplicationSchema.safeParse(data);
}

describe("tutorApplicationSchema — happy path", () => {
  it("accepts a complete valid application", () => {
    const result = parse(validApplication());
    expect(result.success).toBe(true);
  });

  it("defaults optional fields", () => {
    const result = parse(validApplication());
    if (!result.success) throw new Error("expected success");
    expect(result.data.startImmediately).toBe(true);
    expect(result.data.professionalRoles).toEqual([]);
    expect(result.data.achievements).toEqual([]);
    expect(result.data.selfIntroduction).toBe("");
  });
});

describe("tutorApplicationSchema — required fields and acks", () => {
  it("rejects when an acknowledgement is missing", () => {
    for (const ack of ["commissionAck", "privacyAck", "termsAck"] as const) {
      const data = { ...validApplication(), [ack]: false };
      const result = tutorApplicationSchema.safeParse(data);
      expect(result.success, `${ack}=false must be rejected`).toBe(false);
    }
  });

  it("rejects empty name, email, highSchool, subjects", () => {
    for (const field of ["name", "highSchool", "subjectsConfident", "subjectResults"] as const) {
      const data = { ...validApplication(), [field]: "   " };
      expect(parse(data).success, `${field} blank must be rejected`).toBe(false);
    }
  });

  it("rejects an invalid email", () => {
    expect(parse({ ...validApplication(), email: "not-an-email" }).success).toBe(false);
  });

  it("rejects a referral code with special characters", () => {
    const data = { ...validApplication(), referralCode: "bad;code!" };
    expect(tutorApplicationSchema.safeParse(data).success).toBe(false);
  });

  it("accepts an alphanumeric referral code", () => {
    const data = { ...validApplication(), referralCode: "PAL-2026_x" };
    expect(tutorApplicationSchema.safeParse(data).success).toBe(true);
  });
});

describe("tutorApplicationSchema — student vs professional paths", () => {
  it("requires year, university and programme for students", () => {
    for (const patch of [{ year: "" }, { university: "" }, { programme: "" }] as const) {
      expect(parse({ ...validApplication(), ...patch }).success).toBe(false);
    }
  });

  it("requires a studentCard for students", () => {
    const noCard = { ...validApplication() };
    delete (noCard as Record<string, unknown>).studentCard;
    expect(parse(noCard).success).toBe(false);
  });

  it("professional status exempts student fields but requires qualifications", () => {
    const professional = {
      ...validApplication(),
      status: "Professional Teacher/ Public Exam Examiner" as const,
      year: undefined,
      university: undefined,
      programme: undefined,
      teachingQualifications: ["PGDE" as const],
      overallScore: "not validated for professionals",
    };
    const result = tutorApplicationSchema.safeParse(professional);
    expect(result.success).toBe(true);
  });

  it("professional without any teaching qualification is rejected", () => {
    const professional = {
      ...validApplication(),
      status: "Professional Teacher/ Public Exam Examiner" as const,
      year: undefined,
      university: undefined,
      programme: undefined,
    };
    expect(tutorApplicationSchema.safeParse(professional).success).toBe(false);
  });

  it("examiner role requires at least one examining board", () => {
    const examiner = {
      ...validApplication(),
      professionalRoles: ["Official examiner / moderator" as const],
    };
    expect(tutorApplicationSchema.safeParse(examiner).success).toBe(false);
    expect(
      tutorApplicationSchema.safeParse({ ...examiner, examiningBoards: ["HKEAA" as const] })
        .success,
    ).toBe(true);
  });
});

describe("tutorApplicationSchema — curriculum score validation (student path)", () => {
  it("IBDP accepts only 40-45", () => {
    expect(parse({ ...validApplication(), overallScore: "45" }).success).toBe(true);
    expect(parse({ ...validApplication(), overallScore: "39" }).success).toBe(false);
    expect(parse({ ...validApplication(), overallScore: "46" }).success).toBe(false);
    expect(parse({ ...validApplication(), overallScore: "42.5" }).success).toBe(false);
  });

  it("HKDSE requires a numeric Best 5 score", () => {
    const dse = { ...validApplication(), curriculum: "HKDSE" as const };
    expect(tutorApplicationSchema.safeParse({ ...dse, overallScore: "23" }).success).toBe(true);
    expect(tutorApplicationSchema.safeParse({ ...dse, overallScore: "5*" }).success).toBe(false);
    expect(tutorApplicationSchema.safeParse({ ...dse, overallScore: "twenty" }).success).toBe(
      false,
    );
  });

  it("SAT requires an integer 400-1600", () => {
    const sat = { ...validApplication(), curriculum: "SAT" as const };
    expect(tutorApplicationSchema.safeParse({ ...sat, overallScore: "1550" }).success).toBe(true);
    expect(tutorApplicationSchema.safeParse({ ...sat, overallScore: "399" }).success).toBe(false);
    expect(tutorApplicationSchema.safeParse({ ...sat, overallScore: "1601" }).success).toBe(false);
    expect(tutorApplicationSchema.safeParse({ ...sat, overallScore: "1500.5" }).success).toBe(
      false,
    );
  });

  it("IELTS accepts bands 4.0-9.0 in 0.5 steps only", () => {
    const ielts = { ...validApplication(), curriculum: "IELTS" as const };
    expect(tutorApplicationSchema.safeParse({ ...ielts, overallScore: "7.5" }).success).toBe(true);
    expect(tutorApplicationSchema.safeParse({ ...ielts, overallScore: "9.0" }).success).toBe(true);
    expect(tutorApplicationSchema.safeParse({ ...ielts, overallScore: "7.3" }).success).toBe(false);
    expect(tutorApplicationSchema.safeParse({ ...ielts, overallScore: "3.5" }).success).toBe(false);
  });

  it("UCAT(3600) requires multiples of 10 within range", () => {
    const ucat = { ...validApplication(), curriculum: "UCAT(3600)" as const };
    expect(tutorApplicationSchema.safeParse({ ...ucat, overallScore: "2450" }).success).toBe(true);
    expect(tutorApplicationSchema.safeParse({ ...ucat, overallScore: "2455" }).success).toBe(false);
    expect(tutorApplicationSchema.safeParse({ ...ucat, overallScore: "1150" }).success).toBe(false);
  });
});

describe("tutorApplicationSchema — format, dates, evidence", () => {
  it("face-to-face or both requires at least one location", () => {
    expect(
      tutorApplicationSchema.safeParse({ ...validApplication(), format: "Face to face" as const })
        .success,
    ).toBe(false);
    expect(
      tutorApplicationSchema.safeParse({
        ...validApplication(),
        format: "Face to face" as const,
        locations: "HK Central",
      }).success,
    ).toBe(true);
  });

  it("online-only does not require locations", () => {
    expect(parse(validApplication()).success).toBe(true);
  });

  it("fixed start date must be ISO yyyy-mm-dd and not in the past", () => {
    const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const notImmediate = { startImmediately: false } as const;
    expect(
      tutorApplicationSchema.safeParse({
        ...validApplication(),
        ...notImmediate,
        startDate: future,
      }).success,
    ).toBe(true);
    expect(
      tutorApplicationSchema.safeParse({
        ...validApplication(),
        ...notImmediate,
        startDate: "soon",
      }).success,
    ).toBe(false);
    expect(
      tutorApplicationSchema.safeParse({
        ...validApplication(),
        ...notImmediate,
        startDate: "2001-01-01",
      }).success,
    ).toBe(false);
  });

  it("achievements marked upload require proof", () => {
    const withAchievement = {
      ...validApplication(),
      achievements: [
        {
          title: "Maths Olympiad",
          description: "Gold award",
          proofStatus: "upload" as const,
        },
      ],
    };
    expect(tutorApplicationSchema.safeParse(withAchievement).success).toBe(false);
    expect(
      tutorApplicationSchema.safeParse({
        ...withAchievement,
        achievements: [
          {
            title: "Maths Olympiad",
            description: "Gold award",
            proofStatus: "upload" as const,
            proof: {
              filename: "award.pdf",
              contentType: "application/pdf",
              size: 1024,
              content: "x",
            },
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects more than MAX_FILES achievements", () => {
    const proof = { filename: "a.pdf", contentType: "application/pdf", size: 10, content: "x" };
    const many = Array.from({ length: 6 }, (_, i) => ({
      title: `Award ${i}`,
      description: "desc",
      proofStatus: "not_applicable" as const,
    }));
    expect(
      tutorApplicationSchema.safeParse({ ...validApplication(), achievements: many }).success,
    ).toBe(false);
  });

  it("profile photo must be JPG or PNG", () => {
    const wrongType = {
      filename: "photo.gif",
      contentType: "image/gif",
      size: 100,
      content: "x",
    };
    expect(
      tutorApplicationSchema.safeParse({ ...validApplication(), profilePhoto: wrongType }).success,
    ).toBe(false);
  });
});

describe("buildAnswerRows", () => {
  it("renders the parsed application as labelled rows", () => {
    const parsed = tutorApplicationSchema.parse(validApplication());
    const rows = buildAnswerRows(parsed);
    const labels = rows.map((row) => row.label);
    expect(labels).toContain("Name");
    expect(labels).toContain("Overall achieved score");
    expect(labels).toContain("Commission acknowledged");
    expect(rows.find((row) => row.label === "Earliest start date")?.value).toBe("Immediately");
  });
});
