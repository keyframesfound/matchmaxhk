import { describe, expect, it } from "vitest";

import {
  APPLICATION_STAGE_ORDER,
  getApplicationStage,
} from "../../src/features/tutor-application/application-status";

describe("getApplicationStage", () => {
  it("maps a pending unlinked application to under review", () => {
    expect(
      getApplicationStage({ status: "pending", linkedTutorId: null, needsInfoItems: [] }),
    ).toBe("review");
  });

  it("keeps the submitted step before review in the tracker", () => {
    // The stored row is already in review, so SUBMITTED renders as done and
    // UNDER_REVIEW as the current step (parent #466 stepper semantics).
    expect(APPLICATION_STAGE_ORDER[0]).toBe("submitted");
    expect(APPLICATION_STAGE_ORDER[1]).toBe("review");
    expect(APPLICATION_STAGE_ORDER).toEqual(["submitted", "review", "needs_info", "approved"]);
  });

  it("maps accepted to approved", () => {
    expect(
      getApplicationStage({ status: "accepted", linkedTutorId: "t1", needsInfoItems: [] }),
    ).toBe("approved");
  });

  it("maps a linked card to approved regardless of the raw status", () => {
    // #310: the publish RPC stamps linked_tutor_id at submit; the link alone
    // means approved even on a legacy pending row.
    expect(
      getApplicationStage({ status: "pending", linkedTutorId: "t1", needsInfoItems: [] }),
    ).toBe("approved");
  });

  it("maps rejected to the terminal banner stage", () => {
    expect(
      getApplicationStage({ status: "rejected", linkedTutorId: null, needsInfoItems: [] }),
    ).toBe("rejected");
    expect(APPLICATION_STAGE_ORDER).not.toContain("rejected");
  });

  it("parks a pending row with live missing items at needs_info", () => {
    expect(
      getApplicationStage({
        status: "pending",
        linkedTutorId: null,
        needsInfoItems: ["DSE Mathematics grade slip"],
      }),
    ).toBe("needs_info");
  });

  it("keeps needs_info strictly before approved (issue flow order)", () => {
    expect(
      getApplicationStage({
        status: "accepted",
        linkedTutorId: "t1",
        needsInfoItems: ["stale item"],
      }),
    ).toBe("approved");
  });
});
