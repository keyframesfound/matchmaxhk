import { describe, expect, it } from "vitest";

import { mergeNoteKinds, validateNoteKindsForSubmit } from "../../src/features/materials/lifecycle";
import {
  mergeDraftNoteKinds,
  validateDraftNoteKindsForSubmit,
} from "../../src/features/materials/note-drafts.functions";

/**
 * #340: tutor submit was rejecting filled curriculum/subject because the
 * zod payload (`curriculumTag` / `subjectTag`) was handed to helpers that
 * read `curriculum` / `subject`. These cases go through the same mapping
 * `saveNoteDraft` and `submitNoteForReview` call.
 */
describe("tutor note submit mapping (#340)", () => {
  const filled = {
    curriculumTag: "IB" as const,
    subjectTag: "Physics",
    materialType: "notes" as const,
    topic: "Waves",
    gradeAchieved: null,
    exemplarPermission: false,
  };

  it("accepts a submit whose curriculum and subject arrived as tag fields", () => {
    const kinds = mergeDraftNoteKinds(filled);
    expect(kinds.curriculum).toBe("IB");
    expect(kinds.subject).toBe("Physics");
    expect(validateDraftNoteKindsForSubmit(kinds)).toEqual([]);
  });

  it("the unmapped zod object still fails the helpers — that was the submit bug", () => {
    expect(mergeNoteKinds(filled).curriculum).toBe("");
    expect(mergeNoteKinds(filled).subject).toBe("");
    const errors = validateNoteKindsForSubmit(filled);
    expect(errors).toContain("Curriculum must be IB, DSE, IGCSE, A-Level, or Other.");
    expect(errors).toContain("Subject is required.");
  });

  it("keeps a stored curriculum when a draft save omits curriculumTag", () => {
    const kinds = mergeDraftNoteKinds(
      { topic: "Optics" },
      {
        curriculum_tag: "DSE",
        subject_tag: "Physics",
        material_type: "notes",
        topic: "Waves",
        grade_achieved: null,
        exemplar_permission: false,
      },
    );
    expect(kinds.curriculum).toBe("DSE");
    expect(kinds.subject).toBe("Physics");
    expect(kinds.topic).toBe("Optics");
    expect(validateDraftNoteKindsForSubmit(kinds)).toEqual([]);
  });

  it("null subjectTag clears a stored subject", () => {
    const kinds = mergeDraftNoteKinds(
      { subjectTag: null },
      {
        curriculum_tag: "IB",
        subject_tag: "History",
        material_type: "notes",
        topic: "Cold War",
        grade_achieved: null,
        exemplar_permission: false,
      },
    );
    expect(kinds.subject).toBe("");
    expect(kinds.curriculum).toBe("IB");
  });

  it("switching a stored exemplar to notes drops grade before submit validation", () => {
    const kinds = mergeDraftNoteKinds(
      {
        curriculumTag: "A-Level",
        subjectTag: "Maths",
        materialType: "notes",
        gradeAchieved: null,
        exemplarPermission: false,
      },
      {
        curriculum_tag: "A-Level",
        subject_tag: "Maths",
        material_type: "exemplar",
        topic: "Calculus",
        grade_achieved: "A*",
        exemplar_permission: true,
      },
    );
    expect(kinds.materialType).toBe("notes");
    expect(kinds.gradeAchieved).toBeNull();
    expect(kinds.exemplarPermission).toBe(false);
    expect(kinds.topic).toBe("Calculus");
    expect(validateDraftNoteKindsForSubmit(kinds)).toEqual([]);
  });

  it("an exemplar submit still requires the permission flag after the remap", () => {
    const kinds = mergeDraftNoteKinds({
      curriculumTag: "IGCSE",
      subjectTag: "Biology",
      materialType: "exemplar",
      gradeAchieved: "A*",
      exemplarPermission: false,
    });
    expect(validateDraftNoteKindsForSubmit(kinds)).toContain(
      "Exemplars need the written-permission confirmation.",
    );
    const allowed = mergeDraftNoteKinds({
      curriculumTag: "IGCSE",
      subjectTag: "Biology",
      materialType: "exemplar",
      gradeAchieved: "A*",
      exemplarPermission: true,
    });
    expect(validateDraftNoteKindsForSubmit(allowed)).toEqual([]);
  });
});
