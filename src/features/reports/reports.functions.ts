import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Issue #216: Report button — one report form for a tutor card, a photo, an
 * introduction, and a note (digital_materials listing). The reporter picks a
 * reason; staff work an admin queue; the reported tutor is never told who
 * reported them (reporter identity has NO tutor-facing read path — the RLS
 * policies in 20261011000000_create_reports.sql scope reads to the reporter
 * and to admins only).
 *
 * Design notes:
 *  - Writes go through the CALLER's RLS-scoped client (auth context set from
 *    the Bearer token), so the `reporter_id` in the payload is verified
 *    against `auth.uid()` by the INSERT policy — a client cannot file a
 *    report as someone else.
 *  - The tutor owner is resolved server-side from tutors/digital_materials
 *    with the service-role client (the public tables are anon-readable, but
 *    resolving here keeps one write path and lets us validate the target
 *    exists before inserting).
 *  - "One open report per item per reporter" is enforced by the partial
 *    unique index in the migration; a repeat submit surfaces as a friendly
 *    duplicate message instead of a raw 23505.
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
  /** Resolved display label of the reported item (queue-side, admin only). */
  target_label: string | null;
};

export const submitReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        targetType: z.enum(REPORT_TARGET_TYPES),
        targetId: z.string().uuid(),
        reason: z.enum(REPORT_REASONS),
        // Required note when the reason is "other" (mirrors the RLS CHECK).
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
            maybeSingle: () => Promise<{
              data: {
                id?: string;
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
    } else {
      const { data: tutor, error } = await admin
        .from("tutors")
        .select("id, display_name")
        .eq("id", data.targetId)
        .maybeSingle();
      if (error || !tutor) throw new Error("Reported tutor not found.");
      tutorId = tutor.id ?? data.targetId;
      targetLabel = tutor.display_name;
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
 * label resolved. The admin acts (uphold / reject) via resolveReport; upheld
 * contact-details or copyright reports hide the item by unpublishing it
 * there — the tutor restores visibility by editing the content.
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
            limit: (
              n: number,
            ) => Promise<{ data: ReportRow[] | null; error?: { message?: string } }>;
          };
        };
      };
    };
    const { data, error } = await admin
      .from("reports")
      .select("id, target_type, target_id, reason, note, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    // Resolve human-readable labels for the queue (cards, photos and
    // introductions all live on the tutors row; materials carry a title).
    const rows = data ?? [];
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

    return rows.map((row) => ({ ...row, target_label: labels.get(row.target_id) ?? null }));
  });

/**
 * Staff action on a report: mark it upheld or rejected. Upheld reports on a
 * tutor card/photo/introduction hide the tutor card (is_published = false) so
 * the tutor can edit and re-apply; upheld reports on a note unpublish the
 * listing. The tutor is NOT emailed the reporter's name (issue #216).
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
          eq: (col: string, value: string) => Promise<{ error?: { message?: string } }>;
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

    if (data.action === "uphold") {
      // Hide the reported item until the tutor edits it (cards/photos/
      // introductions = the tutors row; notes = the material listing).
      if (report.target_type === "material") {
        const { error } = await admin
          .from("digital_materials")
          .update({ is_published: false })
          .eq("id", report.target_id);
        if (error) throw new Error(error.message || "Failed to hide the note");
      } else if (report.tutor_id) {
        const { error } = await admin
          .from("tutors")
          .update({ is_published: false })
          .eq("id", report.tutor_id);
        if (error) throw new Error(error.message || "Failed to hide the tutor card");
      }
    }

    const { error: updateError } = await admin
      .from("reports")
      .update({
        status: data.action === "uphold" ? "upheld" : "rejected",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", data.reportId);
    if (updateError) throw new Error(updateError.message || "Failed to resolve report");
    return { ok: true };
  });

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
