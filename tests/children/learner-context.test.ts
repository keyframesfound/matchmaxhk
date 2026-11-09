import { describe, expect, it } from "vitest";

import {
  learnerFunnelLevel,
  learnerSecondaryBand,
  learnerTier,
  normalizeLearnerCurriculum,
  scoreTutorForLearner,
  type LearnerContext,
} from "../../src/features/children/learner-context";

const ib: LearnerContext = {
  source: "child",
  name: "Lucas",
  level: "y12",
  curriculum: "IB",
  subjects: ["Physics", "Mathematics"],
};
const p4: LearnerContext = {
  source: "child",
  name: "Chloe",
  level: "p4",
  curriculum: "Primary School",
  subjects: ["English"],
};

describe("#698 learner context", () => {
  it("maps grade levels to funnel level, band and tier", () => {
    expect(learnerFunnelLevel("p4")).toBe("Primary");
    expect(learnerFunnelLevel("y12")).toBe("Secondary");
    expect(learnerSecondaryBand("s3")).toBe("Junior secondary");
    expect(learnerSecondaryBand("y10")).toBe("Senior secondary");
    expect(learnerSecondaryBand("p4")).toBeNull();
    expect(learnerTier("kindergarten")).toBe("kindergarten");
    expect(learnerTier("s5")).toBe("primary_secondary");
  });

  it("normalises legacy free-text curricula", () => {
    expect(normalizeLearnerCurriculum("IBDP")).toBe("IB");
    expect(normalizeLearnerCurriculum("HKDSE")).toBe("DSE");
    expect(normalizeLearnerCurriculum("GCE A-Level")).toBe("A-Level");
    expect(normalizeLearnerCurriculum("Local primary")).toBe("Primary School");
    expect(normalizeLearnerCurriculum("")).toBeNull();
  });

  it("ranks the right tutor first for each child", () => {
    const ibTutor = {
      target_students: ["Secondary"],
      subjects: ["IB Physics HL", "IB Math AA HL"],
      card_highlights: ["IBDP 41/45"],
    };
    const primaryTutor = { target_students: ["Primary"], subjects: ["Primary English"] };
    expect(scoreTutorForLearner(ib, ibTutor)).toBeGreaterThan(
      scoreTutorForLearner(ib, primaryTutor),
    );
    expect(scoreTutorForLearner(p4, primaryTutor)).toBeGreaterThan(
      scoreTutorForLearner(p4, ibTutor),
    );
  });

  it("scores 0 with no learner", () => {
    expect(scoreTutorForLearner(null, { target_students: [], subjects: [] })).toBe(0);
  });
});
