import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { findContactViolations } from "@/lib/contact-filter";
import { asAdminDb, type AdminDb } from "@/features/materials/storage-helpers";
import {
  anyOrderGrantsNoteAccess,
  REVIEW_COMMENT_MAX,
  summarizeRatings,
  type RatingSummary,
} from "@/features/materials/note-reviews";
import { fetchPublicNoteRows, type PublicNote } from "@/features/materials/notes.functions";

/**
 * Notes upload v2: verified-buyer reviews, saved notes and similar notes.
 * Every read is server-side (service role) with explicit column lists; the
 * missing-table code (42P01) degrades to empty results so the note page
 * keeps rendering before the v2 migration is applied.
 */

const NOTE_KINDS = ["notes", "mock", "exemplar", "flashcards"];

const isMissingTable = (error: { code?: string } | null | undefined) =>
  error?.code === "42P01" || error?.code === "PGRST205";

async function admin(): Promise<AdminDb> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export type NoteReview = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  isMine: boolean;
};

type ReviewRow = {
  id: string;
  buyer_account_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

async function loadReviews(db: AdminDb, materialId: string): Promise<ReviewRow[]> {
  const { data, error } = await db
    .from<ReviewRow>("material_reviews")
    .select("id, buyer_account_id, rating, comment, created_at, updated_at")
    .eq("material_id", materialId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }
  return data ?? [];
}

/** Public: a published note's reviews + rating summary (reviewers stay anonymous). */
export const getNoteReviews = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ materialId: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<{ summary: RatingSummary; reviews: NoteReview[] }> => {
    const db = await admin();
    const { data: material } = await db
      .from<{ status: string }>("digital_materials")
      .select("status")
      .eq("id", data.materialId)
      .maybeSingle();
    if (!material || material.status !== "published") {
      return { summary: summarizeRatings([]), reviews: [] };
    }
    const rows = await loadReviews(db, data.materialId);
    return {
      summary: summarizeRatings(rows.map((r) => r.rating)),
      reviews: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        isMine: false,
      })),
    };
  });

async function buyerHasAccess(db: AdminDb, materialId: string, userId: string) {
  const { data: orders } = await db
    .from<{ id: string; status: string; refund_amount: number | null; gross_hkd: number }>(
      "material_orders",
    )
    .select("id, status, refund_amount, gross_hkd")
    .eq("material_id", materialId)
    .eq("buyer_account_id", userId);
  const list = orders ?? [];
  return { hasAccess: anyOrderGrantsNoteAccess(list), orderId: list[0]?.id ?? null };
}

/** Signed-in: may I review this note, and what did I write before? */
export const getMyNoteReviewState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ materialId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { hasAccess } = await buyerHasAccess(db, data.materialId, context.userId);
    const { data: mine, error } = await db
      .from<ReviewRow>("material_reviews")
      .select("id, buyer_account_id, rating, comment, created_at, updated_at")
      .eq("material_id", data.materialId)
      .eq("buyer_account_id", context.userId)
      .maybeSingle();
    if (error && !isMissingTable(error)) throw new Error(error.message);
    return {
      canReview: hasAccess,
      myReview: mine
        ? { id: mine.id, rating: mine.rating, comment: mine.comment, createdAt: mine.created_at }
        : null,
    };
  });

/** Verified buyers only: create or update their one review for a note. */
export const submitNoteReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) =>
    z
      .object({
        materialId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().trim().max(REVIEW_COMMENT_MAX).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: material } = await db
      .from<{ id: string; tutor_id: string; material_type: string }>("digital_materials")
      .select("id, tutor_id, material_type")
      .eq("id", data.materialId)
      .maybeSingle();
    if (!material || !NOTE_KINDS.includes(material.material_type)) {
      throw new Error("Note not found.");
    }
    const { data: owner } = await db
      .from<{ id: string }>("tutors")
      .select("id")
      .eq("id", material.tutor_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (owner) throw new Error("You cannot review your own note.");

    const { hasAccess, orderId } = await buyerHasAccess(db, material.id, context.userId);
    if (!hasAccess) throw new Error("Only buyers who received this note can rate it.");

    const comment = data.comment?.trim() || null;
    if (comment) {
      const violations = findContactViolations(comment);
      if (violations.length > 0) {
        throw new Error("Remove contact details from your comment to post it.");
      }
    }
    const now = new Date().toISOString();
    const { error } = await db.from<never>("material_reviews").upsert(
      {
        material_id: material.id,
        buyer_account_id: context.userId,
        order_id: orderId,
        rating: data.rating,
        comment,
        updated_at: now,
      },
      { onConflict: "material_id,buyer_account_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Saved notes
// ---------------------------------------------------------------------------

export const getMySavedNoteIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const db = await admin();
    const { data, error } = await db
      .from<{ material_id: string }>("saved_materials")
      .select("material_id")
      .eq("account_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      if (isMissingTable(error)) return [];
      throw new Error(error.message);
    }
    return (data ?? []).map((r) => r.material_id);
  });

export const setNoteSaved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ materialId: z.string().uuid(), saved: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    if (data.saved) {
      const { data: material } = await db
        .from<{ status: string }>("digital_materials")
        .select("status")
        .eq("id", data.materialId)
        .maybeSingle();
      if (!material || material.status !== "published") throw new Error("Note not found.");
      const { error } = await db
        .from<never>("saved_materials")
        .upsert(
          { account_id: context.userId, material_id: data.materialId },
          { onConflict: "account_id,material_id", ignoreDuplicates: true },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db
        .from<never>("saved_materials")
        .delete()
        .eq("account_id", context.userId)
        .eq("material_id", data.materialId);
      if (error) throw new Error(error.message);
    }
    return { saved: data.saved };
  });

// ---------------------------------------------------------------------------
// Similar notes (+ rating summaries for the compare table)
// ---------------------------------------------------------------------------

export type SimilarNote = PublicNote & { rating: RatingSummary };

export function similarityScore(base: PublicNote, other: PublicNote): number {
  const same = (a: string | null | undefined, b: string | null | undefined) =>
    Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
  let score = 0;
  if (same(base.subjectTag, other.subjectTag)) score += 4;
  if (same(base.curriculumTag, other.curriculumTag)) score += 2;
  if (same(base.subcategory, other.subcategory)) score += 2;
  if (same(base.materialType, other.materialType)) score += 1;
  if (same(base.topic, other.topic)) score += 1;
  const baseTags = new Set(base.searchTags.map((t) => t.toLowerCase()));
  score += Math.min(2, other.searchTags.filter((t) => baseTags.has(t.toLowerCase())).length * 0.5);
  return score;
}

export const getSimilarNotes = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ materialId: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<SimilarNote[]> => {
    const db = await admin();
    const baseRows = await fetchPublicNoteRows(db, (q) => q.eq("id", data.materialId).limit(1));
    const base = baseRows[0];
    if (!base) return [];
    const pool = await fetchPublicNoteRows(db, (q) =>
      q
        .in("material_type", NOTE_KINDS)
        .eq("curriculum_tag", base.curriculumTag)
        .neq("id", base.id)
        .order("created_at", { ascending: false })
        .limit(120),
    );
    const ranked = pool
      .map((note) => ({ note, score: similarityScore(base, note) }))
      .filter((r) => r.score >= 3)
      .sort((a, b) => b.score - a.score || b.note.soldCount - a.note.soldCount)
      .slice(0, 6)
      .map((r) => r.note);

    const ratings = new Map<string, number[]>();
    if (ranked.length > 0) {
      const { data: rows, error } = await db
        .from<{ material_id: string; rating: number }>("material_reviews")
        .select("material_id, rating")
        .in("material_id", [base.id, ...ranked.map((n) => n.id)]);
      if (!error) {
        for (const row of rows ?? []) {
          const list = ratings.get(row.material_id) ?? [];
          list.push(row.rating);
          ratings.set(row.material_id, list);
        }
      }
    }
    return ranked.map((note) => ({
      ...note,
      rating: summarizeRatings(ratings.get(note.id) ?? []),
    }));
  });
