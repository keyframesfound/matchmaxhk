import { describe, expect, it } from "vitest";

import {
  GRADE_ACHIEVED_MAX_LEN,
  NOTE_TOPIC_MAX_LEN,
  legacyDocumentTypeToMaterialType,
  mergeNoteKinds,
  validateNoteKindsForSubmit,
  validateNoteKindsPartial,
} from "../../src/features/materials/lifecycle";

describe("validateNoteKindsForSubmit (#313)", () => {
  const clean = {
    curriculum: "IB",
    subject: "Physics",
    materialType: "notes",
    topic: "Waves",
    gradeAchieved: "",
    exemplarPermission: false,
  };

  it("accepts a clean notes listing", () => {
    expect(validateNoteKindsForSubmit(clean)).toEqual([]);
  });

  it("requires curriculum, subject and type", () => {
    expect(validateNoteKindsForSubmit({})).toContain(
      "Curriculum must be IB, DSE, IGCSE, A-Level, or Other.",
    );
    expect(validateNoteKindsForSubmit({ ...clean, curriculum: "HKDSE" })).not.toEqual([]);
    expect(validateNoteKindsForSubmit({ ...clean, subject: "  " })).toContain(
      "Subject is required.",
    );
    expect(validateNoteKindsForSubmit({ ...clean, materialType: "question_bank" })).toContain(
      "Type must be notes, mock, or exemplar.",
    );
  });

  it("blocks exemplars without the written-permission confirmation", () => {
    const errors = validateNoteKindsForSubmit({
      ...clean,
      materialType: "exemplar",
      exemplarPermission: false,
    });
    expect(errors).toContain("Exemplars need the written-permission confirmation.");
    expect(
      validateNoteKindsForSubmit({ ...clean, materialType: "exemplar", exemplarPermission: true }),
    ).toEqual([]);
  });

  it("grade achieved is exemplar-only and capped", () => {
    expect(
      validateNoteKindsForSubmit({ ...clean, materialType: "mock", gradeAchieved: "IB 7" }),
    ).toContain("Grade achieved can only be set on an exemplar.");
    expect(
      validateNoteKindsForSubmit({
        ...clean,
        materialType: "exemplar",
        exemplarPermission: true,
        gradeAchieved: "IB 7",
      }),
    ).toEqual([]);
    expect(
      validateNoteKindsForSubmit({
        ...clean,
        materialType: "exemplar",
        exemplarPermission: true,
        gradeAchieved: "x".repeat(GRADE_ACHIEVED_MAX_LEN + 1),
      }),
    ).toContain(`Grade achieved must be ${GRADE_ACHIEVED_MAX_LEN} characters or fewer.`);
  });

  it("caps topic length", () => {
    expect(
      validateNoteKindsForSubmit({ ...clean, topic: "x".repeat(NOTE_TOPIC_MAX_LEN + 1) }),
    ).toContain(`Topic must be ${NOTE_TOPIC_MAX_LEN} characters or fewer.`);
  });
});

describe("validateNoteKindsPartial (#313 draft saves)", () => {
  it("accepts empty and partial inputs", () => {
    expect(validateNoteKindsPartial({})).toEqual([]);
    expect(
      validateNoteKindsPartial({ curriculum: "IGCSE", materialType: "mock", topic: "Cells" }),
    ).toEqual([]);
  });

  it("still enforces enum membership and caps on present fields", () => {
    expect(validateNoteKindsPartial({ curriculum: "HKCEE" })).not.toEqual([]);
    expect(validateNoteKindsPartial({ materialType: "flashcards" })).not.toEqual([]);
    expect(validateNoteKindsPartial({ topic: "x".repeat(NOTE_TOPIC_MAX_LEN + 1) })).not.toEqual([]);
    expect(
      validateNoteKindsPartial({ gradeAchieved: "x".repeat(GRADE_ACHIEVED_MAX_LEN + 1) }),
    ).not.toEqual([]);
  });
});

describe("legacyDocumentTypeToMaterialType (#313 backfill)", () => {
  it("maps mock_exam to mock and everything else to notes", () => {
    expect(legacyDocumentTypeToMaterialType("mock_exam")).toBe("mock");
    expect(legacyDocumentTypeToMaterialType("custom_notes")).toBe("notes");
    expect(legacyDocumentTypeToMaterialType("ia")).toBe("notes");
    expect(legacyDocumentTypeToMaterialType("ee")).toBe("notes");
    expect(legacyDocumentTypeToMaterialType("tok_essay")).toBe("notes");
  });
});

describe("mergeNoteKinds (#313 review fix — explicit-clear semantics)", () => {
  const exemplarRow = {
    curriculumTag: "IB",
    subjectTag: "History",
    materialType: "exemplar" as const,
    topic: "Cold War",
    gradeAchieved: "IB 7",
    exemplarPermission: true,
  };

  it("keeps stored values when the input omits fields", () => {
    const merged = mergeNoteKinds({}, exemplarRow);
    expect(merged.curriculum).toBe("IB");
    expect(merged.subject).toBe("History");
    expect(merged.materialType).toBe("exemplar");
    expect(merged.topic).toBe("Cold War");
    expect(merged.gradeAchieved).toBe("IB 7");
    expect(merged.exemplarPermission).toBe(true);
  });

  it("null clears topic and grade instead of falling back to the stored value", () => {
    const merged = mergeNoteKinds({ topic: null }, exemplarRow);
    expect(merged.topic).toBe("");
    expect(merged.curriculum).toBe("IB");
    expect(merged.gradeAchieved).toBe("IB 7");

    const cleared = mergeNoteKinds({ gradeAchieved: "" }, exemplarRow);
    expect(cleared.gradeAchieved).toBeNull();
  });

  it("switching the type away from exemplar drops grade and permission", () => {
    const merged = mergeNoteKinds({ materialType: "notes" }, exemplarRow);
    expect(merged.materialType).toBe("notes");
    expect(merged.gradeAchieved).toBeNull();
    expect(merged.exemplarPermission).toBe(false);
    expect(merged.curriculum).toBe("IB");
    expect(merged.subject).toBe("History");
    expect(merged.topic).toBe("Cold War");
  });

  it("explicit false permission on an exemplar is not resurrected from storage", () => {
    const merged = mergeNoteKinds(
      { materialType: "exemplar", exemplarPermission: false },
      exemplarRow,
    );
    expect(merged.exemplarPermission).toBe(false);
  });

  it("never keeps grade or permission on a non-exemplar row even if supplied", () => {
    const merged = mergeNoteKinds(
      { materialType: "mock", gradeAchieved: "DSE 5**", exemplarPermission: true },
      undefined,
    );
    expect(merged.gradeAchieved).toBeNull();
    expect(merged.exemplarPermission).toBe(false);
  });

  it("new rows default to notes with empty optional fields", () => {
    const merged = mergeNoteKinds({}, undefined);
    expect(merged).toEqual({
      curriculum: "",
      subject: "",
      materialType: "notes",
      topic: "",
      gradeAchieved: null,
      exemplarPermission: false,
    });
  });
});
