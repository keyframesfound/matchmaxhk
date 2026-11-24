import { describe, expect, it } from "vitest";

import {
  PROGRESS_PROOF_BUCKET,
  PROGRESS_PROOF_EXPIRED_NOTE,
  PROGRESS_PROOF_EXPIRY_DAYS,
  PROGRESS_PROOF_MAX_BYTES,
  PROGRESS_PROOF_MAX_MB,
  PROGRESS_PROOF_REJECTION_FALLBACK,
  expiredProgressProofUpdate,
  isProgressProofExpired,
  normalizeProgressProofType,
  planProgressProofReview,
  planProgressProofSweep,
  planProgressProofUpload,
  progressProofAgeDays,
  progressProofExtension,
  progressProofFileError,
  progressProofPath,
  type ProgressProofRow,
} from "../../src/features/cases/progress-proofs";

const PDF = "application/pdf";
const PNG = "image/png";
const JPEG = "image/jpeg";
const KEY = "progress/case-1/cp-1-1700000000000.pdf";

function row(overrides: Partial<ProgressProofRow> = {}): ProgressProofRow {
  return {
    verification: "tutor_unconfirmed",
    proof_key: KEY,
    proof_uploaded_at: "2026-11-20T00:00:00.000Z",
    proof_reviewed_at: null,
    ...overrides,
  };
}

const NOW = new Date("2026-11-24T00:00:00.000Z");

describe("progress proof constants", () => {
  it("uses the private bucket and a 10 MB cap", () => {
    expect(PROGRESS_PROOF_BUCKET).toBe("progress-proofs");
    expect(PROGRESS_PROOF_MAX_MB).toBe(10);
    expect(PROGRESS_PROOF_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(PROGRESS_PROOF_EXPIRY_DAYS).toBe(14);
  });

  it("accepts only pdf, jpeg and png", () => {
    expect(normalizeProgressProofType(PDF)).toBe(PDF);
    expect(normalizeProgressProofType("IMAGE/PNG; charset=binary")).toBe(PNG);
    expect(normalizeProgressProofType("image/jpg")).toBe(JPEG);
    expect(normalizeProgressProofType("image/webp")).toBeNull();
    expect(normalizeProgressProofType("application/zip")).toBeNull();
  });

  it("maps a type to its stored extension", () => {
    expect(progressProofExtension(PDF)).toBe("pdf");
    expect(progressProofExtension(JPEG)).toBe("jpg");
    expect(progressProofExtension(PNG)).toBe("png");
    expect(progressProofExtension("application/zip")).toBeNull();
  });

  it("refuses an empty, oversized or unaccepted file", () => {
    expect(progressProofFileError({ contentType: PDF, bytes: 0 })).toBe("FILE_TYPE");
    expect(progressProofFileError({ contentType: "application/zip", bytes: 100 })).toBe(
      "FILE_TYPE",
    );
    expect(progressProofFileError({ contentType: PDF, bytes: PROGRESS_PROOF_MAX_BYTES + 1 })).toBe(
      "FILE_TOO_LARGE",
    );
    expect(
      progressProofFileError({ contentType: PDF, bytes: PROGRESS_PROOF_MAX_BYTES }),
    ).toBeNull();
  });
});

describe("progressProofPath", () => {
  it("builds progress/<caseId>/<checkpointId>-<stamp>.<ext>", () => {
    expect(
      progressProofPath({
        caseId: "case-1",
        checkpointId: "cp-1",
        contentType: PNG,
        now: 1700000000000,
      }),
    ).toBe("progress/case-1/cp-1-1700000000000.png");
  });

  it("strips anything that could climb out of the case folder", () => {
    const path = progressProofPath({
      caseId: "../../other/case",
      checkpointId: "cp/../1",
      contentType: PDF,
      now: 1,
    });
    expect(path).toBe("progress/othercase/cp1-1.pdf");
    expect(path.includes("..")).toBe(false);
  });
});

describe("planProgressProofUpload", () => {
  const base = {
    side: "tutor" as const,
    authorSide: "tutor" as const,
    caseId: "case-1",
    checkpointId: "cp-1",
    contentType: PDF,
    bytes: 1024,
    now: 1700000000000,
  };

  it("never publishes: the plan always stamps tutor_unconfirmed", () => {
    const plan = planProgressProofUpload(base);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.verification).toBe("tutor_unconfirmed");
    expect(plan.path).toBe(KEY);
  });

  it("refuses the desk supplying its own evidence", () => {
    expect(planProgressProofUpload({ ...base, side: "staff" })).toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });
  });

  it("refuses a tutor supporting a parent-authored row", () => {
    expect(planProgressProofUpload({ ...base, authorSide: "parent" })).toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });
  });

  it("lets the family support either side's row", () => {
    expect(planProgressProofUpload({ ...base, side: "parent", authorSide: "tutor" }).ok).toBe(true);
    expect(planProgressProofUpload({ ...base, side: "parent", authorSide: "parent" }).ok).toBe(
      true,
    );
  });

  it("surfaces the file rejections", () => {
    expect(planProgressProofUpload({ ...base, bytes: PROGRESS_PROOF_MAX_BYTES + 1 })).toEqual({
      ok: false,
      reason: "FILE_TOO_LARGE",
    });
    expect(planProgressProofUpload({ ...base, contentType: "application/zip" })).toEqual({
      ok: false,
      reason: "FILE_TYPE",
    });
  });
});

describe("planProgressProofReview — approval", () => {
  it("flips verification to desk_checked and purges the key", () => {
    const plan = planProgressProofReview({
      reviewerIsAdmin: true,
      reviewerId: "admin-1",
      row: row(),
      decision: "approve",
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.update.verification).toBe("desk_checked");
    // Purged, and the object named for deletion is the row's own document.
    expect(plan.update.proof_key).toBeNull();
    expect(plan.purgeKey).toBe(KEY);
    expect(plan.update.proof_reviewed_by).toBe("admin-1");
    expect(plan.update.proof_reviewed_at).toBe("2026-11-24T00:00:00.000Z");
    expect(plan.update.proof_rejection).toBeNull();
  });

  it("clears an earlier rejection note when the same row is later approved", () => {
    const plan = planProgressProofReview({
      reviewerIsAdmin: true,
      reviewerId: "admin-1",
      row: row(),
      decision: "approve",
      note: "ignore this on approve",
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.update.proof_rejection).toBeNull();
  });
});

describe("planProgressProofReview — rejection", () => {
  it("reverts to tutor_unconfirmed and purges the key", () => {
    const plan = planProgressProofReview({
      reviewerIsAdmin: true,
      reviewerId: "admin-2",
      row: row({ verification: "parent_attested" }),
      decision: "reject",
      note: "  Name does not match the case  ",
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.update.verification).toBe("tutor_unconfirmed");
    expect(plan.update.proof_key).toBeNull();
    expect(plan.purgeKey).toBe(KEY);
    expect(plan.update.proof_rejection).toBe("Name does not match the case");
  });

  it("stores a marker when the desk gives no note", () => {
    const plan = planProgressProofReview({
      reviewerIsAdmin: true,
      reviewerId: "admin-2",
      row: row(),
      decision: "reject",
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.update.proof_rejection).toBe(PROGRESS_PROOF_REJECTION_FALLBACK);
  });

  it("purges the document on BOTH decisions", () => {
    const approve = planProgressProofReview({
      reviewerIsAdmin: true,
      reviewerId: "admin-1",
      row: row(),
      decision: "approve",
      now: NOW,
    });
    const reject = planProgressProofReview({
      reviewerIsAdmin: true,
      reviewerId: "admin-1",
      row: row(),
      decision: "reject",
      now: NOW,
    });
    expect(approve.ok && reject.ok).toBe(true);
    if (!approve.ok || !reject.ok) return;
    expect(approve.purgeKey).toBe(KEY);
    expect(reject.purgeKey).toBe(KEY);
    expect(approve.update.proof_key).toBeNull();
    expect(reject.update.proof_key).toBeNull();
  });
});

describe("planProgressProofReview — refusals", () => {
  it("refuses a non-admin caller", () => {
    const plan = planProgressProofReview({
      reviewerIsAdmin: false,
      reviewerId: "user-1",
      row: row(),
      decision: "approve",
      now: NOW,
    });
    expect(plan).toEqual({ ok: false, reason: "FORBIDDEN" });
  });

  it("refuses a missing checkpoint", () => {
    expect(
      planProgressProofReview({
        reviewerIsAdmin: true,
        reviewerId: "admin-1",
        row: null,
        decision: "approve",
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  it("treats an already-decided or swept row as not pending", () => {
    expect(
      planProgressProofReview({
        reviewerIsAdmin: true,
        reviewerId: "admin-1",
        row: row({
          proof_key: null,
          verification: "desk_checked",
          proof_reviewed_at: NOW.toISOString(),
        }),
        decision: "approve",
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "NOT_PENDING" });
  });
});

describe("progressProofAgeDays", () => {
  it("counts whole days and never goes negative", () => {
    expect(progressProofAgeDays("2026-11-20T00:00:00.000Z", NOW)).toBe(4);
    expect(progressProofAgeDays("2026-11-24T12:00:00.000Z", NOW)).toBe(0);
    expect(progressProofAgeDays(null, NOW)).toBe(0);
    expect(progressProofAgeDays("not-a-date", NOW)).toBe(0);
  });
});

describe("the 14-day sweep", () => {
  const sweepRow = (overrides: Partial<Parameters<typeof isProgressProofExpired>[0]> = {}) => ({
    id: "cp-1",
    proof_key: KEY,
    proof_uploaded_at: "2026-11-11T00:00:00.000Z",
    proof_reviewed_at: null,
    ...overrides,
  });

  it("keeps a document inside the window", () => {
    expect(
      isProgressProofExpired(sweepRow({ proof_uploaded_at: "2026-11-11T00:00:00.000Z" }), NOW),
    ).toBe(false); // 13 days
  });

  it("expires a document on day 14 and beyond", () => {
    expect(
      isProgressProofExpired(sweepRow({ proof_uploaded_at: "2026-11-10T00:00:00.000Z" }), NOW),
    ).toBe(true); // 14 days
    expect(
      isProgressProofExpired(sweepRow({ proof_uploaded_at: "2026-10-01T00:00:00.000Z" }), NOW),
    ).toBe(true);
  });

  it("treats an unstamped pointer as stale, and never touches a reviewed row", () => {
    expect(isProgressProofExpired(sweepRow({ proof_uploaded_at: null }), NOW)).toBe(true);
    expect(
      isProgressProofExpired(
        sweepRow({
          proof_uploaded_at: "2026-01-01T00:00:00.000Z",
          proof_reviewed_at: "2026-01-02T00:00:00.000Z",
        }),
        NOW,
      ),
    ).toBe(false);
    expect(isProgressProofExpired(sweepRow({ proof_key: null }), NOW)).toBe(false);
  });

  it("returns the object to purge for each stale row", () => {
    const targets = planProgressProofSweep(
      [
        sweepRow({ id: "stale-1", proof_uploaded_at: "2026-10-01T00:00:00.000Z" }),
        sweepRow({
          id: "fresh",
          proof_uploaded_at: "2026-11-22T00:00:00.000Z",
          proof_key: "progress/c/f",
        }),
        sweepRow({ id: "stale-2", proof_uploaded_at: null, proof_key: "progress/c/g" }),
      ],
      NOW,
    );
    expect(targets).toEqual([
      { id: "stale-1", purgeKey: KEY },
      { id: "stale-2", purgeKey: "progress/c/g" },
    ]);
  });

  it("reverts a swept checkpoint to unconfirmed with the expired marker", () => {
    expect(expiredProgressProofUpdate()).toEqual({
      verification: "tutor_unconfirmed",
      proof_key: null,
      proof_rejection: PROGRESS_PROOF_EXPIRED_NOTE,
    });
  });
});
