import { describe, expect, it } from "vitest";

import {
  changedCredentialFields,
  credentialEditRejectionsMessage,
  credentialEvidencePath,
  isDuplicatePendingEditError,
  stableSnapshotJson,
  valueSnapshotToColumn,
  type CredentialSnapshotValue,
} from "../../src/features/tutors/credential-edit.functions";
import { toValueSnapshot } from "../../src/features/tutors/credential-edits";

describe("stableSnapshotJson", () => {
  it("is order-insensitive for object keys", () => {
    expect(stableSnapshotJson({ a: 1, b: 2 })).toBe(stableSnapshotJson({ b: 2, a: 1 }));
  });

  it("handles nesting, arrays and null", () => {
    const a = { text: "x", meta: { z: [1, { q: null }] } };
    const b = { meta: { z: [1, { q: null }] }, text: "x" };
    expect(stableSnapshotJson(a)).toBe(stableSnapshotJson(b));
    expect(stableSnapshotJson(null)).toBe("null");
    expect(stableSnapshotJson(undefined)).toBe("null");
  });
});

describe("changedCredentialFields", () => {
  const baseline = {
    secondary_school: "SC",
    undergrad_university: "HKU",
    undergrad_degree: "BSc",
    undergrad_graduation_year: "2020",
    has_postgrad: false,
    postgrad_university: "",
    postgrad_degree: "",
    qualifications_summary: "Summary",
    exam_results: [{ system: "IBDP", score: 42 }],
    achievements: [{ title: "Debate" }],
  };

  it("returns nothing when the draft matches the loaded form", () => {
    expect(changedCredentialFields(baseline, { ...baseline })).toEqual([]);
  });

  it("detects an edited text field", () => {
    expect(changedCredentialFields(baseline, { ...baseline, secondary_school: "X" })).toEqual([
      "secondary_school",
    ]);
  });

  it("detects jsonb edits regardless of key order", () => {
    const next = {
      ...baseline,
      exam_results: [{ score: 42, system: "IBDP" }],
    };
    expect(changedCredentialFields(baseline, next)).toEqual([]);
    expect(
      changedCredentialFields(baseline, {
        ...baseline,
        exam_results: [{ system: "IBDP", score: 44 }],
      }),
    ).toEqual(["exam_results"]);
  });

  it("ignores the dropped highschool column and other keys the form does not carry", () => {
    expect(changedCredentialFields({}, {})).toEqual([]);
    expect(changedCredentialFields({ highschool: "old" }, { highschool: "new" })).toEqual([]);
  });

  it("detects a has_postgrad toggle and keeps false distinct from null", () => {
    expect(changedCredentialFields(baseline, { ...baseline, has_postgrad: true })).toEqual([
      "has_postgrad",
    ]);
    expect(changedCredentialFields(baseline, { ...baseline, has_postgrad: false })).toEqual([]);
    expect(
      changedCredentialFields(
        { ...baseline, has_postgrad: false },
        { ...baseline, has_postgrad: null },
      ),
    ).toEqual(["has_postgrad"]);
  });

  it("queues an undergrad university change for evidence review", () => {
    expect(
      changedCredentialFields(baseline, { ...baseline, undergrad_university: "CUHK" }),
    ).toEqual(["undergrad_university"]);
  });

  it("agrees with the snapshot shapes used for old_value/new_value", () => {
    const field = "undergrad_university" as const;
    const before = toValueSnapshot(field, baseline[field]);
    const after = toValueSnapshot(field, "CUHK");
    expect(stableSnapshotJson(before)).not.toBe(stableSnapshotJson(after));
    expect(toValueSnapshot(field, "CUHK")).toEqual({ text: "CUHK" });
  });
});

describe("valueSnapshotToColumn", () => {
  it("unboxes text snapshots and nulls empties", () => {
    expect(valueSnapshotToColumn("secondary_school", { text: "SC" })).toBe("SC");
    expect(valueSnapshotToColumn("secondary_school", { text: "" })).toBeNull();
    expect(valueSnapshotToColumn("secondary_school", null)).toBeNull();
  });

  it("passes jsonb snapshots through untouched", () => {
    const json = [{ system: "IBDP", score: 42 }] as CredentialSnapshotValue;
    expect(valueSnapshotToColumn("exam_results", json)).toBe(json);
    expect(valueSnapshotToColumn("achievements", null)).toBeNull();
  });

  it("returns boolean|null for has_postgrad true, false, and null", () => {
    expect(valueSnapshotToColumn("has_postgrad", toValueSnapshot("has_postgrad", true))).toBe(true);
    expect(valueSnapshotToColumn("has_postgrad", toValueSnapshot("has_postgrad", false))).toBe(
      false,
    );
    expect(valueSnapshotToColumn("has_postgrad", toValueSnapshot("has_postgrad", null))).toBeNull();
    expect(valueSnapshotToColumn("has_postgrad", true)).toBe(true);
    expect(valueSnapshotToColumn("has_postgrad", false)).toBe(false);
    expect(valueSnapshotToColumn("has_postgrad", null)).toBeNull();
    expect(typeof valueSnapshotToColumn("has_postgrad", false)).toBe("boolean");
    // A legacy {text} box must not approve as the string "true"/"false".
    expect(valueSnapshotToColumn("has_postgrad", { text: "true" })).toBe(true);
    expect(valueSnapshotToColumn("has_postgrad", { text: "false" })).toBe(false);
    expect(valueSnapshotToColumn("has_postgrad", { text: "" })).toBeNull();
  });
});

describe("isDuplicatePendingEditError", () => {
  it("matches the one-open-per-field unique index", () => {
    expect(
      isDuplicatePendingEditError({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "tutor_credential_edits_one_open_per_field"',
      }),
    ).toBe(true);
    expect(
      isDuplicatePendingEditError({ message: "tutor_credential_edits_one_open_per_field barfed" }),
    ).toBe(true);
  });

  it("ignores unrelated failures", () => {
    expect(isDuplicatePendingEditError({ code: "42501", message: "row-level security" })).toBe(
      false,
    );
    expect(isDuplicatePendingEditError(null)).toBe(false);
    expect(isDuplicatePendingEditError(undefined)).toBe(false);
  });
});

describe("credentialEditRejectionsMessage", () => {
  it("names the evidence rule for the common cases", () => {
    expect(
      credentialEditRejectionsMessage([{ code: "evidence_required", field: "secondary_school" }]),
    ).toMatch(/document/i);
    expect(
      credentialEditRejectionsMessage([
        { code: "evidence_too_large", field: "secondary_school", size: 11 },
      ]),
    ).toMatch(/10 MB/);
    expect(
      credentialEditRejectionsMessage([
        { code: "evidence_bad_type", field: "secondary_school", type: "x" },
      ]),
    ).toMatch(/PDF/);
    expect(
      credentialEditRejectionsMessage([{ code: "empty_value", field: "secondary_school" }]),
    ).toMatch(/new value/i);
    expect(credentialEditRejectionsMessage([])).toBeTruthy();
  });
});

describe("credentialEvidencePath", () => {
  it("namespaces by tutor and keeps a safe filename", () => {
    const path = credentialEvidencePath("11111111-1111-1111-1111-111111111111", "my slip.pdf");
    expect(path).toMatch(/^11111111-1111-1111-1111-111111111111\/[0-9a-f-]{36}-my_slip\.pdf$/);
  });

  it("falls back to a generic name without path traversal", () => {
    const path = credentialEvidencePath("t", "../../etc/passwd");
    expect(path.split("/")).toHaveLength(2);
    const basename = path.split("/")[1] ?? "";
    expect(basename).not.toContain("..");
    expect(basename).toMatch(/^[0-9a-f-]{36}-\.[^/]*$/);
  });
});
