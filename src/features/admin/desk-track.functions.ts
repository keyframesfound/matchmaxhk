/**
 * Issue #445 + #448 — server-side gate + storage for the internal tutor desk
 * track. The `tutor_desk_track` table is service-role only (RLS on, ZERO
 * grants to anon/authenticated — the #441 risk_flags posture), so every
 * read/write runs through here:
 *
 *   * getDeskTracks — any staff (staff/admin/super_admin) reads desk rows
 *     for the tutor ids a staff surface is rendering (tutor editor, the
 *     matchmaking shortlist chips). Unknown ids simply come back without a
 *     row; the UI defaults them to `new`.
 *   * setDeskTrack — any staff sets the level, stamps/clears the Guide-sent
 *     marker, nudges the early-L1-drop-off counter, or edits the note. The
 *     counter never goes below zero and the note is capped at 500 chars.
 *
 * Authority is re-checked server-side on every call. Nothing auto-writes a
 * desk row: the only writer is a staff member pressing a control. Desk data
 * is internal CS metadata — soft-prefer only (staff override always), never
 * public, never parent/tutor-facing.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { DROPOFF_NOTE_MAX, toDeskTrackRow, type DeskTrackRow } from "@/features/admin/desk-track";

type Row = Record<string, unknown>;

type HasRoleClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
};

async function hasAnyRole(
  supabase: unknown,
  userId: string,
  roles: readonly string[],
): Promise<boolean> {
  const client = supabase as HasRoleClient;
  for (const role of roles) {
    const { data } = await client.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return true;
  }
  return false;
}

/** Desk track is a CS aid: any staff member (or above) reads and writes. */
async function assertStaff(supabase: unknown, userId: string) {
  if (await hasAnyRole(supabase, userId, ["staff", "admin", "super_admin"])) return;
  throw new Error("Forbidden");
}

export const getDeskTracks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ tutorIds: z.array(z.string().uuid()).min(1).max(200) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<DeskTrackRow[]> => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { data: rows, error } = await db
      .from<Row>("tutor_desk_track")
      .select(
        "tutor_id, tutor_level, guide_sent_at, guide_sent_by, l1_early_dropoffs, dropoff_note, updated_at, updated_by",
      )
      .in("tutor_id", data.tutorIds);
    if (error) throw new Error(error.message ?? "desk track list failed");
    return ((rows ?? []) as Row[]).map(toDeskTrackRow);
  });

const deskPatchSchema = z.object({
  tutorId: z.string().uuid(),
  tutorLevel: z.enum(["new", "active", "experienced"]).optional(),
  /** true stamps guide_sent_at/by now; false clears the stamp. */
  guideSent: z.boolean().optional(),
  /** +1 records an early L1 drop-off, −1 corrects one; floor is 0. */
  dropoffDelta: z.number().int().min(-1).max(1).optional(),
  dropoffNote: z.string().max(DROPOFF_NOTE_MAX).nullable().optional(),
});

export const setDeskTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deskPatchSchema.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true; row: DeskTrackRow }> => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    const { data: currentRows, error: readError } = await db
      .from<Row>("tutor_desk_track")
      .select(
        "tutor_id, tutor_level, guide_sent_at, guide_sent_by, l1_early_dropoffs, dropoff_note, updated_at, updated_by",
      )
      .eq("tutor_id", data.tutorId)
      .limit(1);
    if (readError) throw new Error(readError.message ?? "desk track read failed");
    const current = (currentRows ?? [])[0];

    const patch: Record<string, unknown> = {
      tutor_id: data.tutorId,
      tutor_level:
        data.tutorLevel ?? toDeskTrackRow(current ?? { tutor_id: data.tutorId }).tutor_level,
      l1_early_dropoffs: Math.max(
        0,
        Number(current?.l1_early_dropoffs ?? 0) + (data.dropoffDelta ?? 0),
      ),
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    };
    if (data.guideSent !== undefined) {
      patch.guide_sent_at = data.guideSent ? new Date().toISOString() : null;
      patch.guide_sent_by = data.guideSent ? context.userId : null;
    }
    if (data.dropoffNote !== undefined) patch.dropoff_note = data.dropoffNote;

    const { error } = await db
      .from<Row>("tutor_desk_track")
      .upsert(patch, { onConflict: "tutor_id" });
    if (error) throw new Error(error.message ?? "desk track write failed");

    const { data: saved, error: readBackError } = await db
      .from<Row>("tutor_desk_track")
      .select(
        "tutor_id, tutor_level, guide_sent_at, guide_sent_by, l1_early_dropoffs, dropoff_note, updated_at, updated_by",
      )
      .eq("tutor_id", data.tutorId)
      .limit(1);
    if (readBackError || !saved?.[0]) {
      throw new Error(readBackError?.message ?? "desk track read-back failed");
    }
    return { ok: true, row: toDeskTrackRow(saved[0] as Row) };
  });
