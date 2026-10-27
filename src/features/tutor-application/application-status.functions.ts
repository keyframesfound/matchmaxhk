/**
 * Issue #477: read-only applicant status, server side.
 *
 * Plain live read on every call (no caching layer): the admin join-requests
 * desk and the publish RPC write `tutor_applications.status` /
 * `linked_tutor_id`, and this fn re-reads the same row so an admin change
 * shows on the applicant's next view. The table has no user_id column and
 * its RLS is admin-only (20260913000000), so the service-role client
 * resolves the caller two ways and takes the newest row:
 *   1. claimed card — tutors.user_id = auth uid → application by
 *      linked_tutor_id (the /account/claim flow links the account);
 *   2. application email — the /join submit stores the applicant's email in
 *      the jsonb blob; matched in SQL via the email_lower generated column
 *      (idx_tutor_applications_email_lower, 20261026132000).
 * NEEDS_INFO: no live field exists on the row (read-only archive since
 * #310), so needsInfoItems is [] today; the checklist renders only from
 * live items, never generic copy. Open question for Ryan in the PR body.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { getApplicationStage } from "@/features/tutor-application/application-status";

export type MyApplicationStatus = {
  applicationId: string;
  /** Raw tutor_application_status enum value. */
  status: "pending" | "accepted" | "rejected";
  stage: ReturnType<typeof getApplicationStage>;
  linkedTutorId: string | null;
  /** Tutor card published from this application, when it exists. */
  tutorCode: string | null;
  /** #358 semantics: the linked card exists AND is currently published. */
  cardLive: boolean;
  submittedAt: string | null;
  updatedAt: string | null;
  /** Exact missing items from live data; always [] until a field exists. */
  needsInfoItems: string[];
};

function getUserEmail(context: { claims: unknown }): string {
  const email = (context.claims as { email?: string } | undefined)?.email;
  return (email ?? "").trim().toLowerCase();
}

export const getMyApplicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyApplicationStatus | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const userId = context.userId;
    const email = getUserEmail(context);

    // Claimed-card path first (strongest signal), then the email path; the
    // newest application wins so a resubmit supersedes an older row (#310
    // same-email resubmit reuses the live card, but the rows keep history).
    type AppRow = {
      id: string;
      status: string;
      linked_tutor_id: string | null;
      created_at: string;
      updated_at: string;
    };

    let rows: AppRow[] = [];

    const { data: tutors } = await db
      .from<{ id: string }>("tutors")
      .select("id")
      .eq("user_id", userId)
      .limit(1);
    const tutor = (tutors ?? [])[0];
    if (tutor) {
      const { data } = await db
        .from<AppRow>("tutor_applications")
        .select("id, status, linked_tutor_id, created_at, updated_at")
        .eq("linked_tutor_id", tutor.id)
        .order("created_at", { ascending: false })
        .limit(1);
      rows = data ?? [];
    }

    if (rows.length === 0 && email) {
      // SQL-side filter on the indexed email_lower generated column
      // (20261026132000). The old read pulled the 500 newest rows and
      // filtered in Node, so an applicant silently vanished from the panel
      // once 500 newer applications existed.
      const { data } = await db
        .from<AppRow>("tutor_applications")
        .select("id, status, linked_tutor_id, created_at, updated_at")
        .eq("email_lower", email)
        .order("created_at", { ascending: false })
        .limit(1);
      rows = data ?? [];
    }

    const row = rows[0];
    if (!row) return null;

    // Resolve the linked card in one extra query (linked_tutor_id has no
    // PostgREST-embeddable FK, same as the admin archive read).
    let tutorCode: string | null = null;
    let cardLive = false;
    if (row.linked_tutor_id) {
      const { data: tutors } = await db
        .from<{ id: string; tutor_code: string | null; is_published: boolean | null }>("tutors")
        .select("id, tutor_code, is_published")
        .eq("id", row.linked_tutor_id)
        .limit(1);
      const tutor = (tutors ?? [])[0];
      if (tutor) {
        tutorCode = tutor.tutor_code ?? null;
        cardLive = tutor.is_published === true;
      }
    }

    const status = (["pending", "accepted", "rejected"] as const).includes(row.status as never)
      ? (row.status as "pending" | "accepted" | "rejected")
      : "pending";

    return {
      applicationId: row.id,
      status,
      stage: getApplicationStage({
        status,
        linkedTutorId: row.linked_tutor_id,
        needsInfoItems: [],
      }),
      linkedTutorId: row.linked_tutor_id,
      tutorCode,
      cardLive,
      submittedAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
      needsInfoItems: [],
    };
  });
