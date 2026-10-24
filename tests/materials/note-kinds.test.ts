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
    curriculum: "DSE",
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
      "Type must be notes, mock, exemplar, or flashcards.",
    );
  });

  it("accepts flashcards as a material type (#314)", () => {
    expect(validateNoteKindsForSubmit({ ...clean, materialType: "flashcards" })).toEqual([]);
    expect(validateNoteKindsPartial({ materialType: "flashcards" })).toEqual([]);
    expect(mergeNoteKinds({ materialType: "flashcards" }).materialType).toBe("flashcards");
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

describe("validateNoteKindsForSubmit subject allowlist (#346)", () => {
  const SUBJECT_ERROR = "Subject must be selected from the list for the chosen curriculum.";

  it("accepts a catalog subject for the chosen curriculum", () => {
    expect(
      validateNoteKindsForSubmit({ curriculum: "DSE", subject: "Physics", materialType: "notes" }),
    ).toEqual([]);
    expect(
      validateNoteKindsForSubmit({ curriculum: "IB", subject: "Phys HL", materialType: "notes" }),
    ).toEqual([]);
  });

  it("matches catalog values case-insensitively", () => {
    expect(
      validateNoteKindsForSubmit({ curriculum: "DSE", subject: "physics", materialType: "notes" }),
    ).toEqual([]);
    expect(
      validateNoteKindsForSubmit({
        curriculum: "DSE",
        subject: "  PHYSICS  ",
        materialType: "notes",
      }),
    ).toEqual([]);
  });

  it("rejects contact-like and arbitrary junk subjects", () => {
    for (const junk of [
      "WhatsApp me at 91234567",
      "https://example.com/notes",
      "t.me/somenotes",
      "Totally Not A Real Subject",
    ]) {
      expect(validateNoteKindsForSubmit({ curriculum: "DSE", subject: junk })).toContain(
        SUBJECT_ERROR,
      );
    }
  });

  it("rejects a subject from another curriculum's pool", () => {
    // "Biology" is an IGCSE/DSE subject but not in the IB catalog list.
    expect(validateNoteKindsForSubmit({ curriculum: "IB", subject: "Biology" })).toContain(
      SUBJECT_ERROR,
    );
  });

  it("'Other' falls back to the full catalog pool but still allowlists", () => {
    expect(
      validateNoteKindsForSubmit({
        curriculum: "Other",
        subject: "Physics",
        materialType: "notes",
      }),
    ).toEqual([]);
    expect(validateNoteKindsForSubmit({ curriculum: "Other", subject: "9xxx whatsapp" })).toContain(
      SUBJECT_ERROR,
    );
  });

  it("the note's own stored legacy subject still passes", () => {
    expect(
      validateNoteKindsForSubmit(
        { curriculum: "DSE", subject: "Legacy Free Text", materialType: "notes" },
        "Legacy Free Text",
      ),
    ).toEqual([]);
    expect(
      validateNoteKindsForSubmit(
        { curriculum: "DSE", subject: "legacy free text", materialType: "notes" },
        "Legacy Free Text",
      ),
    ).toEqual([]);
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
    expect(validateNoteKindsPartial({ materialType: "question_bank" })).not.toEqual([]);
    expect(validateNoteKindsPartial({ topic: "x".repeat(NOTE_TOPIC_MAX_LEN + 1) })).not.toEqual([]);
    expect(
      validateNoteKindsPartial({ gradeAchieved: "x".repeat(GRADE_ACHIEVED_MAX_LEN + 1) }),
    ).not.toEqual([]);
  });

  it("allowlists the subject on draft saves when curriculum and subject are present (#346)", () => {
    expect(
      validateNoteKindsPartial({ curriculum: "DSE", subject: "Physics", materialType: "notes" }),
    ).toEqual([]);
    expect(
      validateNoteKindsPartial({ curriculum: "DSE", subject: "physics", materialType: "notes" }),
    ).toEqual([]);
    expect(
      validateNoteKindsPartial({ curriculum: "DSE", subject: "WhatsApp me at 9xxx" }),
    ).toContain("Subject must be selected from the list for the chosen curriculum.");
    expect(validateNoteKindsPartial({ curriculum: "DSE", subject: "91234567" })).toContain(
      "Subject must be selected from the list for the chosen curriculum.",
    );
    // Stored legacy value is exempt; a junk value never is.
    expect(
      validateNoteKindsPartial(
        { curriculum: "DSE", subject: "Legacy Free Text" },
        "Legacy Free Text",
      ),
    ).toEqual([]);
    expect(
      validateNoteKindsPartial(
        { curriculum: "DSE", subject: "WhatsApp me at 9xxx" },
        "Legacy Free Text",
      ),
    ).not.toEqual([]);
    // Subject without a curriculum still allowlists against the FULL
    // catalog (the "Other" fallback) — junk must not land in a partial
    // draft save (#346 review fix).
    expect(validateNoteKindsPartial({ subject: "Physics" })).toEqual([]);
    expect(validateNoteKindsPartial({ subject: "WhatsApp me at 9xxx" })).toContain(
      "Subject must be selected from the list for the chosen curriculum.",
    );
    expect(validateNoteKindsPartial({ subject: "91234567" })).toContain(
      "Subject must be selected from the list for the chosen curriculum.",
    );
  });

  it("blocks the save-then-submit launder path (#346 review fix)", () => {
    // The laundering sequence: a subject-only draft save used to skip the
    // allowlist, then submit accepted the junk via the stored-value
    // exemption. Neither leg may pass now.
    const junk = "WhatsApp me at 91234567";
    // Leg 1: partial draft save with junk subject (no curriculum) fails…
    expect(validateNoteKindsPartial({ subject: junk })).not.toEqual([]);
    // …so the junk never becomes "stored legacy".
    // Leg 2: even if junk were somehow stored, NEW junk cannot hide behind
    // a different stored value, and submit (curriculum present) rejects it.
    expect(validateNoteKindsPartial({ subject: junk }, "Real Legacy Subject")).not.toEqual([]);
    expect(
      validateNoteKindsForSubmit({ curriculum: "DSE", subject: junk, materialType: "notes" }),
    ).toContain("Subject must be selected from the list for the chosen curriculum.");
    // The true legacy re-save stays exempt through both validators.
    const legacy = "Legacy Free Text";
    expect(validateNoteKindsPartial({ subject: legacy }, legacy)).toEqual([]);
    expect(
      validateNoteKindsForSubmit(
        { curriculum: "DSE", subject: legacy, materialType: "notes" },
        legacy,
      ),
    ).toEqual([]);
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
