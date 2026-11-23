import { describe, expect, it } from "vitest";

import {
  COURSE_ENQUIRY_MESSAGE_MAX_CHARS,
  COURSE_HIGHLIGHTS_MAX,
  COURSE_HIGHLIGHT_MAX_CHARS,
  buildCourseEnquiryRow,
  courseFormatLabel,
  isCourseFormat,
  normalizeHighlights,
  normalizeInstructionLanguages,
  type CourseEnquiryCourse,
  type CourseEnquiryTutor,
  type CourseEnquiryWhoFor,
} from "../../src/features/business/course-showcase";

const org = { id: "org-1", name: "Beacon Centre", slug: "beacon" };

const course: CourseEnquiryCourse = {
  id: "course-1",
  title: "IB Physics Small Group",
  subject: "Physics",
  curriculum: "IB",
  target_grade: "Year 12",
  district: "Wan Chai",
  mode: "in_person",
};

const tutor: CourseEnquiryTutor = {
  userId: "tutor-user-1",
  displayName: "Amy Chan",
  tutorCode: "MM-T001",
};

function build(
  over: Partial<Parameters<typeof buildCourseEnquiryRow>[0]> = {},
  courseOver: Partial<CourseEnquiryCourse> = {},
  requestedTutor: CourseEnquiryTutor | null = null,
) {
  return buildCourseEnquiryRow(
    {
      name: "Ryan Yeung",
      phone: "+852 9123 4567",
      email: "ryan@example.com",
      whoFor: "myself",
      message: "Please tell me more about this course.",
      userId: null,
      ...over,
    },
    org,
    { ...course, ...courseOver },
    requestedTutor,
  );
}

describe("#815 course showcase enquiry row is a lead, not a paid enrolment (AC-CRS-1)", () => {
  it("writes a centre lead the desk still sees before any dispatch", () => {
    const row = build();

    expect(row.case_type).toBe("centre");
    expect(row.organisation_id).toBe(org.id);
    expect(row.course_id).toBe(course.id);
    expect(row.source).toBe("website_centre_course");
    expect(row.status).toBe("new");
    expect(row.board_published_at).toBeNull();
    expect(row.package_type).toBe("ongoing_1_5");
    expect(row.requester_type).toBe("parent");
    expect(row.support_type).toBe("subject_tutoring");
  });

  it("carries no price, amount, or Stripe field", () => {
    const keys = Object.keys(build());

    expect(keys.filter((k) => /price|amount|stripe/i.test(k))).toEqual([]);
    expect(JSON.stringify(build())).not.toMatch(/stripe|amount_due|price_/i);
  });

  it("writes exactly the agreed lead columns, so a new payment field fails here", () => {
    expect(Object.keys(build()).sort()).toEqual([
      "board_published_at",
      "budget_currency",
      "case_type",
      "compliance_triage",
      "contact_email",
      "contact_name",
      "contact_phone",
      "course_id",
      "description",
      "district",
      "exam_system",
      "language_of_instruction",
      "learner_nickname",
      "mode",
      "organisation_id",
      "package_type",
      "parent_id",
      "preferred_gender",
      "rate_unit",
      "requested_tutor_id",
      "requester_type",
      "sen_categories",
      "sen_required",
      "session_length_minutes",
      "sessions_per_week",
      "source",
      "status",
      "student_count",
      "student_level",
      "subjects",
      "support_type",
      "tags",
      "title",
      "tutor_background",
      "who_for",
    ]);
  });
});

describe("#815 course showcase enquiry identity fields", () => {
  it("labels a my_child enquiry as 'My child' but keeps who_for raw", () => {
    const child = build({ whoFor: "my_child" });

    expect(child.who_for).toBe("my_child");
    expect(child.learner_nickname).toBe("My child");
  });

  it("uses the enquirer name as learner nickname for myself", () => {
    const whoFor: CourseEnquiryWhoFor = "myself";
    const self = build({ whoFor, name: "Ryan Yeung" });

    expect(self.who_for).toBe("myself");
    expect(self.learner_nickname).toBe("Ryan Yeung");
  });

  it("trims and caps the contact fields, and turns a blank email into null", () => {
    const row = build({
      name: `  ${"n".repeat(200)}  `,
      phone: `  ${"9".repeat(60)}  `,
      email: `  ${"e".repeat(200)}  `,
    });

    expect(row.contact_name).toBe("n".repeat(80));
    expect(row.contact_phone).toBe("9".repeat(30));
    expect(row.contact_email).toBe("e".repeat(120));
    expect(typeof row.contact_name).toBe("string");
    expect((row.contact_name as string).startsWith(" ")).toBe(false);

    expect(build({ email: "   " }).contact_email).toBeNull();
    expect(build({ email: null }).contact_email).toBeNull();
    expect(build({ email: undefined }).contact_email).toBeNull();
  });

  it("trims the message and truncates it at the shared cap", () => {
    const long = `  ${"m".repeat(COURSE_ENQUIRY_MESSAGE_MAX_CHARS + 250)}  `;
    const row = build({ message: long });

    expect((row.description as string).length).toBe(COURSE_ENQUIRY_MESSAGE_MAX_CHARS);
    expect(row.description).toBe("m".repeat(COURSE_ENQUIRY_MESSAGE_MAX_CHARS));

    expect(build({ message: "   " }).description).toBeNull();
    expect(build({ message: null }).description).toBeNull();
  });
});

describe("#815 course showcase enquiry tags and fallbacks", () => {
  it("tags a plain enquiry, and tags a tutor request with a second tag", () => {
    const plain = build();
    expect(plain.tags).toEqual(["Course enquiry"]);
    expect(plain.requested_tutor_id).toBeNull();
    expect(plain.title).toBe(`${course.title}: course enquiry`);

    const requested = build({}, {}, tutor);
    expect(requested.tags).toHaveLength(2);
    expect((requested.tags as string[])[0]).toBe("Course enquiry");
    expect((requested.tags as string[])[1]).toMatch(/^\[Requested Tutor: /);
    expect((requested.tags as string[])[1]).toBe("[Requested Tutor: Amy Chan]");
    expect(requested.requested_tutor_id).toBe(tutor.userId);
    expect(requested.title).toBe(`${course.title} (tutor request)`);
  });

  it("falls back to 'General' subjects and an 'Unspecified' level when the course omits them", () => {
    const bare = build({}, { subject: null, target_grade: null });

    expect(bare.subjects).toEqual(["General"]);
    expect(bare.student_level).toBe("Unspecified");

    expect(build().subjects).toEqual(["Physics"]);
    expect(build().student_level).toBe("Year 12");
  });

  it("a tutor-only request (AC-TUT-3) has no course but still names the tutor", () => {
    const row = buildCourseEnquiryRow(
      {
        name: "Ryan Yeung",
        phone: "+852 9123 4567",
        email: null,
        whoFor: "myself",
        message: null,
        userId: null,
      },
      org,
      null,
      tutor,
    );

    expect(row.course_id).toBeNull();
    expect(row.title).toBe("Tutor request: Amy Chan");
    expect(row.tags).toEqual(["Course enquiry", "[Requested Tutor: Amy Chan]"]);
    expect(row.requested_tutor_id).toBe(tutor.userId);
    expect(row.mode).toBe("either");
    expect(row.subjects).toEqual(["General"]);
  });
});

describe("#815 course showcase field caps", () => {
  it("keeps at most three highlights, each capped at 300 chars, dropping blanks", () => {
    const long = "h".repeat(COURSE_HIGHLIGHT_MAX_CHARS + 120);
    const highlights = normalizeHighlights([
      "  Small classes  ",
      "   ",
      null,
      42,
      long,
      "Exam focused",
      "Extra row past the cap",
    ]);

    expect(highlights).toHaveLength(COURSE_HIGHLIGHTS_MAX);
    expect(highlights[0]).toBe("Small classes");
    expect(highlights[1]).toBe("h".repeat(COURSE_HIGHLIGHT_MAX_CHARS));
    expect(highlights[2]).toBe("Exam focused");

    expect(normalizeHighlights("not an array")).toEqual([]);
    expect(normalizeHighlights([])).toEqual([]);
  });

  it("keeps only valid instruction languages, lowercased, deduped, in order", () => {
    expect(
      normalizeInstructionLanguages([
        "Mandarin",
        "english",
        "  CANTONESE ",
        "english",
        "french",
        7,
      ]),
    ).toEqual(["mandarin", "english", "cantonese"]);

    expect(normalizeInstructionLanguages(undefined)).toEqual([]);
    expect(normalizeInstructionLanguages(["klingon"])).toEqual([]);
  });
});

describe("#815 course showcase formats", () => {
  it("accepts the four showcase formats and rejects anything else", () => {
    for (const format of [
      "small_group",
      "bootcamp",
      "one_on_one_centre",
      "admissions_consultation",
    ]) {
      expect(isCourseFormat(format)).toBe(true);
      expect(courseFormatLabel(format)).not.toBeNull();
    }

    expect(isCourseFormat("hire")).toBe(false);
    expect(isCourseFormat("")).toBe(false);
    expect(isCourseFormat(null)).toBe(false);
    expect(courseFormatLabel("hire")).toBeNull();
    expect(courseFormatLabel(null)).toBeNull();
  });
});
