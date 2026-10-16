import { describe, expect, it } from "vitest";

import {
  MAX_EVIDENCE_BYTES,
  applyCredentialDecision,
  credentialFieldValue,
  isCredentialEditField,
  isJsonbCredentialField,
  toValueSnapshot,
  validateCredentialEditInput,
  valueSnapshotToText,
} from "../../src/features/tutors/credential-edits";

const goodEvidence = { name: "slip.pdf", size: 1024, type: "application/pdf" };

describe("validateCredentialEditInput", () => {
  it("accepts a complete edit", () => {
    expect(
      validateCredentialEditInput({
        field: "secondary_school",
        newValue: "St Stephen's College",
        evidence: goodEvidence,
      }),
    ).toEqual([]);
  });

  it("rejects an unknown field outright", () => {
    expect(
      validateCredentialEditInput({
        field: "user_id" as never,
        newValue: "x",
        evidence: goodEvidence,
      }),
    ).toEqual([{ code: "unknown_field", field: "user_id" }]);
  });

  it("requires evidence for every field — that is the issue", () => {
    const rejections = validateCredentialEditInput({
      field: "undergrad_university",
      newValue: "HKU",
      evidence: null,
    });
    expect(rejections).toEqual([
      { code: "evidence_required", field: "undergrad_university" },
    ]);
  });

  it("rejects empty new values", () => {
    const rejections = validateCredentialEditInput({
      field: "qualifications_summary",
      newValue: "   ",
      evidence: goodEvidence,
    });
    expect(rejections).toEqual([
      { code: "empty_value", field: "qualifications_summary" },
    ]);
  });

  it("enforces the 10 MB cap", () => {
    const rejections = validateCredentialEditInput({
      field: "achievements",
      newValue: [{ title: "Debate captain" }],
      evidence: { name: "big.png", size: MAX_EVIDENCE_BYTES + 1, type: "image/png" },
    });
    expect(rejections).toMatchObject([{ code: "evidence_too_large" }]);
    expect(MAX_EVIDENCE_BYTES).toBe(10 * 1024 * 1024);
  });

  it("allows only pdf/image evidence", () => {
    const rejections = validateCredentialEditInput({
      field: "highschool",
      newValue: "SC",
      evidence: { name: "a.docx", size: 10, type: "application/msword" },
    });
    expect(rejections).toEqual([
      { code: "evidence_bad_type", field: "highschool", type: "application/msword" },
    ]);
  });

  it("knows the field set and jsonb split", () => {
    expect(isCredentialEditField("exam_results")).toBe(true);
    expect(isCredentialEditField("hourly_rate")).toBe(false);
    expect(isJsonbCredentialField("exam_results")).toBe(true);
    expect(isJsonbCredentialField("secondary_school")).toBe(false);
  });
});

describe("value snapshots", () => {
  it("boxes text fields, passes jsonb fields through", () => {
    expect(toValueSnapshot("secondary_school", "SC")).toEqual({ text: "SC" });
    const json = [{ system: "IBDP", subjects: [] }];
    expect(toValueSnapshot("exam_results", json)).toBe(json);
  });

  it("round-trips text snapshots for staff display", () => {
    const snapshot = toValueSnapshot("postgrad_degree", "MSc");
    expect(valueSnapshotToText(snapshot)).toBe("MSc");
    expect(valueSnapshotToText(toValueSnapshot("achievements", [{ title: "X" }]))).toBe(
      JSON.stringify([{ title: "X" }]),
    );
    expect(valueSnapshotToText(null)).toBe("");
  });
});

describe("applyCredentialDecision", () => {
  it("approves a pending edit", () => {
    const result = applyCredentialDecision(
      { status: "pending" },
      "approve",
      null,
      () => new Date("2026-10-16T08:00:00Z"),
    );
    expect(result).toEqual({
      ok: true,
      status: "approved",
      reviewedAt: "2026-10-16T08:00:00.000Z",
    });
  });

  it("rejects only with a staff reason — old value stays public", () => {
    expect(
      applyCredentialDecision({ status: "pending" }, "reject", null).ok,
    ).toBe(false);
    expect(
      applyCredentialDecision({ status: "pending" }, "reject", "  ").ok,
    ).toBe(false);
    const result = applyCredentialDecision(
      { status: "pending" },
      "reject",
      "document does not show the school name",
    );
    expect(result).toEqual({
      ok: true,
      status: "rejected",
      reviewedAt: expect.any(String),
    });
  });

  it("treats decided rows as terminal", () => {
    expect(applyCredentialDecision({ status: "approved" }, "reject", "x")).toEqual({
      ok: false,
      reason: "not_pending",
    });
  });
});

describe("credentialFieldValue", () => {
  it("reads the current public value for the snapshot", () => {
    const tutor = { secondary_school: "SC", achievements: null };
    expect(credentialFieldValue(tutor, "secondary_school")).toBe("SC");
    expect(credentialFieldValue(tutor, "achievements")).toBeNull();
  });
});
