import { describe, expect, it } from "vitest";

import {
  buildPublicCard,
  cardSummary,
  checkpointWindowOk,
  EDGE_WINDOW_DAYS,
  isPredictedOnlyPair,
  MAX_CHECKPOINTS_PER_CASE,
  meetsTenureFloor,
  monthsBetween,
  publicCardEligible,
  PUBLIC_EXAM_WINDOW_DAYS,
  sameScale,
  scaleValueToNumeric,
  sortPublicCards,
  validateNewCheckpoint,
  type Checkpoint,
  type PublicCardCase,
  type PublicCardCheckpointRow,
  type PublicCardMatch,
} from "../../src/features/cases/progress-evidence";

const matches: PublicCardMatch = {
  anonymousShareConsent: true,
  tenure: { completedLessons: 6, daysSinceFirstLesson: 90, verifiedHours: 9 },
  firstLessonAt: "2026-01-15",
  lastLessonAt: "2026-07-01",
};

const cardCase: PublicCardCase = {
  caseId: "11111111-1111-4111-8111-111111111111",
  studentLevel: "S5",
  firstLessonAt: "2026-01-15",
  lastLessonAt: "2026-07-01",
  completedLessons: 6,
  verifiedHours: 9,
  consentAt: "2026-08-01T00:00:00.000Z",
};

const now = new Date("2026-08-15T00:00:00.000Z");

function row(over: Partial<PublicCardCheckpointRow> = {}): PublicCardCheckpointRow {
  return {
    assessmentType: "school_quiz",
    assessedOn: "2026-02-01",
    scaleType: "dse",
    scoreValue: "4",
    label: "",
    verification: "parent_attested",
    ...over,
  };
}

const parentPair: PublicCardCheckpointRow[] = [
  row({ assessmentType: "mock", assessedOn: "2026-06-01", scoreValue: "5*" }),
  row(),
];

const tutorPair: PublicCardCheckpointRow[] = parentPair.map((r) => ({
  ...r,
  verification: "tutor_unconfirmed" as const,
}));

describe("#794 §2.6 public card eligibility", () => {
  it("publishes a parent-attested pair in the native scale", () => {
    const card = buildPublicCard(cardCase, parentPair, now);
    expect(card).not.toBeNull();
    expect(card?.verification).toBe("parent_attested");
    expect(card?.scale).toBe("dse");
    expect(card?.delta).toBe("4 → 5*");
    expect(card?.checkpoints.map((c) => c.value)).toEqual(["4", "5*"]);
    expect(card?.summary).toBe("S5 student · 6 verified lessons (5 mos)");
  });

  it("keeps a tutor-only unconfirmed card private, then publishes on parent confirm", () => {
    expect(buildPublicCard(cardCase, tutorPair, now)).toBeNull();
    expect(
      publicCardEligible(
        tutorPair.map((r) => ({
          type: r.assessmentType,
          scale: r.scaleType,
          value: r.scoreValue,
          month: r.assessedOn.slice(0, 7),
          verification: r.verification,
        })),
        matches,
      ),
    ).toEqual({ publishable: false, reasons: ["unverified"] });

    const confirmed = parentPair.map((r) => ({ ...r, verification: "parent_attested" as const }));
    expect(buildPublicCard(cardCase, confirmed, now)).not.toBeNull();
  });

  it("rejects a second scale on one card (AC-730-5)", () => {
    const existing: Checkpoint[] = [{ type: "mock", scale: "dse", value: "4", month: "2026-02" }];
    expect(
      validateNewCheckpoint(existing, {
        type: "mock",
        scale: "ibdp",
        value: "6",
        month: "2026-06",
      }),
    ).toEqual({ ok: false, reason: "scale_mismatch" });
    expect(sameScale(existing)).toBe(true);
    expect(
      sameScale([...existing, { type: "mock", scale: "ibdp", value: "6", month: "2026-06" }]),
    ).toBe(false);

    const mixed: PublicCardCheckpointRow[] = [
      row(),
      row({ assessedOn: "2026-06-01", scaleType: "ibdp", scoreValue: "6" }),
    ];
    expect(buildPublicCard(cardCase, mixed, now)).toBeNull();
  });

  it("rejects a fifth checkpoint on the same case", () => {
    expect(MAX_CHECKPOINTS_PER_CASE).toBe(4);
    const four: Checkpoint[] = [
      { type: "school_quiz", scale: "dse", value: "3", month: "2025-11" },
      { type: "term_exam", scale: "dse", value: "4", month: "2026-02" },
      { type: "mock", scale: "dse", value: "5", month: "2026-04" },
      { type: "mock", scale: "dse", value: "5*", month: "2026-06" },
    ];
    expect(
      validateNewCheckpoint(four, {
        type: "public_exam",
        scale: "dse",
        value: "5**",
        month: "2026-09",
      }),
    ).toEqual({ ok: false, reason: "checkpoint_limit" });
    expect(
      validateNewCheckpoint(four.slice(0, 3), {
        type: "mock",
        scale: "dse",
        value: "5*",
        month: "2026-06",
      }),
    ).toEqual({ ok: true });
  });

  it("rejects an illegal native value or a malformed month", () => {
    expect(
      validateNewCheckpoint([], { type: "mock", scale: "dse", value: "5***", month: "2026-06" }),
    ).toEqual({ ok: false, reason: "invalid_scale_value" });
    expect(
      validateNewCheckpoint([], { type: "mock", scale: "dse", value: "5*", month: "2026-13" }),
    ).toEqual({ ok: false, reason: "bad_month" });
  });

  it("never publishes a Predicted → Predicted only pair (AC-730-2)", () => {
    const predicted: Checkpoint[] = [
      {
        type: "predicted",
        scale: "alevel",
        value: "B",
        month: "2026-03",
        verification: "parent_attested",
      },
      {
        type: "predicted",
        scale: "alevel",
        value: "A",
        month: "2026-06",
        verification: "parent_attested",
      },
    ];
    expect(isPredictedOnlyPair(predicted)).toBe(true);
    expect(publicCardEligible(predicted, matches)).toEqual({
      publishable: false,
      reasons: ["predicted_only"],
    });
    expect(
      buildPublicCard(
        cardCase,
        [
          row({
            assessmentType: "predicted",
            assessedOn: "2026-03-01",
            scaleType: "alevel",
            scoreValue: "B",
          }),
          row({
            assessmentType: "predicted",
            assessedOn: "2026-06-01",
            scaleType: "alevel",
            scoreValue: "A",
          }),
        ],
        now,
      ),
    ).toBeNull();

    // A real result beside a prediction DOES publish.
    const withResult: Checkpoint[] = [
      {
        type: "predicted",
        scale: "alevel",
        value: "B",
        month: "2026-03",
        verification: "parent_attested",
      },
      {
        type: "public_exam",
        scale: "alevel",
        value: "A",
        month: "2026-06",
        verification: "parent_attested",
      },
    ];
    expect(isPredictedOnlyPair(withResult)).toBe(false);
    expect(publicCardEligible(withResult, matches)).toEqual({ publishable: true });
  });

  it("stays private below the tenure floor and without consent", () => {
    const points: Checkpoint[] = [
      {
        type: "school_quiz",
        scale: "dse",
        value: "4",
        month: "2026-02",
        verification: "parent_attested",
      },
      {
        type: "mock",
        scale: "dse",
        value: "5*",
        month: "2026-06",
        verification: "parent_attested",
      },
    ];
    expect(
      publicCardEligible(points, {
        ...matches,
        tenure: { completedLessons: 3, daysSinceFirstLesson: 29, verifiedHours: 5.5 },
      }),
    ).toEqual({ publishable: false, reasons: ["below_tenure_floor"] });
    expect(
      meetsTenureFloor({ completedLessons: 4, daysSinceFirstLesson: 0, verifiedHours: 0 }),
    ).toBe(true);
    expect(
      meetsTenureFloor({ completedLessons: 0, daysSinceFirstLesson: 30, verifiedHours: 0 }),
    ).toBe(true);
    expect(
      meetsTenureFloor({ completedLessons: 0, daysSinceFirstLesson: 0, verifiedHours: 6 }),
    ).toBe(true);

    expect(publicCardEligible(points, { ...matches, anonymousShareConsent: false })).toEqual({
      publishable: false,
      reasons: ["no_consent"],
    });
    expect(buildPublicCard({ ...cardCase, consentAt: null }, parentPair, now)).toBeNull();
  });

  it("stops a baseline exactly 60 days before Lesson 1 and allows 60, not 61", () => {
    expect(EDGE_WINDOW_DAYS).toBe(60);
    const point: Checkpoint = { type: "school_quiz", scale: "dse", value: "4", month: "2026-01" };
    expect(
      checkpointWindowOk(point, {
        firstLessonAt: "2026-03-02",
        lastLessonAt: null,
        isBaseline: true,
      }),
    ).toBe(true);
    expect(
      checkpointWindowOk(point, {
        firstLessonAt: "2026-03-03",
        lastLessonAt: null,
        isBaseline: true,
      }),
    ).toBe(false);
    // Only the earliest point may precede Lesson 1.
    expect(checkpointWindowOk(point, { firstLessonAt: "2026-03-03", lastLessonAt: null })).toBe(
      true,
    );
  });

  it("bounds a non-exam latest point to 60 days past the last lesson", () => {
    const point: Checkpoint = { type: "term_exam", scale: "dse", value: "5", month: "2026-08" };
    expect(
      checkpointWindowOk(point, { firstLessonAt: "2026-01-15", lastLessonAt: "2026-06-02" }),
    ).toBe(true);
    expect(
      checkpointWindowOk(point, { firstLessonAt: "2026-01-15", lastLessonAt: "2026-06-01" }),
    ).toBe(false);

    expect(
      buildPublicCard(
        { ...cardCase, lastLessonAt: "2026-06-01" },
        [row(), row({ assessmentType: "term_exam", assessedOn: "2026-08-01", scoreValue: "5" })],
        now,
      ),
    ).toBeNull();
  });

  it("allows a public exam up to 120 days after the last lesson, and no further", () => {
    expect(PUBLIC_EXAM_WINDOW_DAYS).toBe(120);
    const exam: Checkpoint = { type: "public_exam", scale: "dse", value: "5**", month: "2026-09" };
    expect(
      checkpointWindowOk(exam, { firstLessonAt: "2026-01-15", lastLessonAt: "2026-05-04" }),
    ).toBe(true);
    expect(
      checkpointWindowOk(exam, { firstLessonAt: "2026-01-15", lastLessonAt: "2026-05-03" }),
    ).toBe(false);

    expect(
      buildPublicCard(
        { ...cardCase, lastLessonAt: "2026-05-04" },
        [
          row(),
          row({ assessmentType: "public_exam", assessedOn: "2026-09-01", scoreValue: "5**" }),
        ],
        now,
      ),
    ).not.toBeNull();
  });

  it("sorts cards by most recent assessed month, not by biggest jump", () => {
    const biggerJump = {
      caseId: "old",
      checkpoints: [
        { type: "mock" as const, scale: "dse" as const, value: "1", month: "2025-06" },
        { type: "mock" as const, scale: "dse" as const, value: "5**", month: "2025-09" },
      ],
      lastLessonAt: "2025-10-01",
    };
    const newer = {
      caseId: "new",
      checkpoints: [
        { type: "mock" as const, scale: "dse" as const, value: "4", month: "2026-04" },
        { type: "mock" as const, scale: "dse" as const, value: "5", month: "2026-05" },
      ],
      lastLessonAt: "2026-05-20",
    };
    expect(sortPublicCards([biggerJump, newer]).map((c) => c.caseId)).toEqual(["new", "old"]);
  });

  it("exposes no student identity, school or proof pointer in the public shape", () => {
    const card = buildPublicCard(cardCase, parentPair, now);
    expect(card).not.toBeNull();
    const keys = Object.keys(card ?? {});
    expect(keys.sort()).toEqual(
      [
        "caseId",
        "checkpoints",
        "delta",
        "disclaimer",
        "lastLessonAt",
        "scale",
        "summary",
        "verification",
      ].sort(),
    );
    for (const checkpoint of card?.checkpoints ?? []) {
      expect(Object.keys(checkpoint).sort()).toEqual(["month", "scale", "type", "value"]);
    }
    const serialised = JSON.stringify(card);
    expect(serialised).not.toMatch(/proof/i);
    expect(serialised).not.toMatch(/school/i);
    expect(serialised).not.toMatch(/student_name|studentName|initials/i);
    expect(card?.disclaimer).toContain("no grade is guaranteed");
  });

  it("stamps level · verified lessons · months and derives the ordinal for ordering only", () => {
    expect(cardSummary({ studentLevel: "S5", completedLessons: 6, months: 4 })).toBe(
      "S5 student · 6 verified lessons (4 mos)",
    );
    expect(cardSummary({ studentLevel: null, completedLessons: 1, months: 1 })).toBe(
      "1 verified lesson (1 mo)",
    );
    expect(monthsBetween("2026-01-15", "2026-07-01")).toBe(5);
    expect(monthsBetween(null, "2026-07-01")).toBe(0);
    expect(scaleValueToNumeric("dse", "5**")).toBe(7);
    expect(scaleValueToNumeric("dse", "5*")).toBe(6);
    expect(scaleValueToNumeric("alevel", "A*")).toBe(6);
    expect(scaleValueToNumeric("percent", "82%")).toBe(82);
  });

  it("returns nothing public for an empty or single-point case", () => {
    expect(buildPublicCard(cardCase, [], now)).toBeNull();
    expect(buildPublicCard(cardCase, [row()], now)).toBeNull();
    expect(
      publicCardEligible(
        [
          {
            type: "mock",
            scale: "dse",
            value: "5",
            month: "2026-06",
            verification: "parent_attested",
          },
        ],
        matches,
      ),
    ).toEqual({ publishable: false, reasons: ["too_few_checkpoints"] });
  });
});
