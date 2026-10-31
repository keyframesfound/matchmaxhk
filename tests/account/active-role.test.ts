/**
 * Issue #459 slice 1: roles are additive. Switching account type changes
 * profiles.active_role only; it must never delete a parent/tutor role row
 * (the old switch_role / complete_onboarding did, so a tutor who tried
 * "parent" lost tutor access).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { resolveActiveRole } from "../../src/features/auth/active-role";

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

describe("resolveActiveRole", () => {
  it("uses the stored active role when the user still holds it", () => {
    expect(resolveActiveRole("parent", ["parent", "tutor"])).toBe("parent");
    expect(resolveActiveRole("tutor", ["parent", "tutor"])).toBe("tutor");
  });

  it("falls back to tutor when nothing is stored and the user is a tutor", () => {
    expect(resolveActiveRole(null, ["tutor"])).toBe("tutor");
    expect(resolveActiveRole(null, ["parent", "tutor"])).toBe("tutor");
  });

  it("falls back to parent when nothing is stored and the user is not a tutor", () => {
    expect(resolveActiveRole(null, ["parent"])).toBe("parent");
    expect(resolveActiveRole(null, [])).toBe("parent");
  });

  it("ignores a stored tutor role the user no longer holds", () => {
    expect(resolveActiveRole("tutor", ["parent"])).toBe("parent");
  });
});

describe("additive roles migration (#459)", () => {
  const migration = source("../../supabase/migrations/20261031140000_issue_459_additive_roles.sql");

  it("adds profiles.active_role limited to parent/tutor", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS active_role");
    expect(migration).toMatch(/CHECK \(active_role IN \('parent', 'tutor'\)\)/);
  });

  it("never deletes user_roles rows", () => {
    expect(migration).not.toMatch(/DELETE\s+FROM\s+public\.user_roles/i);
  });

  it("redefines both self-serve role functions to set active_role", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.switch_role");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.complete_onboarding");
    expect(migration.match(/SET active_role = /g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
