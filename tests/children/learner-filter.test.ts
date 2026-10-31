/**
 * Issue #459 §C: "Who is learning?" pills on /account, plus the §4.4 parent
 * retain toggle — a claimed child whose parent turned off schedule view
 * drops out of the parent's lists.
 */
import { describe, expect, it } from "vitest";

import {
  filterCasesByLearner,
  hiddenChildIds,
  type ChildProfile,
} from "../../src/features/children/children";

const child = (over: Partial<ChildProfile>): ChildProfile => ({
  id: "c1",
  nickname: "Anson",
  school: null,
  curriculum: null,
  gradYear: null,
  status: "managed_by_parent",
  canViewSchedule: true,
  canManageBilling: true,
  ...over,
});

const cases = [
  { id: "a", student_id: "c1", who_for: "my_child" },
  { id: "b", student_id: "c2", who_for: "my_child" },
  { id: "c", student_id: null, who_for: "myself" },
  { id: "d", student_id: null, who_for: null },
];

describe("filterCasesByLearner", () => {
  it("returns everything for All", () => {
    expect(filterCasesByLearner(cases, "all").map((c) => c.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps only self-bookings for Myself", () => {
    expect(filterCasesByLearner(cases, "myself").map((c) => c.id)).toEqual(["c"]);
  });

  it("keeps only that child's cases", () => {
    expect(filterCasesByLearner(cases, "c2").map((c) => c.id)).toEqual(["b"]);
  });

  it("does not mutate the input", () => {
    const copy = [...cases];
    filterCasesByLearner(cases, "c1");
    expect(cases).toEqual(copy);
  });
});

describe("hiddenChildIds", () => {
  it("hides only claimed children with schedule view turned off", () => {
    const ids = hiddenChildIds([
      child({ id: "c1" }),
      child({ id: "c2", status: "claimed_independent", canViewSchedule: false }),
      child({ id: "c3", status: "claimed_independent", canViewSchedule: true }),
      // A managed child is always visible to the managing parent.
      child({ id: "c4", status: "managed_by_parent", canViewSchedule: false }),
    ]);
    expect([...ids]).toEqual(["c2"]);
  });
});
