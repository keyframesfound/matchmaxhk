import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb, type AdminDb } from "@/features/materials/storage-helpers";
import { planDeliveriesForEvent, type EngagementEventPayload } from "@/features/cases/bus";

/**
 * Issue #726 (like half): Marketplace note likes.
 *
 * Saves already ship end to end; likes are new. Unlike saves (a DB trigger on
 * saved_materials), the like notification is emitted here, from the only write
 * path, because the #726 dedupe rule differs: the anti-spam rule forbids repeat
 * notifications for the SAME saved state, but a toggle-off then toggle-on is a
 * NEW like and may notify the owner once more. The one-row-per-(note, account)
 * unique constraint is the idempotence guarantee for duplicate likes; deleting
 * the row is what makes a later like genuinely new.
 *
 * Privacy: no server fn returns a liker identity — only counts and the caller's
 * own boolean state. Reads are service-role (RLS on material_likes is deny-all).
 */

/** Card grids batch at most 60 note ids per call (one query, no N+1). */
export const NOTE_LIKE_BATCH_MAX = 60;

export type NoteLikeState = { liked: boolean; count: number };
export type NoteLikeCounts = Record<string, number>;
export type NoteLikeToggle = { liked: boolean; count: number };

const isMissingTable = (error: { code?: string } | null | undefined) =>
  error?.code === "42P01" || error?.code === "PGRST205";

async function admin(): Promise<AdminDb> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

/**
 * Auth-optional request user (same shape as channel.functions.ts): the bearer
 * token is resolved when present, and its absence is a guest, not an error.
 */
async function optionalUserId(): Promise<string | null> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const header = getRequest()?.headers?.get("authorization");
    if (!header?.startsWith("Bearer ")) return null;
    const token = header.slice("Bearer ".length).trim();
    if (!token) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.auth.getUser(token);
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pure data helpers (unit-tested in tests/materials/note-likes.test.ts)
// ---------------------------------------------------------------------------

/** Refuse a like on your own note before any write is attempted. */
export function isSelfLike(viewerAccountId: string, ownerAccountId: string | null): boolean {
  return ownerAccountId !== null && ownerAccountId === viewerAccountId;
}

/** Exact like count for one note. Missing table (pre-migration) degrades to 0. */
export async function countNoteLikes(db: AdminDb, materialId: string): Promise<number> {
  const { data, error } = await db
    .from<{ material_id: string }>("material_likes")
    .select("material_id")
    .eq("material_id", materialId);
  if (error) {
    if (isMissingTable(error)) return 0;
    throw new Error(error.message);
  }
  return (data ?? []).length;
}

/**
 * Batch counts for cards: ONE query over the requested ids (deduped, capped at
 * NOTE_LIKE_BATCH_MAX). Every requested id is present in the result — 0 when
 * the note has no likes — so the UI never has to guard for missing keys.
 */
export async function countNoteLikesForMany(
  db: AdminDb,
  materialIds: string[],
): Promise<Map<string, number>> {
  const ids = Array.from(new Set(materialIds)).slice(0, NOTE_LIKE_BATCH_MAX);
  const counts = new Map<string, number>(ids.map((id) => [id, 0]));
  if (ids.length === 0) return counts;
  const { data, error } = await db
    .from<{ material_id: string }>("material_likes")
    .select("material_id")
    .in("material_id", ids);
  if (error) {
    if (isMissingTable(error)) return counts;
    throw new Error(error.message);
  }
  for (const row of data ?? []) {
    counts.set(row.material_id, (counts.get(row.material_id) ?? 0) + 1);
  }
  return counts;
}

/** Does this account currently like this note? */
export async function hasNoteLike(
  db: AdminDb,
  materialId: string,
  accountId: string,
): Promise<boolean> {
  const { data, error } = await db
    .from<{ id: string }>("material_likes")
    .select("id")
    .eq("material_id", materialId)
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) return false;
    throw new Error(error.message);
  }
  return Boolean(data);
}

/** Guest-safe read: a null viewer can never have liked anything. */
export async function readNoteLikeState(
  db: AdminDb,
  materialId: string,
  accountId: string | null,
): Promise<NoteLikeState> {
  const count = await countNoteLikes(db, materialId);
  if (!accountId) return { liked: false, count };
  return { liked: await hasNoteLike(db, materialId, accountId), count };
}

/**
 * Insert or delete exactly one (note, account) row.
 *
 * `changed` is the notification gate: true only when this call actually created
 * or removed a row. A duplicate like (row already present, or a concurrent
 * request that won the unique race with 23505) is a no-op and `changed` is
 * false — no second notification for the same like.
 */
export async function applyNoteLikeToggle(
  db: AdminDb,
  materialId: string,
  accountId: string,
  liked: boolean,
): Promise<NoteLikeToggle & { changed: boolean }> {
  const { data: existing, error: readError } = await db
    .from<{ id: string }>("material_likes")
    .select("id")
    .eq("material_id", materialId)
    .eq("account_id", accountId)
    .maybeSingle();
  if (readError && !isMissingTable(readError)) throw new Error(readError.message);

  let changed = false;
  if (liked) {
    if (!existing) {
      const { error } = await db
        .from<{ id: string }>("material_likes")
        .insert({ material_id: materialId, account_id: accountId });
      // 23505 = a concurrent like won the unique (material_id, account_id)
      // race; the row exists, so this call is a duplicate no-op.
      if (error && error.code !== "23505" && !isMissingTable(error)) {
        throw new Error(error.message);
      }
      changed = !error;
    }
  } else if (existing) {
    const { error } = await db
      .from<{ id: string }>("material_likes")
      .delete()
      .eq("material_id", materialId)
      .eq("account_id", accountId);
    if (error && !isMissingTable(error)) throw new Error(error.message);
    changed = !error;
  }

  return { liked, count: await countNoteLikes(db, materialId), changed };
}

// ---------------------------------------------------------------------------
// Notification planning (pure)
// ---------------------------------------------------------------------------

export type NoteLikeNotifyInput = {
  liked: boolean;
  changed: boolean;
  viewerAccountId: string;
  ownerAccountId: string | null;
  materialId: string;
  label: string;
  slug: string | null;
};

/**
 * Plan the owner-facing like notice. Rides the existing `engagement.saved`
 * event (bell, links, delivery plan already wired) with `entity_type: "material"`
 * and `action: "liked"` so the bell picks like copy, never save copy.
 *
 * Returns null on an unlike, a duplicate like, and a self-like — only a NEW
 * like on someone else's note notifies. The payload is anonymous: recipient,
 * note label and link only, never the liker's account id or role.
 */
export function planNoteLikeNotification(
  input: NoteLikeNotifyInput,
): { eventType: "engagement.saved"; payload: EngagementEventPayload } | null {
  if (!input.liked || !input.changed) return null;
  if (isSelfLike(input.viewerAccountId, input.ownerAccountId)) return null;
  if (!input.ownerAccountId) return null;
  return {
    eventType: "engagement.saved",
    payload: {
      recipient_account_id: input.ownerAccountId,
      // Note owners are tutors; the notice belongs to their Teaching bell.
      context: "teaching",
      entity_type: "material",
      action: "liked",
      label: input.label.slice(0, 80),
      link: `/notes/${input.slug ?? input.materialId}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

type NoteRow = {
  id: string;
  tutor_id: string;
  title: string;
  slug: string | null;
  status: string;
};

async function loadNote(
  db: AdminDb,
  materialId: string,
): Promise<{ note: NoteRow; ownerAccountId: string | null } | null> {
  const { data: note } = await db
    .from<NoteRow>("digital_materials")
    .select("id, tutor_id, title, slug, status")
    .eq("id", materialId)
    .maybeSingle();
  if (!note) return null;
  // Same owner lookup submitNoteReview uses (tutors.user_id owns the listing).
  const { data: owner } = await db
    .from<{ user_id: string | null }>("tutors")
    .select("user_id")
    .eq("id", note.tutor_id)
    .maybeSingle();
  return { note, ownerAccountId: owner?.user_id ?? null };
}

/** Like or unlike a note. Returns the caller's state plus the fresh count. */
export const setNoteLiked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ materialId: z.string().uuid(), liked: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<NoteLikeState> => {
    const db = await admin();
    const loaded = await loadNote(db, data.materialId);
    if (!loaded) throw new Error("Note not found.");
    if (data.liked) {
      if (isSelfLike(context.userId, loaded.ownerAccountId)) {
        throw new Error("SELF_LIKE_FORBIDDEN");
      }
      if (loaded.note.status !== "published") throw new Error("Note not found.");
    }

    const result = await applyNoteLikeToggle(db, data.materialId, context.userId, data.liked);

    if (result.changed && data.liked) {
      const planned = planNoteLikeNotification({
        liked: data.liked,
        changed: result.changed,
        viewerAccountId: context.userId,
        ownerAccountId: loaded.ownerAccountId,
        materialId: data.materialId,
        label: loaded.note.title,
        slug: loaded.note.slug,
      });
      // Advisory: a failed notice must never fail the like itself.
      if (planned && planDeliveriesForEvent(planned.eventType).kind === "deliver") {
        try {
          const { error } = await db.from<never>("case_events").insert({
            event_type: planned.eventType,
            source_table: "material_likes",
            source_id: data.materialId,
            payload: planned.payload,
          });
          if (error) console.warn("[note-likes] like notice not recorded:", error.message);
        } catch (e) {
          console.warn("[note-likes] like notice failed:", e instanceof Error ? e.message : e);
        }
      }
    }

    return { liked: result.liked, count: result.count };
  });

/** Public: my like state (guest ⇒ liked:false) plus the count for this note. */
export const getNoteLikeState = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ materialId: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<NoteLikeState> => {
    const db = await admin();
    return readNoteLikeState(db, data.materialId, await optionalUserId());
  });

/** Public: batch counts for note cards (max 60 ids, one query). */
export const listNoteLikeCounts = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ materialIds: z.array(z.string().uuid()).max(NOTE_LIKE_BATCH_MAX) }).parse(data),
  )
  .handler(async ({ data }): Promise<NoteLikeCounts> => {
    const db = await admin();
    const counts = await countNoteLikesForMany(db, data.materialIds);
    return Object.fromEntries(counts);
  });
