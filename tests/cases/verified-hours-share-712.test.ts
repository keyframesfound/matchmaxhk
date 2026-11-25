import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { statementShareUrl } from "../../src/features/cases/statement-share";

/**
 * #712 AC-3 has two halves that do not need Postgres: the wa.me statement
 * share link, and the shape of the ledger trigger that credits hours the
 * moment both sides confirm. The database behaviour itself is verified
 * against the live project.
 */

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261125120000_issue_712_verified_hours_on_bilateral_confirm.sql",
  ),
  "utf8",
);

describe("statementShareUrl (#712 AC-3 share affordance)", () => {
  it("opens WhatsApp with no recipient so the sender picks the chat", () => {
    const url = statementShareUrl("November statement");
    expect(url).toBe("https://wa.me/?text=November%20statement");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    // No phone segment between the host and the query.
    expect(url).not.toMatch(/wa\.me\/\d/);
  });

  it("round-trips a multi-line summary byte for byte", () => {
    const summary = [
      "Statement 2026-11",
      "Mon 10 Nov, 16:00 · 1.5 hours · HK$525",
      "2 lessons · 2.5 hours · HK$875",
      "Bookkeeping only. Nothing moves money here.",
    ].join("\n");
    const payload = statementShareUrl(summary).slice("https://wa.me/?text=".length);
    expect(decodeURIComponent(payload)).toBe(summary);
  });

  it("escapes the characters that truncate a wa.me prefill", () => {
    const url = statementShareUrl("A & B #1 ? x=1");
    expect(url).not.toContain("&B");
    expect(url).not.toContain("#");
    expect(url).toContain("%26");
    expect(url).toContain("%23");
  });

  it("keeps Cantonese copy intact", () => {
    const url = statementShareUrl("結算摘要 · 2 堂 · 2.5 小時");
    expect(decodeURIComponent(url.slice("https://wa.me/?text=".length))).toBe(
      "結算摘要 · 2 堂 · 2.5 小時",
    );
  });
});

describe("hours ledger credits on bilateral confirm (#712 AC-3)", () => {
  it("is re-runnable: replaces the function and drops the trigger first", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.sync_hours_ledger_from_lesson()",
    );
    expect(migration).toContain("DROP TRIGGER IF EXISTS trg_case_lessons_hours_ledger");
  });

  it("fires on the confirmation stamps, not only on status", () => {
    expect(migration).toMatch(
      /AFTER INSERT OR UPDATE OF status, confirmed_by_parent_at, confirmed_by_tutor_at/,
    );
  });

  it("writes a lesson that is already doubly confirmed straight to verified", () => {
    expect(migration).toContain(
      "NEW.confirmed_by_parent_at IS NOT NULL AND NEW.confirmed_by_tutor_at IS NOT NULL",
    );
    expect(migration).toContain("CASE WHEN _bilateral THEN 'verified_completed'");
    expect(migration).toContain("CASE WHEN _bilateral THEN 'auto'");
  });

  it("promotes only a pending row when the second confirmation arrives late", () => {
    expect(migration).toContain("AND status = 'pending_confirmation';");
    // A dispute is a human decision and a cancelled row stays cancelled.
    expect(migration).not.toMatch(
      /SET status = 'verified_completed'[\s\S]*status <> 'pending_confirmation'/,
    );
    expect(migration).toContain("WHERE public.verified_hours_ledger.status = 'cancelled'");
  });

  it("keeps the untouched lifecycle: cancel on leaving done, never delete", () => {
    expect(migration).toContain("ELSIF _was_done AND NEW.status <> 'done' THEN");
    expect(migration).toContain("SET status = 'cancelled'");
    expect(migration).not.toMatch(/DELETE FROM public\.verified_hours_ledger/);
    expect(migration).not.toMatch(/ALTER TABLE public\.verified_hours_ledger/);
  });
});
