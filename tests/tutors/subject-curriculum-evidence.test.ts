import { describe, expect, it } from "vitest";

import { getTutorSubjectGroups } from "../../src/features/tutors/tutor-display";
import type { Tutor } from "../../src/features/tutors/queries";

type SubjectTutor = Pick<Tutor, "subjects" | "exam_results">;

const tutorWith = (
  subjects: string[],
  examResults: SubjectTutor["exam_results"] = [],
): SubjectTutor => ({ subjects, exam_results: examResults });

describe("getTutorSubjectGroups — curriculum claims need evidence (customer report 2026-11-27)", () => {
  it("groups bare multi-system subjects under other when no exam result names the system", () => {
    // A tutor who selected only IB + IGCSE must not see HKDSE / GCE rows.
    const groups = getTutorSubjectGroups(tutorWith(["History", "Music", "Mathematics"]));
    expect(groups.every((group) => group.systemId === "other")).toBe(true);
  });

  it("keeps curriculum grouping when an exam result names the system", () => {
    const groups = getTutorSubjectGroups(
      tutorWith(["History"], [{ system: "dse", subjects: [{ subject: "History" }] }] as never),
    );
    expect(groups).toEqual([{ systemId: "dse", subjects: ["History"] }]);
  });

  it("keeps explicit subject prefixes (e.g. 'IB Biology')", () => {
    const groups = getTutorSubjectGroups(tutorWith(["IB Biology"]));
    expect(groups).toEqual([{ systemId: "ib", subjects: ["Biology"] }]);
  });

  it("keeps curriculum-category subjects under their category", () => {
    const groups = getTutorSubjectGroups(tutorWith(["Personal Statement"]));
    expect(groups[0]?.systemId).not.toBe("other");
  });
});
