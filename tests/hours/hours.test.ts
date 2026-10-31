/**
 * Issue #459 slice 3: dual-sided verified hours ledger. A lesson marked done
 * becomes a pending ledger row; the parent confirms (or 24h passes) to
 * verify it, or disputes it. Only verified rows count toward public hours.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  AUTO_VERIFY_HOURS,
  DisputeReason,
  canParentReviewHours,
  sumVerifiedHours,
} from "../../src/features/hours/hours";

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

describe("sumVerifiedHours", () => {
  it("only counts verified rows", () => {
    const total = sumVerifiedHours([
      { status: "verified_completed", duration_hours: 1.5 },
      { status: "verified_completed", duration_hours: "2.00" },
      { status: "pending_confirmation", duration_hours: 1 },
      { status: "disputed", duration_hours: 1 },
      { status: "cancelled", duration_hours: 1 },
    ]);
    expect(total).toBe(3.5);
  });

  it("returns 0 for no rows", () => {
    expect(sumVerifiedHours([])).toBe(0);
  });
});

describe("canParentReviewHours", () => {
  const created = new Date("2026-10-31T10:00:00Z");

  it("allows confirm/dispute on a pending row inside the auto-verify window", () => {
    const now = new Date(created.getTime() + (AUTO_VERIFY_HOURS - 1) * 3_600_000);
    expect(
      canParentReviewHours(
        { status: "pending_confirmation", pending_since: created.toISOString() },
        now,
      ),
    ).toBe(true);
  });

  it("closes once the window has passed or the row is no longer pending", () => {
    const late = new Date(created.getTime() + (AUTO_VERIFY_HOURS + 1) * 3_600_000);
    expect(
      canParentReviewHours(
        { status: "pending_confirmation", pending_since: created.toISOString() },
        late,
      ),
    ).toBe(false);
    expect(
      canParentReviewHours(
        { status: "verified_completed", pending_since: created.toISOString() },
        created,
      ),
    ).toBe(false);
    expect(
      canParentReviewHours({ status: "disputed", pending_since: created.toISOString() }, created),
    ).toBe(false);
  });
});

describe("DisputeReason", () => {
  it("requires 3-500 characters after trimming", () => {
    expect(DisputeReason.safeParse("  no ").success).toBe(false);
    expect(DisputeReason.parse("  Lesson did not happen  ")).toBe("Lesson did not happen");
    expect(DisputeReason.safeParse("x".repeat(501)).success).toBe(false);
  });
});

describe("hours ledger migration (#459)", () => {
  const migration = source("../../supabase/migrations/20261031160000_issue_459_hours_ledger.sql");

  it("creates the ledger with one row per lesson", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.verified_hours_ledger");
    expect(migration).toMatch(/case_lesson_id uuid[^,]*UNIQUE/);
    expect(migration).toContain(
      "'pending_confirmation', 'verified_completed', 'disputed', 'cancelled'",
    );
  });

  it("writes rows from case_lessons via trigger and blocks deletes", () => {
    expect(migration).toMatch(
      /CREATE TRIGGER \w+\s+AFTER INSERT OR UPDATE OF status ON public\.case_lessons/,
    );
    expect(migration).toMatch(/BEFORE DELETE ON public\.verified_hours_ledger/);
  });

  it("auto-verifies after 24 hours on a cron schedule", () => {
    expect(migration).toContain("interval '24 hours'");
    expect(migration).toContain("cron.schedule");
  });

  it("stays closed to direct client access", () => {
    expect(migration).not.toMatch(
      /GRANT[^;]*ON public\.verified_hours_ledger[^;]*TO (anon|authenticated)/i,
    );
  });
});
