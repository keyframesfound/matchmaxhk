import { describe, expect, it } from "vitest";

import {
  PREVIEW_OWNER_COLUMNS,
  buildPreviewFetchPlan,
  isOwnReportTarget,
  isOwnTutorPreview,
  resolvePreviewCardState,
  shouldShowGoLiveCta,
} from "../../src/features/account/preview/preview-state";

/**
 * Issue #104 preview sandbox + #294 remainder: the go-live state machine
 * (live vs not-live per #356), the fetch plan it drives, and the report
 * owner-guard decision. Pure helpers only — see preview-state.ts.
 */

describe("PREVIEW_OWNER_COLUMNS", () => {
  it("selects publication fields only — no contact columns", () => {
    const cols = PREVIEW_OWNER_COLUMNS.split(",").map((c) => c.trim());
    expect(cols).toEqual(["tutor_code", "is_published", "user_id"]);
    for (const forbidden of ["phone", "email", "whatsapp", "contact"]) {
      expect(cols.some((col) => col.includes(forbidden))).toBe(false);
    }
  });
});

describe("resolvePreviewCardState", () => {
  it("live when the owner row is published with a code", () => {
    expect(
      resolvePreviewCardState({ tutor_code: "MM-T001", is_published: true, user_id: "u1" }),
    ).toEqual({ status: "live", tutorCode: "MM-T001" });
  });

  it("no_card when the account has no tutors row", () => {
    expect(resolvePreviewCardState(null)).toEqual({ status: "not_live", reason: "no_card" });
  });

  it("no_card when the row has no tutor code yet", () => {
    expect(
      resolvePreviewCardState({ tutor_code: null, is_published: true, user_id: "u1" }),
    ).toEqual({ status: "not_live", reason: "no_card" });
    expect(
      resolvePreviewCardState({ tutor_code: "   ", is_published: true, user_id: "u1" }),
    ).toEqual({ status: "not_live", reason: "no_card" });
  });

  it("unpublished when the card exists but is not published", () => {
    expect(
      resolvePreviewCardState({ tutor_code: "MM-T002", is_published: false, user_id: "u1" }),
    ).toEqual({ status: "not_live", reason: "unpublished" });
    expect(
      resolvePreviewCardState({ tutor_code: "MM-T002", is_published: null, user_id: "u1" }),
    ).toEqual({ status: "not_live", reason: "unpublished" });
  });
});

describe("shouldShowGoLiveCta", () => {
  it("shows only while the card is not live (#356: live card → no submit)", () => {
    expect(shouldShowGoLiveCta({ status: "live", tutorCode: "MM-T001" })).toBe(false);
    expect(shouldShowGoLiveCta({ status: "not_live", reason: "no_card" })).toBe(true);
    expect(shouldShowGoLiveCta({ status: "not_live", reason: "unpublished" })).toBe(true);
  });
});

describe("buildPreviewFetchPlan", () => {
  it("plans the public fetch keyed on the owner's tutor code when live", () => {
    expect(
      buildPreviewFetchPlan({ tutor_code: "MM-T003", is_published: true, user_id: "u1" }),
    ).toEqual({ stage: "public_data", tutorCode: "MM-T003" });
  });

  it("plans the empty state when there is no live card", () => {
    expect(buildPreviewFetchPlan(null)).toEqual({ stage: "empty_state", reason: "no_card" });
    expect(
      buildPreviewFetchPlan({ tutor_code: "MM-T004", is_published: false, user_id: "u1" }),
    ).toEqual({ stage: "empty_state", reason: "unpublished" });
  });
});

describe("isOwnReportTarget", () => {
  it("true only when both ids exist and match", () => {
    expect(isOwnReportTarget("u1", "u1")).toBe(true);
    expect(isOwnReportTarget("u1", "u2")).toBe(false);
    expect(isOwnReportTarget("u1", null)).toBe(false);
    expect(isOwnReportTarget(null, "u1")).toBe(false);
    expect(isOwnReportTarget(undefined, undefined)).toBe(false);
  });

  it("isOwnTutorPreview reads the public tutor's owner link", () => {
    expect(isOwnTutorPreview("u1", { user_id: "u1" })).toBe(true);
    expect(isOwnTutorPreview("u1", { user_id: null })).toBe(false);
    expect(isOwnTutorPreview("u1", null)).toBe(false);
  });
});
