import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";

/**
 * Issue #216: Report button — one report form for a tutor card, a photo, an
 * introduction, and a note (digital_materials listing). The reporter picks a
 * reason; staff work an admin queue; the reported tutor is never told who
 * reported them (reporter identity has NO tutor-facing read path — the RLS
 * policies in 20261011000000_create_reports.sql scope reads to the reporter
 * and to staff via the admin-gated server fns below).
 *
 * Design notes:
 *  - Writes go through the CALLER's RLS-scoped client (auth context set from
 *    the Bearer token), so the `reporter_id` in the payload is verified
 *    against `auth.uid()` by the INSERT policy — a client cannot file a
 *    report as someone else, and cannot forge `status`/`resolved_at` (the
 *    WITH CHECK in 20261011200000 locks inserts to status = 'open').
 *  - The tutor owner is resolved server-side from tutors/digital_materials
 *    with the service-role client (the public tables are anon-readable, but
 *    resolving here keeps one write path and lets us validate the target
 *    exists before inserting).
 *  - "One open report per item per reporter" is enforced by the partial
 *    unique index in the migration; a repeat submit surfaces as a friendly
 *    duplicate message instead of a raw 23505.
 *  - Cross-target spam throttle: at most MAX_OPEN_REPORTS_PER_HOUR open
 *    reports per reporter (counted server-side with the service-role client
 *    so the caller's RLS own-row read can't be gamed).
 */

export const REPORT_TARGET_TYPES = [
  "tutor_card",
  "tutor_photo",
  "tutor_introduction",
  "material",
] as const;

export const REPORT_REASONS = [
  "contact_details",
  "inappropriate_image",
  "copyright",
  "fake_credentials",
  "not_as_described",
  "harassment",
  "spam",
  "impersonation",
  "other",
] as const;

/** Spam guard: how many OPEN reports one account may have per rolling hour. */
export const MAX_OPEN_REPORTS_PER_HOUR = 5;

/** Second upheld report on the same tutor pauses (unpublishes) the card. */
const UPHELD_REPORTS_TO_PAUSE_CARD = 2;

export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];
export type ReportReason = (typeof REPORT_REASONS)[number];

export type ReportRow = {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  note: string | null;
  status: string;
  created_at: string;
  /** Resolved display label of the reported item (queue-side, staff only). */
  target_label: string | null;
};

/** Staff-side row: adds the reporter identity + email (never tutor-facing). */
export type AdminReportRow = ReportRow & {
  reporter_id: string;
  reporter_email: string | null;
};

export const submitReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) =>
    z
      .object({
        targetType: z.enum(REPORT_TARGET_TYPES),
        targetId: z.string().uuid(),
        reason: z.enum(REPORT_REASONS),
        // Optional context for any reason; required when the reason is
        // "other" (mirrors the RLS CHECK).
        note: z.string().trim().max(1000).optional(),
      })
      .refine((input) => input.reason !== "other" || (input.note?.length ?? 0) > 0, {
        message: "A note is required for the 'other' reason.",
        path: ["note"],
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const client = context.supabase as unknown as {
      from: (table: string) => {
        insert: (row: Record<string, unknown>) => Promise<{
          data: unknown;
          error?: { message?: string; code?: string };
        }>;
      };
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (
            col: string,
            value: string,
          ) => {
            gte: (
              col: string,
              value: string,
            ) => Promise<{
              data: Array<{ id: string }> | null;
              error?: { message?: string };
            }>;
            eq: (
              col: string,
              value: string,
            ) => {
              gte: (
                col: string,
                value: string,
              ) => Promise<{
                data: Array<{ id: string }> | null;
                error?: { message?: string };
              }>;
            };
            maybeSingle: () => Promise<{
              data: {
                id?: string;
                user_id?: string | null;
                tutor_id: string | null;
                title: string | null;
                display_name: string | null;
              } | null;
              error?: { message?: string };
            }>;
          };
        };
      };
    };

    // Resolve + validate the target server-side; also grab the owning tutor
    // (for the "second upheld report pauses the card" rule) and a human label
    // for the admin queue.
    let tutorId: string | null = null;
    let targetLabel: string | null = null;

    if (data.targetType === "material") {
      const { data: material, error } = await admin
        .from("digital_materials")
        .select("tutor_id, title")
        .eq("id", data.targetId)
        .maybeSingle();
      if (error || !material) throw new Error("Reported note not found.");
      tutorId = material.tutor_id;
      targetLabel = material.title;
      // Same self-report rule as cards/photos/introductions: the note's owner
      // reporting their own listing is a support request, not a signal
      // (issue #294 — the owner cannot report themselves).
      const { data: materialOwner } = await admin
        .from("tutors")
        .select("user_id")
        .eq("id", material.tutor_id)
        .maybeSingle();
      if (materialOwner?.user_id && materialOwner.user_id === context.userId) {
        throw new Error("SELF_REPORT");
      }
    } else {
      const { data: tutor, error } = await admin
        .from("tutors")
        .select("id, user_id, display_name")
        .eq("id", data.targetId)
        .maybeSingle();
      if (error || !tutor) throw new Error("Reported tutor not found.");
      // A tutor cannot report their own card/photo/introduction — that is a
      // support request, not a moderation signal (queue noise otherwise).
      if (tutor.user_id && tutor.user_id === context.userId) {
        throw new Error("SELF_REPORT");
      }
      tutorId = tutor.id ?? data.targetId;
      targetLabel = tutor.display_name;
    }

    // Cross-target spam throttle: N open reports per rolling hour, counted
    // with the service-role client (the caller's own-row RLS read would
    // undercount nothing, but keeping the limit server-side means a modified
    // client cannot bypass it).
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentOpenRows } = await admin
      .from("reports")
      .select("id")
      .eq("reporter_id", context.userId)
      .eq("status", "open")
      .gte("created_at", hourAgo);
    if ((recentOpenRows?.length ?? 0) >= MAX_OPEN_REPORTS_PER_HOUR) {
      throw new Error("RATE_LIMITED");
    }

    const { error } = await client.from("reports").insert({
      reporter_id: context.userId,
      target_type: data.targetType,
      target_id: data.targetId,
      tutor_id: tutorId,
      reason: data.reason,
      note: data.note?.trim() ? data.note.trim() : null,
      status: "open",
    });
    if (error) {
      // 23505 = partial unique index (one open report per reporter per item).
      if (error.code === "23505") {
        throw new Error("DUPLICATE_REPORT");
      }
      throw new Error(error.message || "Failed to submit report");
    }
    return { ok: true };
  });

/**
 * Admin queue (staff only). Lists every report newest-first with the target
 * label resolved AND the reporter identity + email — anonymity is
 * tutor-facing only; staff need the reporter to catch serial false reporters
 * and spam. The admin acts (uphold / reject) via resolveReport.
 */
export const listReportsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdminClient(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => {
            limit: (n: number) => Promise<{
              data: Array<ReportRow & { reporter_id: string }> | null;
              error?: { message?: string };
            }>;
          };
        };
      };
    };
    const { data, error } = await admin
      .from("reports")
      .select("id, target_type, target_id, reason, note, status, created_at, reporter_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const rows = data ?? [];

    // Reporter emails via auth.users (service-role read, queue-side only).
    const reporterIds = [...new Set(rows.map((row) => row.reporter_id))];
    const emails = new Map<string, string>();
    if (reporterIds.length > 0) {
      const adminUsers = supabaseAdmin as unknown as {
        auth: {
          admin: {
            listUsers: (opts?: { page?: number; perPage?: number }) => Promise<{
              data?: { users?: Array<{ id: string; email?: string | null }> } | null;
            }>;
          };
        };
      };
      // Batch-fetch the page(s) covering our reporter ids; per-user fetchByIds
      // would be N calls — one paginated sweep is fine at queue volume.
      let page = 1;
      let missing = reporterIds.length;
      while (missing > 0 && page <= 10) {
        const { data: usersData } = await adminUsers.auth.admin.listUsers({
          page,
          perPage: 500,
        });
        const users = usersData?.users ?? [];
        if (users.length === 0) break;
        for (const user of users) {
          if (reporterIds.includes(user.id) && user.email) {
            emails.set(user.id, user.email);
            missing -= 1;
          }
        }
        page += 1;
      }
    }

    // Resolve human-readable labels for the queue (cards, photos and
    // introductions all live on the tutors row; materials carry a title).
    const tutorIds = [
      ...new Set(rows.filter((row) => row.target_type !== "material").map((row) => row.target_id)),
    ];
    const materialIds = [
      ...new Set(rows.filter((row) => row.target_type === "material").map((row) => row.target_id)),
    ];

    const admin2 = supabaseAdmin as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          in: (
            col: string,
            values: string[],
          ) => Promise<{
            data: Array<{ id: string; display_name: string | null; title: string | null }> | null;
            error?: { message?: string };
          }>;
        };
      };
    };

    const labels = new Map<string, string>();
    if (tutorIds.length > 0) {
      const { data: tutors } = await admin2
        .from("tutors")
        .select("id, display_name")
        .in("id", tutorIds);
      for (const tutor of tutors ?? []) {
        labels.set(tutor.id, tutor.display_name ?? "Tutor");
      }
    }
    if (materialIds.length > 0) {
      const { data: materials } = await admin2
        .from("digital_materials")
        .select("id, title")
        .in("id", materialIds);
      for (const material of materials ?? []) {
        labels.set(material.id, material.title ?? "Note");
      }
    }

    return rows.map((row) => ({
      ...row,
      target_label: labels.get(row.target_id) ?? null,
      reporter_email: emails.get(row.reporter_id) ?? null,
    })) satisfies AdminReportRow[];
  });

/**
 * Staff action on a report: mark it upheld or rejected. The update is gated
 * on `status = 'open'` so concurrent staff clicks cannot both "succeed" —
 * the loser matches zero rows and reports already-resolved.
 *
 * Upheld reports hide the reported item until the tutor edits it (cards/
 * photos/introductions = the tutors row; notes = the material listing), and
 * the SECOND upheld report on the same tutor pauses the card (issue #216) —
 * both rules unpublish via is_published, so "pause" and "hide" share one
 * mechanism today; the count is surfaced in the queue. The tutor is NOT
 * emailed the reporter's name.
 */
export const resolveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        reportId: z.string().uuid(),
        action: z.enum(["uphold", "reject"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    assertAdminClient(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const admin = supabaseAdmin as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (
            col: string,
            value: string,
          ) => {
            maybeSingle: () => Promise<{
              data: {
                target_type: string;
                target_id: string;
                tutor_id: string | null;
                status: string;
              } | null;
              error?: { message?: string };
            }>;
          };
        };
        update: (patch: Record<string, unknown>) => {
          eq: (
            col: string,
            value: string,
          ) => {
            eq: (
              col: string,
              value: string,
            ) => Promise<{
              count: number | null;
              error?: { message?: string } | null;
            }>;
            maybeSingle: () => Promise<{
              data: unknown;
              error?: { message?: string } | null;
            }>;
          } & {
            then: PromiseLike<{ error?: { message?: string } | null }>["then"];
          };
        };
      };
    };

    const { data: report, error: fetchError } = await admin
      .from("reports")
      .select("target_type, target_id, tutor_id, status")
      .eq("id", data.reportId)
      .maybeSingle();
    if (fetchError || !report) throw new Error("Report not found");
    if (report.status !== "open") throw new Error("Report already resolved");

    let pausedByThreshold = false;

    if (data.action === "uphold") {
      // Hide the reported item until the tutor edits it (cards/photos/
      // introductions = the tutors row; notes = the material listing).
      if (report.target_type === "material") {
        const { error } = (await admin
          .from("digital_materials")
          .update({ is_published: false })
          .eq("id", report.target_id)) as { error?: { message?: string } | null };
        if (error) throw new Error(error.message || "Failed to hide the note");
      } else if (report.tutor_id) {
        const { error } = (await admin
          .from("tutors")
          .update({ is_published: false })
          .eq("id", report.tutor_id)) as { error?: { message?: string } | null };
        if (error) throw new Error(error.message || "Failed to hide the tutor card");

        // "A second upheld report on the same tutor pauses the card" — the
        // unpublish above IS the pause (tutors have no separate paused state;
        // is_published = false removes the card from /tutors and the profile
        // from public view until the tutor edits and re-publishes). The count
        // decides whether this uphold crossed the threshold, so the queue can
        // show staff a "CARD PAUSED (2nd upheld)" flag.
        pausedByThreshold =
          (await countUpheldReports(report.tutor_id)) >= UPHELD_REPORTS_TO_PAUSE_CARD;
      }
    }

    // Optimistic concurrency: the WHERE carries status = 'open', so a
    // concurrent resolution wins and ours matches zero rows.
    const { count: updated, error: updateError } = await admin
      .from("reports")
      .update({
        status: data.action === "uphold" ? "upheld" : "rejected",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", data.reportId)
      .eq("status", "open");
    if (updateError) throw new Error(updateError.message || "Failed to resolve report");
    if ((updated ?? 0) === 0) throw new Error("Report already resolved");
    return { ok: true, cardPaused: pausedByThreshold };
  });

/** Upheld-report count for one tutor (uses idx_reports_tutor_upheld). */
async function countUpheldReports(tutorId: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as {
    from: (table: string) => {
      select: (
        cols: string,
        opts?: { count?: "exact"; head?: boolean },
      ) => {
        eq: (
          col: string,
          value: string,
        ) => {
          eq: (col: string, value: string) => Promise<{ count: number | null }>;
        };
      };
    };
  };
  const { count } = (await admin
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("tutor_id", tutorId)
    .eq("status", "upheld")) as unknown as { count: number | null };
  return count ?? 0;
}

/** Shared has_role gate (admin | super_admin), same pattern as r2.functions. */
async function assertAdminClient(context: { userId: string; supabase: unknown }) {
  const client = context.supabase as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error?: { message?: string } }>;
  };
  for (const role of ["admin", "super_admin"] as const) {
    const { data, error } = await client.rpc("has_role", {
      _user_id: context.userId,
      _role: role,
    });
    if (!error && data === true) return;
  }
  throw new Error("Forbidden");
}
