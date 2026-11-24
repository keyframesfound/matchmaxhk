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
  noteMatchesSavedSearch,
  tutorMatchesSavedSearch,
  type MatchableCase,
  type MatchableNote,
  type MatchableTutor,
} from "@/features/search/saved-search-match";
import { PUBLIC_SELLER_OR } from "@/features/materials/notes.functions";
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

/** A published note plus the publisher (for the no-self-notification check). */
type NoteRow = MatchableNote & {
  id: string;
  reviewed_at: string | null;
  tutor_user_id: string | null;
};

type NoteRaw = MatchableNote & {
  id: string;
  reviewed_at: string | null;
  tutors?: { user_id?: string | null } | { user_id?: string | null }[] | null;
};

const NOTE_COLS =
  "id, slug, reviewed_at, title, description, subject_tag, school_tag, curriculum_tag, price_hkd, material_type, topic";
/** Notes upload v2 columns (absent until the v2 migration is applied). */
const NOTE_V2_COLS = "summary, subcategory, search_tags, content_language, grade_achieved";

function toNoteRow(row: NoteRaw): NoteRow {
  const tutor = Array.isArray(row.tutors) ? row.tutors[0] : row.tutors;
  const text = (value: unknown): string | null => (typeof value === "string" ? value : null);
  return {
    id: String(row.id),
    reviewed_at: text(row.reviewed_at),
    tutor_user_id: text(tutor?.user_id),
    title: typeof row.title === "string" ? row.title : "",
    summary: text(row.summary),
    description: text(row.description),
    subject_tag: text(row.subject_tag),
    school_tag: text(row.school_tag),
    curriculum_tag: typeof row.curriculum_tag === "string" ? row.curriculum_tag : "",
    subcategory: text(row.subcategory),
    content_language: text(row.content_language),
    grade_achieved: text(row.grade_achieved),
    price_hkd: Number(row.price_hkd ?? 0),
    material_type: typeof row.material_type === "string" ? row.material_type : "notes",
    topic: text(row.topic),
    search_tags: Array.isArray(row.search_tags)
      ? row.search_tags.filter((tag): tag is string => typeof tag === "string")
      : null,
    slug: text(row.slug),
  };
}

/**
 * #725: published notes whose publish stamp (reviewed_at — there is no
 * published_at column) landed after the watermark, gated by the same seller
 * rule the public listing uses. 42703 (column not migrated yet) steps back one
 * schema, exactly like fetchMarketplaceMaterials.
 */
async function loadPublishedNotes(db: Db, oldest: string): Promise<NoteRow[]> {
  const run = (columns: string, community: boolean) => {
    const base = db
      .from<NoteRaw>("digital_materials")
      .select(`${columns}, tutors!inner(user_id)`)
      .eq("status", "published")
      .neq("material_type", "gig")
      .gte("reviewed_at", oldest)
      .limit(200);
    return community
      ? base.or(PUBLIC_SELLER_OR, { referencedTable: "tutors" })
      : base.eq("tutors.is_published", true);
  };
  const variants: [string, boolean][] = [
    [`${NOTE_COLS}, ${NOTE_V2_COLS}`, true],
    [`${NOTE_COLS}, ${NOTE_V2_COLS}`, false],
    [NOTE_COLS, false],
  ];
  let result = await run(...variants[0]);
  for (const variant of variants.slice(1)) {
    if (result.error?.code !== "42703") break;
    result = await run(...variant);
  }
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []).map(toNoteRow);
}

/** A notes read must never break the tutor / case alerts; degrade to none. */
async function loadPublishedNotesFailSoft(db: Db, oldest: string): Promise<NoteRow[]> {
  try {
    return await loadPublishedNotes(db, oldest);
  } catch (e) {
    console.warn("[saved-search] notes read failed:", e instanceof Error ? e.message : e);
    return [];
  }
}

function searchUrl(scope: AccountSavedSearch["scope"], params: Record<string, unknown>): string {
  const base = scope === "cases" ? "/tutor-requests" : "/tutors";
  const query = new URLSearchParams();
  // The notes shop lives on the /tutors directory's materials view.
  if (scope === "notes") query.set("view", "materials");
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
  const wantsNotes = searches.some((row) => row.scope === "notes");

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
  const notes: NoteRow[] = wantsNotes ? await loadPublishedNotesFailSoft(db, oldest) : [];

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
          : search.scope === "notes"
            ? notes
                .filter(
                  (note) =>
                    // reviewed_at IS the publish stamp (no published_at column).
                    (note.reviewed_at ?? "") >= search.last_checked_at &&
                    note.tutor_user_id !== search.account_id &&
                    noteMatchesSavedSearch(params, note),
                )
                .map((note) => ({ id: note.id, link: `/notes/${note.slug ?? note.id}` }))
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
          // Case searches are a tutor's Teaching view; tutor + note searches
          // are the Learning side of the bell.
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
