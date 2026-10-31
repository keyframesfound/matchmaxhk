/**
 * Issue #459 §4.1 / §15.1.1: public @handle picked at signup. Mirrors the
 * DB check (profiles_handle_format) so the form rejects before the round trip.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { HANDLE_MAX, HANDLE_MIN, normalizeHandle } from "../../src/features/auth/handle";

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

describe("normalizeHandle", () => {
  it("lowercases, trims and drops a leading @", () => {
    expect(normalizeHandle("  @Anson_Chan ")).toBe("anson_chan");
  });

  it("accepts the length bounds", () => {
    expect(normalizeHandle("a".repeat(HANDLE_MIN))).toBe("aaa");
    expect(normalizeHandle("a".repeat(HANDLE_MAX))).toHaveLength(HANDLE_MAX);
  });

  it("rejects too short, too long and illegal characters", () => {
    expect(normalizeHandle("ab")).toBeNull();
    expect(normalizeHandle("a".repeat(HANDLE_MAX + 1))).toBeNull();
    expect(normalizeHandle("anson chan")).toBeNull();
    expect(normalizeHandle("anson-chan")).toBeNull();
    expect(normalizeHandle("陳大文")).toBeNull();
    expect(normalizeHandle("")).toBeNull();
  });
});

describe("handle wiring", () => {
  const migration = source(
    "../../supabase/migrations/20261031230000_issue_459_handle_scholar_parent_toggles.sql",
  );

  it("keeps the DB format check in sync with the client rule", () => {
    expect(migration).toContain(`'^[a-z0-9_]{${HANDLE_MIN},${HANDLE_MAX}}$'`);
  });

  it("drops the 2-arg complete_onboarding so no overload is left", () => {
    expect(migration).toContain("DROP FUNCTION IF EXISTS public.complete_onboarding(TEXT, TEXT);");
  });

  it("sends the handle from the onboarding gate", () => {
    const gate = source("../../src/features/auth/OnboardingGate.tsx");
    expect(gate).toContain("_handle:");
  });
});
