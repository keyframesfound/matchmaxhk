import { describe, expect, it } from "vitest";

import {
  GRADE_REJECTION_REASONS,
  approvedLabelsAfterReview,
  badgeSurvivesDelete,
  countApprovedGrades,
  gradeFileProblem,
  gradeLabelError,
  hasVerifiedBadge,
  isAcceptedGradeFileType,
  isGradeRejectionReason,
  isTutorGradeStatus,
  looksLikeHkid,
  nextStatusAfterLabelEdit,
  nextStatusAfterUpload,
  normalizeGradeLabel,
} from "../../src/features/tutors/grades";

describe("countApprovedGrades / hasVerifiedBadge (badge derivation)", () => {
  it("counts only approved rows", () => {
    expect(
      countApprovedGrades([
        { status: "approved" },
        { status: "approved" },
        { status: "pending" },
        { status: "rejected" },
        { status: "none" },
      ]),
    ).toBe(2);
  });

  it("shows the badge at exactly >=1 approved grade", () => {
    expect(hasVerifiedBadge([])).toBe(false);
    expect(hasVerifiedBadge([{ status: "pending" }])).toBe(false);
    expect(hasVerifiedBadge([{ status: "rejected" }])).toBe(false);
    expect(hasVerifiedBadge([{ status: "none" }])).toBe(false);
    expect(hasVerifiedBadge([{ status: "approved" }])).toBe(true);
    expect(
      hasVerifiedBadge([{ status: "approved" }, { status: "pending" }, { status: "rejected" }]),
    ).toBe(true);
  });

  it("drops the badge when the last approved grade is demoted", () => {
    const before = [{ status: "approved" as const }, { status: "pending" as const }];
    expect(hasVerifiedBadge(before)).toBe(true);
    const after = before.map((grade) =>
      grade.status === "approved" ? { status: "pending" as const } : grade,
    );
    expect(hasVerifiedBadge(after)).toBe(false);
  });
});

describe("nextStatusAfterLabelEdit (edit-after-approval state machine)", () => {
  it("sends an approved grade back to pending when the TEXT changes", () => {
    expect(nextStatusAfterLabelEdit("approved", true)).toBe("pending");
  });

  it("keeps approved when the text did not actually change", () => {
    expect(nextStatusAfterLabelEdit("approved", false)).toBe("approved");
  });

  it("never touches other statuses", () => {
    expect(nextStatusAfterLabelEdit("pending", true)).toBe("pending");
    expect(nextStatusAfterLabelEdit("none", true)).toBe("none");
    expect(nextStatusAfterLabelEdit("rejected", true)).toBe("rejected");
  });
});

describe("nextStatusAfterUpload (upload state machine)", () => {
  it("every fresh slip enters the review queue, including on approved rows", () => {
    for (const currentStatus of ["none", "pending", "approved", "rejected"] as const) {
      expect(nextStatusAfterUpload(currentStatus)).toBe("pending");
    }
  });
});

describe("badgeSurvivesDelete / approvedLabelsAfterReview", () => {
  const rows = [
    { id: "a", status: "approved" as const },
    { id: "b", status: "approved" as const },
    { id: "c", status: "pending" as const },
  ];

  it("deleting one of several approved grades keeps the badge", () => {
    expect(badgeSurvivesDelete(rows, "a")).toBe(true);
  });

  it("deleting the LAST approved grade drops the badge", () => {
    expect(badgeSurvivesDelete([rows[0], rows[2]], "a")).toBe(false);
  });

  it("deleting a non-approved row never drops the badge", () => {
    expect(badgeSurvivesDelete(rows, "c")).toBe(true);
  });

  it("rejecting one grade leaves other approved labels untouched", () => {
    expect(
      approvedLabelsAfterReview(
        [
          { id: "a", label: "IBDP 44", status: "approved" },
          { id: "b", label: "DSE 5**", status: "approved" },
          { id: "c", label: "IELTS 8.0", status: "none" },
        ],
        "b",
        "rejected",
      ),
    ).toEqual(["IBDP 44"]);
  });

  it("approving a row adds only that label", () => {
    expect(
      approvedLabelsAfterReview(
        [
          { id: "a", label: "IBDP 44", status: "approved" },
          { id: "c", label: "IELTS 8.0", status: "none" },
        ],
        "c",
        "approved",
      ),
    ).toEqual(["IBDP 44", "IELTS 8.0"]);
  });
});

describe("looksLikeHkid (identity card detector)", () => {
  it("catches common HKID shapes", () => {
    expect(looksLikeHkid("A123456(7).jpg")).toBe(true);
    expect(looksLikeHkid("AB1234567.pdf")).toBe(true);
    expect(looksLikeHkid("hkid A 123456 7")).toBe(true);
    expect(looksLikeHkid("scan_a123456(7).png")).toBe(true);
  });

  it("ignores ordinary grade labels and file names", () => {
    expect(looksLikeHkid("IBDP 44.pdf")).toBe(false);
    expect(looksLikeHkid("DSE 5** result slip")).toBe(false);
    expect(looksLikeHkid("MATH123456-final.png")).toBe(false);
    expect(looksLikeHkid("BSc Mathematics 2023")).toBe(false);
    expect(looksLikeHkid("1234567.jpg")).toBe(false);
  });
});

describe("grade file rules", () => {
  it("accepts PDF and images up to 10 MB", () => {
    expect(isAcceptedGradeFileType("application/pdf")).toBe(true);
    expect(isAcceptedGradeFileType("image/jpeg")).toBe(true);
    expect(isAcceptedGradeFileType("image/png")).toBe(true);
    expect(isAcceptedGradeFileType("image/webp")).toBe(true);
    expect(isAcceptedGradeFileType("application/msword")).toBe(false);
    expect(isAcceptedGradeFileType("video/mp4")).toBe(false);
  });

  it("client-side gradeFileProblem rejects HKID before anything else", () => {
    const makeFile = (name: string, type = "application/pdf", size = 1000): File => {
      const file = new File(["x"], name, { type });
      Object.defineProperty(file, "size", { value: size });
      return file;
    };
    expect(gradeFileProblem(makeFile("A123456(7).jpg", "image/jpeg"))).toBe("hkid");
    expect(gradeFileProblem(makeFile("slip.doc", "application/msword"))).toBe("type");
    expect(gradeFileProblem(makeFile("slip.pdf", "application/pdf", 11 * 1024 * 1024))).toBe(
      "size",
    );
    expect(gradeFileProblem(makeFile("slip.pdf"))).toBe(null);
  });
});

describe("grade label rules", () => {
  it("trims and caps the label", () => {
    expect(normalizeGradeLabel("  IBDP 44  ")).toBe("IBDP 44");
    expect(normalizeGradeLabel("x".repeat(300))).toHaveLength(120);
  });

  it("rejects contact details in public grade labels", () => {
    expect(gradeLabelError("IBDP 44 — whatsapp me 91234567")).not.toBeNull();
    expect(gradeLabelError("IBDP 44")).toBeNull();
  });
});

describe("guards", () => {
  it("status + rejection reason guards narrow unknown input", () => {
    expect(isTutorGradeStatus("approved")).toBe(true);
    expect(isTutorGradeStatus("maybe")).toBe(false);
    expect(isGradeRejectionReason("unreadable")).toBe(true);
    expect(isGradeRejectionReason("vibes")).toBe(false);
    expect(GRADE_REJECTION_REASONS).toHaveLength(5);
  });
});
