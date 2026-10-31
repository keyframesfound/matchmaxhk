/**
 * Issue #459 slice 2: child sub-profiles. A parent account holds several
 * children (public.students); a case can be linked to one of them so
 * siblings' cases and hours never mix.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CHILD_SOFT_LIMIT,
  ChildInput,
  ownedChildIdOrNull,
  shouldWarnChildCount,
} from "@/features/children/children";

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

describe("ChildInput", () => {
  it("trims the nickname and blanks optional fields to null", () => {
    const parsed = ChildInput.parse({
      nickname: "  Anson ",
      school: "  ",
      curriculum: "",
      gradYear: null,
    });
    expect(parsed).toEqual({ nickname: "Anson", school: null, curriculum: null, gradYear: null });
  });

  it("keeps filled optional fields", () => {
    const parsed = ChildInput.parse({
      nickname: "Bella",
      school: "St. Paul's",
      curriculum: "HKDSE",
      gradYear: 2031,
    });
    expect(parsed).toEqual({
      nickname: "Bella",
      school: "St. Paul's",
      curriculum: "HKDSE",
      gradYear: 2031,
    });
  });

  it("rejects a blank or overlong nickname", () => {
    expect(ChildInput.safeParse({ nickname: "   " }).success).toBe(false);
    expect(ChildInput.safeParse({ nickname: "x".repeat(41) }).success).toBe(false);
  });

  it("rejects a graduation year outside the allowed range", () => {
    expect(ChildInput.safeParse({ nickname: "A", gradYear: 1999 }).success).toBe(false);
    expect(ChildInput.safeParse({ nickname: "A", gradYear: 2101 }).success).toBe(false);
    expect(ChildInput.safeParse({ nickname: "A", gradYear: 2030.5 }).success).toBe(false);
  });
});

describe("shouldWarnChildCount", () => {
  it("only warns once the parent goes past the soft limit (no hard block)", () => {
    expect(CHILD_SOFT_LIMIT).toBe(5);
    expect(shouldWarnChildCount(5)).toBe(false);
    expect(shouldWarnChildCount(6)).toBe(true);
  });
});

describe("ownedChildIdOrNull", () => {
  const owned = [
    { id: "c1", archived_at: null },
    { id: "c2", archived_at: "2026-10-01T00:00:00Z" },
  ];

  it("keeps a child id the parent owns", () => {
    expect(ownedChildIdOrNull("c1", owned)).toBe("c1");
  });

  it("drops an archived child, someone else's child, or no selection", () => {
    expect(ownedChildIdOrNull("c2", owned)).toBeNull();
    expect(ownedChildIdOrNull("other", owned)).toBeNull();
    expect(ownedChildIdOrNull(null, owned)).toBeNull();
    expect(ownedChildIdOrNull(undefined, owned)).toBeNull();
  });
});

describe("submitCaseRequest ownership (#459)", () => {
  const casesFns = source("../../src/lib/cases.functions.ts");
  const start = casesFns.indexOf("export const submitCaseRequest");
  const handler = casesFns.slice(
    start,
    casesFns.indexOf('.from("tutoring_cases")\n      .insert', start),
  );

  it("stamps the submitting account as the case's parent", () => {
    // Before #459 website cases never set parent_id, so "My cases" and the
    // parent-side case actions (ownership-gated on parent_id) never saw them.
    expect(handler).toContain("parent_id: context.userId");
  });

  it("links only a child the parent owns, via ownedChildIdOrNull", () => {
    expect(handler).toContain("ownedChildIdOrNull(");
    expect(handler).toContain("student_id: studentId");
  });
});

describe("child profiles migration (#459)", () => {
  const migration = source("../../supabase/migrations/20261031150000_issue_459_child_profiles.sql");

  it("extends public.students with the sub-profile fields", () => {
    for (const col of ["school", "curriculum", "grad_year", "status", "archived_at"]) {
      expect(migration).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS ${col}\\b`));
    }
    expect(migration).toContain("'managed_by_parent', 'linked_independent', 'claimed_independent'");
  });

  it("links cases to a child without cascading deletes", () => {
    expect(migration).toMatch(
      /ALTER TABLE public\.tutoring_cases[\s\S]*student_id uuid REFERENCES public\.students\(id\) ON DELETE SET NULL/,
    );
  });

  it("keeps students closed to direct client access", () => {
    expect(migration).not.toMatch(/GRANT[^;]*ON public\.students[^;]*TO (anon|authenticated)/i);
  });
});
