/**
 * #725 slice 2: account-synced saved searches + new-match alerts.
 *
 * public.saved_searches is owner-RLS; these server fns still scope every
 * read / write to context.userId through the admin client (same pattern as
 * children.functions.ts). The bus drain calls tickSavedSearchAlerts, which
 * matches listings published after each search's watermark, dedupes per
 * (saved search, listing) in saved_search_matches, and emits one
 * `search.match_new` bell event per search per tick.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import type { Db } from "@/features/cases/desk-db";
import {
  caseMatchesSavedSearch,
  tutorMatchesSavedSearch,
  type MatchableCase,
  type MatchableTutor,
} from "@/features/search/saved-search-match";
import { ACCOUNT_SAVED_LIMIT, normalizeSearchParams } from "@/features/search/saved-searches";

export type AccountSavedSearch = {
  id: string;
  scope: "tutors" | "cases" | "notes";
  params: Record<string, string | number | boolean>;
  label: string;
  alertsEnabled: boolean;
  createdAt: string;
};

type SavedRow = {
  id: string;
  account_id: string;
  scope: "tutors" | "cases" | "notes";
  params: Record<string, unknown> | null;
  label: string;
  alerts_enabled: boolean;
  last_checked_at: string;
  created_at: string;
};

const COLS = "id, account_id, scope, params, label, alerts_enabled, last_checked_at, created_at";

async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

function toAccountSearch(row: SavedRow): AccountSavedSearch {
  return {
    id: row.id,
    scope: row.scope,
    params: normalizeSearchParams(row.params ?? {}),
    label: row.label,
    alertsEnabled: row.alerts_enabled,
    createdAt: row.created_at,
  };
}

const ParamValue = z.union([z.string().max(200), z.number(), z.boolean()]);
const SaveInput = z.object({
  scope: z.enum(["tutors", "cases", "notes"]),
  params: z.record(z.string().max(40), ParamValue),
  label: z.string().trim().min(1).max(80),
});

export const listMySavedSearches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountSavedSearch[]> => {
    const db = await adminDb();
    const { data, error } = await db
      .from<SavedRow>("saved_searches")
      .select(COLS)
      .eq("account_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(ACCOUNT_SAVED_LIMIT);
    if (error) throw new Error(error.message);
    return (data ?? []).map(toAccountSearch);
  });

/** Upsert by (account, scope, params); a re-save just refreshes the label. */
export const saveMySearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: boolean; reason?: "limit" }> => {
    const db = await adminDb();
    const params = normalizeSearchParams(data.params);
    if (Object.keys(params).length === 0) return { ok: false };
    const { data: existing } = await db
      .from<{ id: string; params: Record<string, unknown> }>("saved_searches")
      .select("id, params")
      .eq("account_id", context.userId)
      .eq("scope", data.scope)
      .limit(ACCOUNT_SAVED_LIMIT + 5);
    const same = (existing ?? []).find(
      (row) => JSON.stringify(normalizeSearchParams(row.params ?? {})) === JSON.stringify(params),
    );
    if (same) {
      await db.from("saved_searches").update({ label: data.label }).eq("id", same.id);
      return { ok: true };
    }
    const { data: all } = await db
      .from<{ id: string }>("saved_searches")
      .select("id")
      .eq("account_id", context.userId)
      .limit(ACCOUNT_SAVED_LIMIT + 1);
    if ((all ?? []).length >= ACCOUNT_SAVED_LIMIT) return { ok: false, reason: "limit" };
    const { error } = await db.from("saved_searches").insert({
      account_id: context.userId,
      scope: data.scope,
      params,
      label: data.label,
    });
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMySavedSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await adminDb();
    const { error } = await db
      .from("saved_searches")
      .delete()
      .eq("id", data.id)
      .eq("account_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setMySavedSearchAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await adminDb();
    // Re-enabling restarts the watermark so a backlog never floods the bell.
    const patch: Record<string, unknown> = { alerts_enabled: data.enabled };
    if (data.enabled) patch.last_checked_at = new Date().toISOString();
    const { error } = await db
      .from("saved_searches")
      .update(patch)
      .eq("id", data.id)
      .eq("account_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Bus tick: new-match alerts (called from drainInternal)
// ---------------------------------------------------------------------------

/** Each saved search is checked at most this often. */
const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const SEARCHES_PER_TICK = 50;
const CLOSED_CASE_STATUSES = ["matched", "closed", "rejected", "compliance_hold", "released"];

type TutorRow = MatchableTutor & { id: string; user_id: string | null; created_at: string };
type CaseRow = MatchableCase & {
  id: string;
  parent_id: string | null;
  status: string;
  board_published_at: string;
};

function searchUrl(scope: AccountSavedSearch["scope"], params: Record<string, unknown>): string {
  const base = scope === "cases" ? "/tutor-requests" : "/tutors";
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(normalizeSearchParams(params))) {
    query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}

export async function tickSavedSearchAlerts(db: Db, now: Date): Promise<void> {
  const due = new Date(now.getTime() - CHECK_INTERVAL_MS).toISOString();
  const { data: searches, error } = await db
    .from<SavedRow>("saved_searches")
    .select(COLS)
    .eq("alerts_enabled", true)
    .lte("last_checked_at", due)
    .order("last_checked_at", { ascending: true })
    .limit(SEARCHES_PER_TICK);
  // Table missing (pre-migration) or read failure: alerts simply wait.
  if (error || !searches || searches.length === 0) return;

  const oldest = searches.reduce(
    (min, row) => (row.last_checked_at < min ? row.last_checked_at : min),
    searches[0].last_checked_at,
  );
  const wantsTutors = searches.some((row) => row.scope === "tutors");
  const wantsCases = searches.some((row) => row.scope === "cases");

  const tutors: TutorRow[] = wantsTutors
    ? ((
        await db
          .from<TutorRow>("tutors")
          .select(
            "id, user_id, created_at, tutor_code, display_name, subjects, target_students, card_highlights, tutor_status, lesson_mode, stations, gender, verification_tier",
          )
          .eq("is_published", true)
          .gte("created_at", oldest)
          .limit(200)
      ).data ?? [])
    : [];
  const cases: CaseRow[] = wantsCases
    ? (
        (
          await db
            .from<CaseRow>("tutoring_cases")
            .select(
              "id, parent_id, status, board_published_at, case_code, title, subjects, exam_system, district, mode",
            )
            .gte("board_published_at", oldest)
            .limit(200)
        ).data ?? []
      ).filter((row) => !CLOSED_CASE_STATUSES.includes(row.status))
    : [];

  const nowIso = now.toISOString();
  for (const search of searches) {
    const params = search.params ?? {};
    const matches: { id: string; link: string }[] =
      search.scope === "tutors"
        ? tutors
            .filter(
              (tutor) =>
                tutor.created_at >= search.last_checked_at &&
                tutor.user_id !== search.account_id &&
                tutorMatchesSavedSearch(params, tutor),
            )
            .map((tutor) => ({ id: tutor.id, link: `/tutors/${tutor.tutor_code}` }))
        : search.scope === "cases"
          ? cases
              .filter(
                (item) =>
                  item.board_published_at >= search.last_checked_at &&
                  item.parent_id !== search.account_id &&
                  caseMatchesSavedSearch(params, item),
              )
              .map((item) => ({ id: item.id, link: `/tutor-requests/${item.case_code}` }))
          : [];

    // Dedupe: only listings never alerted for this saved search.
    const fresh: { id: string; link: string }[] = [];
    for (const match of matches) {
      const { error: insertError } = await db
        .from("saved_search_matches")
        .insert({ saved_search_id: search.id, entity_id: match.id });
      if (!insertError) fresh.push(match);
    }

    if (fresh.length > 0) {
      const { error: eventError } = await db.from("case_events").insert({
        event_type: "search.match_new",
        source_id: search.id,
        payload: {
          recipient_account_id: search.account_id,
          // Case searches are a tutor's Teaching view, tutor searches Learning.
          context: search.scope === "cases" ? "teaching" : "learning",
          label: search.label,
          count: fresh.length,
          scope: search.scope,
          link: fresh.length === 1 ? fresh[0].link : searchUrl(search.scope, params),
        },
      });
      if (eventError) console.warn("[saved-search] alert not recorded:", eventError.message);
    }

    await db.from("saved_searches").update({ last_checked_at: nowIso }).eq("id", search.id);
  }
}
