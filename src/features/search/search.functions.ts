/**
 * Issue #553 — global search, server half.
 *
 * Reads ONLY public fields from the existing public surfaces (published
 * tutor cards, published notes, the public case board, active centres,
 * public handles) — no parallel search index. Child sub-profiles
 * (students) and their owner accounts never appear; contact fields are
 * never selected. Posts (#549) have no table yet, so that group stays
 * hidden until it ships.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  GROUP_LIMIT,
  QUERY_MAX_LEN,
  canonicalTagUsage,
  normalizeTag,
  parseSearchQuery,
  rankGroup,
  resolveTagAlias,
  scoreEntity,
  suggestTags,
  type ParsedQuery,
  type Scored,
  type TagOverride,
  type TagUsage,
} from "@/features/search/global-search";

const SCAN_LIMIT = 1000;
const ADULT_AGE = 18;
const ADMIN_TAG_LIMIT = 300;
const CLOSED_CASE_STATUSES =
  "(matched,closed,rejected,compliance_hold,failed_trial_pivot,released)";

export const SEARCH_SCOPES = ["all", "tutors", "notes"] as const;
export type SearchScope = (typeof SEARCH_SCOPES)[number];

export type SearchHit = {
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  matchedOn: string[];
  tags: string[];
};

export type SearchGroups = {
  tutors: SearchHit[];
  cases: SearchHit[];
  notes: SearchHit[];
  centres: SearchHit[];
  users: SearchHit[];
};

export type SearchResults = { query: string; tags: string[]; groups: SearchGroups };

type AnyRow = Record<string, unknown>;
type QueryResult = { data: AnyRow[] | null; error: { message: string } | null };
type QueryChain = PromiseLike<QueryResult> & {
  eq: (c: string, v: unknown) => QueryChain;
  not: (c: string, op: string, v: unknown) => QueryChain;
  limit: (n: number) => QueryChain;
};
type SearchDb = {
  from: (t: string) => {
    select: (c: string) => QueryChain;
    upsert: (v: AnyRow, o?: AnyRow) => PromiseLike<{ error: { message: string } | null }>;
  };
};

async function admin(): Promise<SearchDb> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SearchDb;
}

async function rows(chain: QueryChain): Promise<AnyRow[]> {
  const { data, error } = await chain;
  if (error) throw new Error(error.message);
  return data ?? [];
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const flat = (v: unknown): string | null =>
  v == null ? null : typeof v === "string" ? v : JSON.stringify(v);

async function loadOverrides(): Promise<TagOverride[]> {
  const db = await admin();
  try {
    const data = await rows(db.from("search_tag_overrides").select("tag, hidden, merged_into"));
    return data.map((r) => ({
      tag: String(r.tag),
      hidden: r.hidden === true,
      mergedInto: str(r.merged_into),
    }));
  } catch (e) {
    // Table not migrated yet: no overrides, search still works.
    console.error("[search] tag overrides unavailable:", e instanceof Error ? e.message : e);
    return [];
  }
}

/** Entity tags with merge overrides applied, so an alias filter finds the canonical. */
function canonical(tags: readonly string[], overrides: readonly TagOverride[]): string[] {
  return tags.flatMap((t) => {
    const n = normalizeTag(t);
    return n ? [resolveTagAlias(n, overrides)] : [];
  });
}

function isAdult(dob: string | null, now: Date): boolean {
  if (!dob) return true;
  const birth = Date.parse(dob);
  if (!Number.isFinite(birth)) return true;
  const adultAt = new Date(birth);
  adultAt.setUTCFullYear(adultAt.getUTCFullYear() + ADULT_AGE);
  return adultAt.getTime() <= now.getTime();
}

type Ranked = { scored: Scored; hit: SearchHit };

function toHit(scored: Scored | null, base: Omit<SearchHit, "matchedOn">): Ranked[] {
  return scored ? [{ scored, hit: { ...base, matchedOn: scored.matchedOn } }] : [];
}

const finish = (ranked: Ranked[]): SearchHit[] => rankGroup(ranked).map((r) => r.hit);

async function searchTutors(q: ParsedQuery, overrides: TagOverride[]): Promise<SearchHit[]> {
  const db = await admin();
  const data = await rows(
    db
      .from("tutors")
      .select(
        "id, tutor_code, display_name, headline, subjects, secondary_school, undergrad_university, achievements, profile_tags, owner_account_status, card_hidden_by_ban",
      )
      .eq("is_published", true)
      .limit(SCAN_LIMIT),
  );
  return finish(
    data.flatMap((t) => {
      if (t.card_hidden_by_ban === true || t.owner_account_status === "banned") return [];
      const tags = canonical(arr(t.profile_tags), overrides);
      const code = str(t.tutor_code) ?? "";
      return toHit(
        scoreEntity(
          [
            { label: "Code", value: code },
            { label: "Name", value: str(t.display_name) },
            { label: "Subjects", value: arr(t.subjects).join(" ") },
            { label: "Headline", value: str(t.headline) },
            { label: "School", value: str(t.secondary_school) },
            { label: "University", value: str(t.undergrad_university) },
            { label: "Achievements", value: flat(t.achievements) },
          ],
          tags,
          q,
        ),
        {
          id: String(t.id),
          title: str(t.display_name) ?? code,
          subtitle: arr(t.subjects).slice(0, 3).join(" / ") || null,
          href: `/tutors/${code}`,
          tags,
        },
      );
    }),
  );
}

async function searchNotes(q: ParsedQuery, overrides: TagOverride[]): Promise<SearchHit[]> {
  const db = await admin();
  const data = await rows(
    db
      .from("digital_materials")
      .select("id, slug, title, subject_tag, curriculum_tag, topic, search_tags")
      .eq("status", "published")
      .limit(SCAN_LIMIT),
  );
  return finish(
    data.flatMap((m) => {
      const tags = canonical(arr(m.search_tags), overrides);
      return toHit(
        scoreEntity(
          [
            { label: "Title", value: str(m.title) },
            { label: "Subject", value: str(m.subject_tag) },
            { label: "Curriculum", value: str(m.curriculum_tag) },
            { label: "Topic", value: str(m.topic) },
          ],
          tags,
          q,
        ),
        {
          id: String(m.id),
          title: str(m.title) ?? "",
          subtitle: [str(m.curriculum_tag), str(m.subject_tag)].filter(Boolean).join(" · ") || null,
          href: `/notes/${str(m.slug) ?? String(m.id)}`,
          tags,
        },
      );
    }),
  );
}

async function searchCases(q: ParsedQuery, overrides: TagOverride[]): Promise<SearchHit[]> {
  const db = await admin();
  const data = await rows(
    db
      .from("tutoring_cases")
      .select("id, case_code, subjects, exam_system, district, tags")
      .not("board_published_at", "is", null)
      .not("status", "in", CLOSED_CASE_STATUSES)
      .limit(SCAN_LIMIT),
  );
  return finish(
    data.flatMap((c) => {
      const tags = canonical(arr(c.tags), overrides);
      const code = str(c.case_code) ?? "";
      return toHit(
        scoreEntity(
          [
            { label: "Case", value: code },
            { label: "Subjects", value: arr(c.subjects).join(" ") },
            { label: "Curriculum", value: str(c.exam_system) },
            { label: "District", value: str(c.district) },
          ],
          tags,
          q,
        ),
        {
          id: String(c.id),
          // The case title carries the student's name: code + subject only.
          title: [code, arr(c.subjects)[0]].filter(Boolean).join(" · "),
          subtitle: [str(c.exam_system), str(c.district)].filter(Boolean).join(" · ") || null,
          href: `/tutor-requests/${code}`,
          tags,
        },
      );
    }),
  );
}

async function searchCentres(q: ParsedQuery): Promise<SearchHit[]> {
  if (q.keywords.length === 0) return [];
  const db = await admin();
  const data = await rows(
    db
      .from("organizations")
      .select("id, name, slug, tagline, district")
      .eq("status", "active")
      .limit(SCAN_LIMIT),
  );
  return finish(
    data.flatMap((o) =>
      toHit(
        scoreEntity(
          [
            { label: "Name", value: str(o.name) },
            { label: "Slug", value: str(o.slug) },
            { label: "Tagline", value: str(o.tagline) },
          ],
          [],
          { ...q, tags: [] },
        ),
        {
          id: String(o.id),
          title: str(o.name) ?? "",
          subtitle: str(o.district),
          href: `/business/${str(o.slug) ?? ""}`,
          tags: [],
        },
      ),
    ),
  );
}

async function searchUsers(q: ParsedQuery, now: Date): Promise<SearchHit[]> {
  if (q.keywords.length === 0) return [];
  const db = await admin();
  const [profiles, childAccounts] = await Promise.all([
    rows(
      db
        .from("profiles")
        .select("id, handle, display_name, date_of_birth, account_status")
        .not("handle", "is", null)
        .limit(SCAN_LIMIT),
    ),
    rows(db.from("students").select("owner_user_id").not("owner_user_id", "is", null)),
  ]);
  // Child sub-profiles never surface, even once claimed (#553 MUST NOT).
  const childIds = new Set(childAccounts.map((s) => String(s.owner_user_id)));
  return finish(
    profiles.flatMap((p) => {
      if (childIds.has(String(p.id))) return [];
      if (p.account_status && p.account_status !== "active") return [];
      if (!isAdult(str(p.date_of_birth), now)) return [];
      const handle = str(p.handle) ?? "";
      return toHit(
        scoreEntity(
          [
            { label: "Handle", value: handle },
            { label: "Name", value: str(p.display_name) },
          ],
          [],
          { ...q, tags: [] },
        ),
        {
          id: String(p.id),
          title: str(p.display_name) ?? `@${handle}`,
          subtitle: `@${handle}`,
          href: `/u/${handle}`,
          tags: [],
        },
      );
    }),
  );
}

const SearchInput = z.object({
  q: z.string().max(QUERY_MAX_LEN).default(""),
  tags: z.array(z.string().max(40)).max(5).default([]),
  scope: z.enum(SEARCH_SCOPES).default("all"),
});

const EMPTY_GROUPS: SearchGroups = { tutors: [], cases: [], notes: [], centres: [], users: [] };

export const globalSearch = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => SearchInput.parse(input ?? {}))
  .handler(async ({ data }): Promise<SearchResults> => {
    const overrides = await loadOverrides();
    const parsed = parseSearchQuery(data.q, data.tags);
    const q: ParsedQuery = {
      ...parsed,
      tags: parsed.tags.map((t) => resolveTagAlias(t, overrides)),
    };
    if (q.keywords.length === 0 && q.tags.length === 0) {
      return { query: data.q, tags: q.tags, groups: EMPTY_GROUPS };
    }
    const now = new Date();
    const wantTutors = data.scope !== "notes";
    const wantNotes = data.scope !== "tutors";
    const wantOthers = data.scope === "all";
    const [tutors, notes, cases, centres, users] = await Promise.all([
      wantTutors ? searchTutors(q, overrides) : Promise.resolve([]),
      wantNotes ? searchNotes(q, overrides) : Promise.resolve([]),
      wantOthers ? searchCases(q, overrides) : Promise.resolve([]),
      wantOthers ? searchCentres(q) : Promise.resolve([]),
      wantOthers ? searchUsers(q, now) : Promise.resolve([]),
    ]);
    return { query: data.q, tags: q.tags, groups: { tutors, cases, notes, centres, users } };
  });

async function loadTagUsage(): Promise<TagUsage[]> {
  const db = await admin();
  const [notes, tutors, cases] = await Promise.all([
    rows(
      db
        .from("digital_materials")
        .select("search_tags, created_at")
        .eq("status", "published")
        .limit(SCAN_LIMIT),
    ),
    rows(
      db
        .from("tutors")
        .select("profile_tags, updated_at")
        .eq("is_published", true)
        .limit(SCAN_LIMIT),
    ),
    rows(
      db
        .from("tutoring_cases")
        .select("tags, created_at")
        .not("board_published_at", "is", null)
        .not("status", "in", CLOSED_CASE_STATUSES)
        .limit(SCAN_LIMIT),
    ),
  ]);
  const usage = new Map<string, TagUsage>();
  const add = (tags: string[], at: string | null) => {
    for (const raw of tags) {
      const tag = normalizeTag(raw);
      if (!tag) continue;
      const prev = usage.get(tag);
      const last = prev?.lastUsedAt && at && prev.lastUsedAt > at ? prev.lastUsedAt : at;
      usage.set(tag, { tag, count: (prev?.count ?? 0) + 1, lastUsedAt: last ?? null });
    }
  };
  for (const n of notes) add(arr(n.search_tags), str(n.created_at));
  for (const t of tutors) add(arr(t.profile_tags), str(t.updated_at));
  for (const c of cases) add(arr(c.tags), str(c.created_at));
  return [...usage.values()];
}

/** `#` typeahead: ≤8 public tags (never from drafts / private rows). */
export const searchTagTypeahead = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ prefix: z.string().max(40).default("") }).parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<{ tags: string[] }> => {
    const [usage, overrides] = await Promise.all([loadTagUsage(), loadOverrides()]);
    return { tags: suggestTags(canonicalTagUsage(usage, overrides), data.prefix) };
  });

// ---- Admin: hide / merge tags (CEO 2026-11-01) ------------------------------

async function requireStaff(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { asAdminDb } = await import("@/features/materials/storage-helpers");
  const { requireAdmin } = await import("@/features/cases/desk-db");
  await requireAdmin(asAdminDb(supabaseAdmin), userId);
}

export type AdminTagRow = TagUsage & { hidden: boolean; mergedInto: string | null };

export const listSearchTagsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminTagRow[]> => {
    await requireStaff(context.userId);
    const [usage, overrides] = await Promise.all([loadTagUsage(), loadOverrides()]);
    const byTag = new Map(overrides.map((o) => [o.tag, o]));
    return usage
      .map((u) => ({
        ...u,
        hidden: byTag.get(u.tag)?.hidden ?? false,
        mergedInto: byTag.get(u.tag)?.mergedInto ?? null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, ADMIN_TAG_LIMIT);
  });

export const setSearchTagOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tag: z.string().max(40),
        hidden: z.boolean(),
        mergedInto: z.string().max(40).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await requireStaff(context.userId);
    const tag = normalizeTag(data.tag);
    const mergedInto = data.mergedInto ? normalizeTag(data.mergedInto) : null;
    if (!tag) throw new Error("TAG_INVALID");
    if (data.mergedInto && (!mergedInto || mergedInto === tag)) throw new Error("MERGE_INVALID");
    const db = await admin();
    const { error } = await db.from("search_tag_overrides").upsert(
      {
        tag,
        hidden: data.hidden,
        merged_into: mergedInto,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tag" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
