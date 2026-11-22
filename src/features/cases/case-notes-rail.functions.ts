/**
 * Issue #796 §2.3 (was #744) — notes recommendation rail, server half.
 *
 * Learner-side only: the parent or the student owner of the case. Tutor / Ops /
 * non-parties get `null`, which the case workspace renders as nothing at all.
 *
 * Reads the case's signed-in learner view of: verified-lesson count (the rail
 * stays hidden before the first one), the #767 Super-Drawer tags, the #796 §2.2
 * Mistake Book tags (secondary signal) and a bounded page of published notes.
 * All ranking lives in case-notes-rail-logic.ts.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db } from "@/features/cases/desk-db";
import { completedLessonCount } from "@/features/cases/rating-window";
import { parseDrawerTopics } from "@/features/cases/heatmap-logic";
import type { LessonConfirmRow } from "@/features/cases/case-reviews";
import type { DrawerLogRow } from "@/features/cases/super-drawer/super-drawer-logic";
import {
  PUBLIC_NOTE_TUTOR_JOIN,
  PUBLIC_NOTE_TUTOR_JOIN_V2,
  PUBLIC_SELLER_OR,
} from "@/features/materials/notes.functions";
import {
  buildNotesRail,
  type RailItem,
  type RailNote,
} from "@/features/cases/case-notes-rail-logic";

/** Newest 200 logs / mistake rows and 500 published notes keep the read bounded. */
const MAX_LOGS = 200;
const MAX_MISTAKES = 200;
const MAX_CANDIDATES = 500;

type CaseRow = {
  id: string;
  parent_id: string | null;
  student_id: string | null;
  matched_tutor_id: string | null;
  subjects: string[] | null;
};

type CaseRole = "ops" | "learner" | "tutor";

const LOG_COLUMNS =
  "id, case_id, lesson_id, logged_by, recap_status, topics, pulse, recap, next_lesson_at, created_at, updated_at";

type TutorJoin = {
  display_name: string | null;
  tutor_code: string | null;
  is_published: boolean | null;
  verification_tier: string | null;
  is_community_seller?: boolean | null;
};

type NoteJoinRow = {
  id: string;
  slug: string | null;
  title: string;
  price_hkd: number | string | null;
  cover_image_path: string | null;
  material_type: string;
  subject_tag: string | null;
  topic: string | null;
  tutor_id: string;
  created_at: string;
  search_tags?: unknown;
  preview_image_paths?: unknown;
  tutors: TutorJoin | null;
};

const RAIL_NOTE_COLUMNS =
  "id, slug, title, price_hkd, cover_image_path, material_type, subject_tag, topic, tutor_id, created_at";
/** v2 / rich columns: absent before their migrations land (42703 fallback). */
const RAIL_NOTE_V2_COLUMNS = "search_tags, preview_image_paths";

async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

async function isOps(db: Db, userId: string): Promise<boolean> {
  for (const role of ["staff", "admin", "super_admin"] as const) {
    const { data } = await db.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return true;
  }
  return false;
}

/**
 * Resolve the caller against the case exactly like the heatmap does. null = not
 * a party, and "not a party" and "not a learner" both become an empty payload so
 * an unrelated tutor can never tell "exists" from "forbidden".
 */
async function loadAccess(
  db: Db,
  caseId: string,
  userId: string,
): Promise<{ kase: CaseRow; role: CaseRole } | null> {
  const cases = await selectRows<CaseRow>(
    db,
    "tutoring_cases",
    "id, parent_id, student_id, matched_tutor_id, subjects",
    [{ col: "id", op: "eq", value: caseId }],
  );
  const kase = cases[0];
  if (!kase) return null;

  const studentOwner = kase.student_id
    ? ((
        await selectRows<{ owner_user_id: string | null }>(db, "students", "owner_user_id", [
          { col: "id", op: "eq", value: kase.student_id },
        ])
      )[0]?.owner_user_id ?? null)
    : null;

  const tutorUserId = kase.matched_tutor_id
    ? ((
        await selectRows<{ user_id: string | null }>(db, "tutors", "user_id", [
          { col: "id", op: "eq", value: kase.matched_tutor_id },
        ])
      )[0]?.user_id ?? null)
    : null;

  if (await isOps(db, userId)) return { kase, role: "ops" };
  if (userId === kase.parent_id || userId === studentOwner) return { kase, role: "learner" };
  if (tutorUserId && userId === tutorUserId) return { kase, role: "tutor" };
  return null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

/** Postgres `text[]`/jsonb paths → the first usable cover path, else null. */
function coverPathOf(row: NoteJoinRow): string | null {
  if (typeof row.cover_image_path === "string" && row.cover_image_path) return row.cover_image_path;
  return stringArray(row.preview_image_paths)[0] ?? null;
}

function toRailNote(row: NoteJoinRow): RailNote | null {
  if (typeof row.id !== "string" || !row.id) return null;
  if (typeof row.tutor_id !== "string" || !row.tutor_id) return null;
  const tutor = row.tutors ?? null;
  const price = Number(row.price_hkd ?? 0);
  const displayName =
    typeof tutor?.display_name === "string" && tutor.display_name
      ? tutor.display_name
      : typeof tutor?.tutor_code === "string"
        ? tutor.tutor_code
        : "";
  return {
    id: row.id,
    slug: typeof row.slug === "string" ? row.slug : null,
    title: typeof row.title === "string" ? row.title : "",
    priceHkd: Number.isFinite(price) ? price : 0,
    coverPath: coverPathOf(row),
    materialType: typeof row.material_type === "string" ? row.material_type : "",
    tutorId: row.tutor_id,
    tutorDisplayName: displayName,
    tutorCode: typeof tutor?.tutor_code === "string" ? tutor.tutor_code : "",
    tutorVerified: tutor?.verification_tier === "tier_2_verified",
    subjectTag: typeof row.subject_tag === "string" ? row.subject_tag : null,
    topic: typeof row.topic === "string" ? row.topic : null,
    searchTags: stringArray(row.search_tags),
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
  };
}

/**
 * Newest published candidates. The publish gate the RLS policy would enforce
 * (status='published' AND tutor is a published / community seller) is restated
 * explicitly, mirroring listings.functions.ts, and the v2 columns fall back one
 * migration at a time on 42703.
 */
async function publishedCandidates(db: Db): Promise<RailNote[]> {
  const run = (columns: string, community: boolean) => {
    const base = db
      .from<NoteJoinRow>("digital_materials")
      .select(`${columns}, ${community ? PUBLIC_NOTE_TUTOR_JOIN_V2 : PUBLIC_NOTE_TUTOR_JOIN}`)
      .eq("status", "published");
    return (
      community
        ? base.or(PUBLIC_SELLER_OR, { referencedTable: "tutors" })
        : base.eq("tutors.is_published", true)
    )
      .order("created_at", { ascending: false })
      .limit(MAX_CANDIDATES);
  };

  const variants: [string, boolean][] = [
    [`${RAIL_NOTE_COLUMNS}, ${RAIL_NOTE_V2_COLUMNS}`, true],
    [`${RAIL_NOTE_COLUMNS}, ${RAIL_NOTE_V2_COLUMNS}`, false],
    [RAIL_NOTE_COLUMNS, false],
  ];
  let result = await run(...variants[0]);
  for (const variant of variants.slice(1)) {
    if (result.error?.code !== "42703") break;
    result = await run(...variant);
  }
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []).map(toRailNote).filter((note): note is RailNote => note !== null);
}

export const getCaseNotesRail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ items: RailItem[] } | null> => {
    const db = await adminDb();
    const access = await loadAccess(db, data.caseId, context.userId);
    if (!access || access.role !== "learner") return null;

    // Hidden before the first verified lesson.
    const lessons = await selectRows<LessonConfirmRow>(
      db,
      "case_lessons",
      "status, confirmed_by_parent_at, confirmed_by_tutor_at",
      [{ col: "case_id", op: "eq", value: data.caseId }],
    );
    if (completedLessonCount(lessons) < 1) return null;

    const logRows = await selectRows<DrawerLogRow>(
      db,
      "case_lesson_logs",
      LOG_COLUMNS,
      [{ col: "case_id", op: "eq", value: data.caseId }],
      { col: "created_at", asc: false, limit: MAX_LOGS },
    );
    const logs: DrawerLogRow[] = logRows.map((row) => ({
      ...row,
      topics: parseDrawerTopics(row.topics),
    }));

    const mistakeRows = await selectRows<{ topic_tag: string | null }>(
      db,
      "case_mistakes",
      "topic_tag",
      [{ col: "case_id", op: "eq", value: data.caseId }],
      { col: "created_at", asc: false, limit: MAX_MISTAKES },
    );
    const mistakeTopicTags = mistakeRows
      .map((row) => (row.topic_tag ?? "").trim())
      .filter((tag) => tag.length > 0);

    const subjects = Array.isArray(access.kase.subjects) ? access.kase.subjects : [];
    const items = buildNotesRail({
      logs,
      mistakeTopicTags,
      caseTutorId: access.kase.matched_tutor_id,
      caseSubject: (subjects[0] ?? "").trim() || null,
      notes: await publishedCandidates(db),
    });

    return items ? { items } : null;
  });
