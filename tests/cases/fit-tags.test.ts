import { describe, expect, it } from "vitest";

import {
  EMPTY_FIT_TAGS,
  defaultFitReason,
  fitHint,
  fitReasonError,
  fitTagsFromRow,
  fitTagsToRow,
  tutorQuitRematchMessage,
  type FitTags,
} from "@/features/cases/fit-tags";

const tutor: FitTags = {
  teachingStyle: "EXAM_DRILLING",
  materialsPolicy: "PROVIDES_OWN_NOTES",
  vibe: "WARM_ENCOURAGING",
  homework: null,
};

describe("fitHint", () => {
  it("never counts unset tags against a tutor", () => {
    const hint = fitHint(tutor, EMPTY_FIT_TAGS);
    expect(hint).toEqual({ matches: [], mismatches: [], hardBlock: false, compared: 0 });
  });

  it("splits matches and mismatches on tags set on both sides", () => {
    const hint = fitHint(tutor, {
      teachingStyle: "EXAM_DRILLING",
      materialsPolicy: null,
      vibe: "STRICT_DISCIPLINED",
      homework: "IN_CLASS_ONLY",
    });
    expect(hint.matches).toEqual(["teachingStyle"]);
    expect(hint.mismatches).toEqual(["vibe"]);
    expect(hint.compared).toBe(2);
    expect(hint.hardBlock).toBe(false);
  });

  it("hard-blocks only when materials policy is set on both sides and differs", () => {
    const parent = { ...EMPTY_FIT_TAGS, materialsPolicy: "USES_SCHOOL_MATERIALS" as const };
    expect(fitHint(tutor, parent).hardBlock).toBe(true);
    expect(fitHint({ ...tutor, materialsPolicy: null }, parent).hardBlock).toBe(false);
  });
});

describe("fitReasonError", () => {
  it("requires one fit reason on a verified stop after L1", () => {
    expect(
      fitReasonError({ kind: "stopped_after_l1", verification: "verified", fitReason: null }),
    ).toBe("FIT_REASON_REQUIRED");
    expect(
      fitReasonError({
        kind: "stopped_after_l1",
        verification: "verified",
        fitReason: "PACE_MISMATCH",
      }),
    ).toBeNull();
  });

  it("does not ask while verification is pending or for other outcomes", () => {
    expect(
      fitReasonError({ kind: "stopped_after_l1", verification: "pending", fitReason: null }),
    ).toBeNull();
    expect(fitReasonError({ kind: "continued", verification: null, fitReason: null })).toBeNull();
  });
});

describe("defaultFitReason", () => {
  it("maps tutor quits to TUTOR_QUIT and leaves parent reasons for the desk", () => {
    expect(defaultFitReason("tutor_flake")).toBe("TUTOR_QUIT");
    expect(defaultFitReason("tutor_emergency")).toBe("TUTOR_QUIT");
    expect(defaultFitReason("tutor_fault")).toBe("TUTOR_UNPREPARED");
    expect(defaultFitReason("vague")).toBeNull();
    expect(defaultFitReason(null)).toBeNull();
  });
});

describe("row mapping", () => {
  it("round-trips tutor and case columns and drops junk values", () => {
    expect(fitTagsFromRow(fitTagsToRow(tutor, "tutor"), "tutor")).toEqual(tutor);
    expect(fitTagsToRow(tutor, "case")).toMatchObject({ pref_teaching_style: "EXAM_DRILLING" });
    expect(fitTagsFromRow({ pref_vibe: "LOUD" }, "case").vibe).toBeNull();
  });
});

describe("tutorQuitRematchMessage", () => {
  it("promises a 24–48h rematch at no extra cost and never a refund", () => {
    const msg = tutorQuitRematchMessage({ caseCode: "MM-1234", emergency: false });
    expect(msg).toContain("MM-1234");
    expect(msg).toContain("24 to 48 hours");
    expect(msg).toContain("no extra cost");
    expect(msg.toLowerCase()).not.toContain("refund");
  });
});
