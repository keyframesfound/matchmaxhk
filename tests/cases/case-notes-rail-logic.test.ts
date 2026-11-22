import { describe, expect, it } from "vitest";

import { buildNotesRail, type RailNote } from "../../src/features/cases/case-notes-rail-logic";
import type {
  DrawerLogRow,
  DrawerTopic,
} from "../../src/features/cases/super-drawer/super-drawer-logic";

const OWN = "tutor-own";
const PEER = "tutor-peer";

/** Minimal DrawerLogRow; the rail only reads created_at order + topics. */
function log(createdAt: string, topics: DrawerTopic[]): DrawerLogRow {
  return {
    id: `log-${createdAt}`,
    case_id: "case-1",
    lesson_id: `lesson-${createdAt}`,
    logged_by: "tutor-user-1",
    recap_status: topics.length > 0 ? "complete" : "incomplete",
    topics,
    pulse: {},
    recap: null,
    next_lesson_at: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function note(overrides: Partial<RailNote> & { id: string }): RailNote {
  return {
    slug: overrides.id,
    title: `Note ${overrides.id}`,
    priceHkd: 120,
    coverPath: null,
    materialType: "notes",
    tutorId: OWN,
    tutorDisplayName: "Tutor",
    tutorCode: "TUT1",
    tutorVerified: true,
    subjectTag: null,
    topic: null,
    searchTags: [],
    createdAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

const ids = (items: ReturnType<typeof buildNotesRail>) => (items ?? []).map((item) => item.id);

describe("Case notes rail (#796 §2.3) — pure ranking", () => {
  it("puts the own tutor's exact match ahead of a peer's", () => {
    const items = buildNotesRail({
      logs: [log("2026-11-10T00:00:00Z", [{ tag: "Algebra", mastery: "weak" }])],
      mistakeTopicTags: [],
      caseTutorId: OWN,
      caseSubject: "Mathematics",
      notes: [
        note({ id: "peer", tutorId: PEER, topic: "Algebra" }),
        note({ id: "own", topic: "Algebra" }),
      ],
    });
    expect(ids(items)).toEqual(["own", "peer"]);
  });

  it("flags only the case tutor's notes as byYourTutor", () => {
    const items = buildNotesRail({
      logs: [log("2026-11-10T00:00:00Z", [{ tag: "Algebra", mastery: "weak" }])],
      mistakeTopicTags: [],
      caseTutorId: OWN,
      caseSubject: null,
      notes: [
        note({ id: "own", topic: "Algebra" }),
        note({ id: "peer", tutorId: PEER, topic: "Algebra" }),
      ],
    });
    expect(items?.map((item) => [item.id, item.byYourTutor])).toEqual([
      ["own", true],
      ["peer", false],
    ]);
  });

  it("orders a weak tag ahead of a mastered tag on the same lesson", () => {
    const items = buildNotesRail({
      logs: [
        log("2026-11-10T00:00:00Z", [
          { tag: "Geometry", mastery: "mastered" },
          { tag: "Algebra", mastery: "weak" },
        ]),
      ],
      mistakeTopicTags: [],
      caseTutorId: OWN,
      caseSubject: null,
      notes: [
        note({ id: "geometry", topic: "Geometry", createdAt: "2026-11-09T00:00:00Z" }),
        note({ id: "algebra", topic: "Algebra", createdAt: "2026-10-01T00:00:00Z" }),
      ],
    });
    expect(ids(items)).toEqual(["algebra", "geometry"]);
  });

  it("prefers practising over mastered even when the mastered note is newer", () => {
    const items = buildNotesRail({
      logs: [
        log("2026-11-10T00:00:00Z", [
          { tag: "Chemistry", mastery: "mastered" },
          { tag: "Biology", mastery: "practicing" },
        ]),
      ],
      mistakeTopicTags: [],
      caseTutorId: OWN,
      caseSubject: null,
      notes: [
        note({ id: "chem", topic: "Chemistry", createdAt: "2026-11-09T00:00:00Z" }),
        note({ id: "bio", topic: "Biology", createdAt: "2026-09-01T00:00:00Z" }),
      ],
    });
    expect(ids(items)).toEqual(["bio", "chem"]);
  });

  it("prefers an earlier weakness over the newest log's mastered tag", () => {
    const items = buildNotesRail({
      logs: [
        log("2026-11-10T00:00:00Z", [{ tag: "Geometry", mastery: "mastered" }]),
        log("2026-11-03T00:00:00Z", [{ tag: "Algebra", mastery: "weak" }]),
      ],
      mistakeTopicTags: [],
      caseTutorId: OWN,
      caseSubject: null,
      notes: [
        note({ id: "geometry", topic: "Geometry", createdAt: "2026-11-09T00:00:00Z" }),
        note({ id: "algebra", topic: "Algebra", createdAt: "2026-10-01T00:00:00Z" }),
      ],
    });
    expect(ids(items)).toEqual(["algebra", "geometry"]);
  });

  it("fills with peer matches only after the own tutor's matches", () => {
    const items = buildNotesRail({
      logs: [log("2026-11-10T00:00:00Z", [{ tag: "Algebra", mastery: "weak" }])],
      mistakeTopicTags: [],
      caseTutorId: OWN,
      caseSubject: null,
      notes: [
        note({
          id: "peer-new",
          tutorId: PEER,
          topic: "Algebra",
          createdAt: "2026-11-09T00:00:00Z",
        }),
        note({ id: "own-1", topic: "Algebra", createdAt: "2026-11-08T00:00:00Z" }),
        note({ id: "own-2", topic: "Algebra", createdAt: "2026-11-07T00:00:00Z" }),
      ],
    });
    expect(ids(items)).toEqual(["own-1", "own-2", "peer-new"]);
  });

  it("caps the rail at three by default and never repeats a note", () => {
    const items = buildNotesRail({
      logs: [log("2026-11-10T00:00:00Z", [{ tag: "Algebra", mastery: "weak" }])],
      mistakeTopicTags: [],
      caseTutorId: OWN,
      caseSubject: null,
      notes: [
        note({
          id: "a",
          topic: "Algebra",
          searchTags: ["algebra"],
          createdAt: "2026-11-05T00:00:00Z",
        }),
        note({ id: "b", topic: "Algebra", createdAt: "2026-11-04T00:00:00Z" }),
        note({ id: "c", topic: "Algebra", createdAt: "2026-11-03T00:00:00Z" }),
        note({ id: "d", topic: "Algebra", createdAt: "2026-11-02T00:00:00Z" }),
      ],
    });
    expect(ids(items)).toEqual(["a", "b", "c"]);
  });

  it("breaks ties on the same tag by newest note first", () => {
    const items = buildNotesRail({
      logs: [log("2026-11-10T00:00:00Z", [{ tag: "Algebra", mastery: "weak" }])],
      mistakeTopicTags: [],
      caseTutorId: OWN,
      caseSubject: null,
      notes: [
        note({ id: "older", topic: "Algebra", createdAt: "2026-10-01T00:00:00Z" }),
        note({ id: "newer", topic: "Algebra", createdAt: "2026-11-09T00:00:00Z" }),
      ],
    });
    expect(ids(items)).toEqual(["newer", "older"]);
  });

  it("falls back to the own tutor's same-subject notes when nothing matches", () => {
    const items = buildNotesRail({
      logs: [log("2026-11-10T00:00:00Z", [{ tag: "Algebra", mastery: "weak" }])],
      mistakeTopicTags: [],
      caseTutorId: OWN,
      caseSubject: "Mathematics",
      notes: [
        note({ id: "subject-new", subjectTag: "Mathematics", createdAt: "2026-11-09T00:00:00Z" }),
        note({ id: "subject-old", subjectTag: "Math", createdAt: "2026-10-01T00:00:00Z" }),
        note({ id: "peer-subject", tutorId: PEER, subjectTag: "Mathematics" }),
      ],
    });
    expect(items?.map((item) => [item.id, item.byYourTutor])).toEqual([
      ["subject-new", true],
      ["subject-old", true],
    ]);
  });

  it("never falls back to another tutor's subject-level notes", () => {
    const items = buildNotesRail({
      logs: [log("2026-11-10T00:00:00Z", [{ tag: "Algebra", mastery: "weak" }])],
      mistakeTopicTags: [],
      caseTutorId: OWN,
      caseSubject: "Mathematics",
      notes: [note({ id: "peer-subject", tutorId: PEER, subjectTag: "Mathematics" })],
    });
    expect(items).toBeNull();
  });

  it("uses Mistake Book tags when no lesson log carries a topic", () => {
    const items = buildNotesRail({
      logs: [log("2026-11-10T00:00:00Z", [])],
      mistakeTopicTags: ["Trigonometry"],
      caseTutorId: OWN,
      caseSubject: null,
      notes: [note({ id: "trig", topic: "Trigonometry" })],
    });
    expect(ids(items)).toEqual(["trig"]);
  });

  it("uses the subject fallback when there are no tags and no mistakes", () => {
    const items = buildNotesRail({
      logs: [],
      mistakeTopicTags: [],
      caseTutorId: OWN,
      caseSubject: "Physics",
      notes: [note({ id: "physics", subjectTag: "Physics" })],
    });
    expect(ids(items)).toEqual(["physics"]);
  });

  it("returns null when there is no case tutor and no exact match", () => {
    const items = buildNotesRail({
      logs: [log("2026-11-10T00:00:00Z", [{ tag: "Algebra", mastery: "weak" }])],
      mistakeTopicTags: [],
      caseTutorId: null,
      caseSubject: "Mathematics",
      notes: [note({ id: "peer-subject", tutorId: PEER, subjectTag: "Mathematics" })],
    });
    expect(items).toBeNull();
  });

  it("skips a hours-only newest log and uses an earlier log's tag", () => {
    const items = buildNotesRail({
      logs: [
        log("2026-11-10T00:00:00Z", []),
        log("2026-11-03T00:00:00Z", [{ tag: "Algebra", mastery: "weak" }]),
      ],
      mistakeTopicTags: [],
      caseTutorId: OWN,
      caseSubject: null,
      notes: [note({ id: "algebra", topic: "Algebra" })],
    });
    expect(ids(items)).toEqual(["algebra"]);
  });

  it("matches tags case- and whitespace-insensitively across topic and search tags", () => {
    const items = buildNotesRail({
      logs: [log("2026-11-10T00:00:00Z", [{ tag: "  ALGEBRA  ", mastery: "weak" }])],
      mistakeTopicTags: [],
      caseTutorId: OWN,
      caseSubject: null,
      notes: [
        note({ id: "topic", topic: " algebra " }),
        note({ id: "search", searchTags: ["AlGeBrA"] }),
        note({ id: "subject", subjectTag: "Algebra " }),
        note({ id: "miss", topic: "Geometry" }),
      ],
    });
    expect(ids(items)).toEqual(["topic", "search", "subject"]);
  });
});
