import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hktDateKey } from "@/features/cases/sor";

/**
 * Issue #250 groundwork (stacked on the #131–#134 marketplace MVP):
 * order enforcement + staff grants. This is the minimal slice of #203's
 * "manual cashier" needed by #250's acceptance items — it is NOT the
 * full #203 checkout (no buyer-facing checkout UI, no receipt email,
 * no monthly statement batches) and NOT #201 (no case linkage).
 *
 * Invariants enforced here:
 *   - The private original is only ever signed for a buyer whose order is
 *     `delivered` ("no delivered order, no unlock").
 *   - A staff grant is an order at HK$0: status delivered, tutor_net 0,
 *     is_grant true. The payout export EXCLUDES is_grant rows.
 *   - One order per (material, buyer) — a second checkout or a duplicate
 *     grant is blocked (PK on the unique constraint).
 *   - The buyer never sees the tutor's contact details and the tutor never
 *     sees the buyer's identity (only opaque ids cross these surfaces).
 *
 * All writes go through the service-role client; the material_orders RLS
 * policies are read-only for clients on purpose.
 */

const ADMIN_ROLES = ["admin", "super_admin"] as const;

type HasRoleClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error?: { message?: string } }>;
};

/** Mirrors the pattern used across the branch's admin server functions. */
async function assertAdmin(client: unknown, userId: string): Promise<void> {
  const rpc = (client as HasRoleClient).rpc;
  for (const role of ADMIN_ROLES) {
    const { data: ok, error } = await rpc("has_role", {
      _user_id: userId,
      _role: role,
    });
    if (!error && ok === true) return;
  }
  throw new Error("Forbidden");
}

type OrderRow = {
  id: string;
  material_id: string;
  buyer_account_id: string;
  tutor_id: string;
  gross_hkd: number;
  platform_fee_hkd: number;
  tutor_net_hkd: number;
  status: string;
  is_grant: boolean;
  granted_by: string | null;
  grant_reason: string | null;
  fps_reference: string | null;
  paid_at: string | null;
  delivered_at: string | null;
  delivered_by: string | null;
  created_at: string;
};

type OrdersClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (
        col: string,
        value: string,
      ) => {
        eq: (
          col: string,
          value: string,
        ) => {
          maybeSingle: () => Promise<{
            data: OrderRow | null;
            error?: { message: string } | null;
          }>;
        };
        maybeSingle: () => Promise<{
          data: OrderRow | null;
          error?: { message: string } | null;
        }>;
        limit: (n: number) => Promise<{
          data: OrderRow[] | null;
          error?: { message: string } | null;
        }>;
      };
      or: (expr: string) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => {
          limit: (n: number) => Promise<{
            data: OrderRow[] | null;
            error?: { message: string } | null;
          }>;
        };
      };
    };
    insert: (rows: unknown) => {
      select: (cols: string) => {
        single: () => Promise<{
          data: OrderRow | null;
          error?: { message: string } | null;
        }>;
      };
    };
  };
};

type MaterialsAdminClient = {
  from: (table: string) => {
    select: (cols: string) => {
      in: (
        col: string,
        values: string[],
      ) => {
        eq: (
          col: string,
          value: string,
        ) => Promise<{
          data: Array<{ id: string; tutor_id: string }> | null;
          error?: { message: string } | null;
        }>;
      };
    };
  };
};

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The unlock gate, extracted pure for tests (review blocker 8). A buyer may
 * sign the private original only with a DELIVERED order of their own. The
 * error is deliberately identical for "no order" and "not delivered" so the
 * failure does not leak which packs another account holds.
 */
export function assertOwnedDeliveredOrder(
  order: Pick<OrderRow, "buyer_account_id" | "status"> | null,
  buyerAccountId: string,
): void {
  if (!order || order.buyer_account_id !== buyerAccountId || order.status !== "delivered") {
    throw new Error("This pack is not unlocked for your account.");
  }
}

/** Postgres unique_violation — the structured way to detect re-grants. */
export function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === "23505" || err.message?.includes("duplicate key") === true;
}

/**
 * A staff grant row must be HK$0 across the board and delivered — mirrors
 * the material_orders_grant_zero_money CHECK in the migration so app code
 * and the DB enforce the same invariant.
 */
export function assertValidGrantRow(
  row: Pick<OrderRow, "is_grant" | "gross_hkd" | "platform_fee_hkd" | "tutor_net_hkd" | "status">,
): void {
  if (!row.is_grant) return;
  if (
    Number(row.gross_hkd) !== 0 ||
    Number(row.platform_fee_hkd) !== 0 ||
    Number(row.tutor_net_hkd) !== 0
  ) {
    throw new Error("A grant order must be HK$0 across gross, fee and net.");
  }
  if (row.status !== "delivered") {
    throw new Error("A grant order must be delivered at creation.");
  }
}

/**
 * Parses the export month window: [first day 00:00 HKT, first day of next
 * month 00:00 HKT). Extracted pure for tests (review blocker 8 — the
 * double-pay guard is the money-critical path).
 */
export function parsePayoutMonthWindow(month: string): {
  from: string;
  to: string;
  fromIso: string;
  toIso: string;
} {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("month must be in YYYY-MM format.");
  }
  const [y, m] = month.split("-").map(Number);
  const from = `${month}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const to = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
  return {
    from,
    to,
    fromIso: `${from}T00:00:00+08:00`,
    toIso: `${to}T00:00:00+08:00`,
  };
}

/** CSV column names for the payout export. */
export const PAYOUT_CSV_HEADER = [
  "order_id",
  "delivered_at",
  "tutor_id",
  "tutor",
  "material",
  "gross_hkd",
  "platform_fee_hkd",
  "tutor_net_hkd",
].join(",");

/** One delivered, non-grant payout row as the server fn receives it from Supabase. */
export type PayoutCsvRow = {
  id: string;
  delivered_at: string | null;
  tutor_id: string | null;
  gross_hkd: string | number;
  platform_fee_hkd: string | number;
  tutor_net_hkd: string | number;
  digital_materials?: { title: string | null } | null;
  tutors?: { display_name: string | null } | null;
};

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Assembles the payout CSV from already-filtered rows — extracted pure for
 * tests (review blocker 8: grant rows / out-of-window rows must never appear;
 * the caller owns that filtering, this only renders).
 */
export function buildPayoutCsv(rows: PayoutCsvRow[]): string {
  const lines = rows.map((r) =>
    [
      r.id,
      r.delivered_at ?? "",
      r.tutor_id ?? "",
      csvEscape(r.tutors?.display_name ?? ""),
      csvEscape(r.digital_materials?.title ?? ""),
      money(Number(r.gross_hkd)).toFixed(2),
      money(Number(r.platform_fee_hkd)).toFixed(2),
      money(Number(r.tutor_net_hkd)).toFixed(2),
    ].join(","),
  );
  return [PAYOUT_CSV_HEADER, ...lines].join("\n");
}

/**
 * #250 acceptance: "A buyer cannot unlock a file without a delivered order."
 * Signs the PRIVATE original for the buying account only after checking a
 * delivered order exists. Signed URL expires in 10 minutes (#203). Access
 * lasts while the order stays delivered — there is NO 180-day cutoff in
 * code: refunds revoke access by flipping status away from delivered, and
 * any #203 time-limited access window must be added explicitly later.
 */
export const getOwnedMaterialUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ materialId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error } = await (supabaseAdmin as unknown as OrdersClient)
      .from("material_orders")
      .select("*")
      .eq("material_id", data.materialId)
      .eq("buyer_account_id", context.userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    assertOwnedDeliveredOrder(order, context.userId);

    // Issue #374: buyer downloads sign ONLY the per-order DELIVERED copy —
    // the stamped file staff released (delivered_file_path). No
    // original_file_path fallback: after release the buyer must never read
    // the unstamped original. Gig file_back returns also live in
    // delivered_file_path, so both product kinds unlock through this gate.
    // (Verified 2026-10-18: zero delivered orders existed on live, so no
    // legacy #250-era buyer loses access.)
    const deliveredPath = (order as unknown as { delivered_file_path?: string | null })
      ?.delivered_file_path;
    if (!deliveredPath) {
      // #392: course and folder orders have no per-order stamped copy — the
      // product opens on its own page instead of a file download.
      const { data: mat } = await (
        supabaseAdmin as unknown as {
          from: (t: string) => {
            select: (c: string) => {
              eq: (
                c: string,
                v: string,
              ) => {
                maybeSingle: () => Promise<{
                  data: { material_type: string } | null;
                  error?: { message: string } | null;
                }>;
              };
            };
          };
        }
      )
        .from("digital_materials")
        .select("material_type")
        // assertOwnedDeliveredOrder above guarantees a non-null order.
        .eq("id", (order as { material_id: string }).material_id)
        .maybeSingle();
      if (
        mat?.material_type === "video_course" ||
        mat?.material_type === "general_course" ||
        mat?.material_type === "topic_folder"
      ) {
        throw new Error(
          "This purchase opens on its product page — there is no file download. Open the listing from Account → Bought.",
        );
      }
      throw new Error(
        "The stamped copy is not ready yet — the download unlocks once staff release the file.",
      );
    }

    const pathToSign = deliveredPath;

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("materials-originals")
      .createSignedUrl(pathToSign, 60 * 10); // 10 minutes (#203)
    if (signError || !signed) {
      throw new Error(signError?.message || "Failed to sign URL");
    }
    return { signedUrl: signed.signedUrl };
  });

/**
 * Staff grant (#250 Rule): after three paid lessons staff may grant the
 * parent the tutor's CURRENTLY PUBLISHED packs at HK$0. Implemented as one
 * delivered HK$0 order per pack; packs published later are NOT included
 * (the admin picks packs at grant time). tutor_net is 0 and the rows are
 * excluded from the payout export. Re-granting an existing holder is
 * blocked by the (material_id, buyer_account_id) unique constraint.
 */
export const staffGrantMaterials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        buyerAccountId: z.string().uuid(),
        materialIds: z.array(z.string().uuid()).min(1).max(50),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as MaterialsAdminClient;

    const { data: materials, error } = await admin
      .from("digital_materials")
      .select("id, tutor_id")
      .in("id", data.materialIds)
      .eq("status", "published");
    if (error) throw new Error(error.message);
    const found = new Set((materials ?? []).map((m) => m.id));
    const missing = data.materialIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      // Also fires for an unpublished/unlisted id: the grant covers the
      // packs the tutor has published at this moment, nothing else.
      throw new Error("One or more packs are not published for this tutor.");
    }

    // Current packs only: a pack that stops being published after the grant
    // keeps its delivered order (#203: unpublishing does not remove access),
    // but a pack that is not published right now is not granted.
    const rows = (materials ?? []).map((m) => {
      const row = {
        material_id: m.id,
        buyer_account_id: data.buyerAccountId,
        tutor_id: m.tutor_id,
        gross_hkd: 0,
        platform_fee_hkd: 0,
        tutor_net_hkd: 0,
        status: "delivered",
        is_grant: true,
        granted_by: context.userId,
        grant_reason: data.reason,
        delivered_at: new Date().toISOString(),
        delivered_by: context.userId,
      };
      // Same invariant the migration's CHECK enforces — fail loud if the
      // two ever drift apart.
      assertValidGrantRow(row);
      return row;
    });

    const { data: inserted, error: insertError } = await (
      supabaseAdmin as unknown as {
        from: (t: string) => {
          insert: (rows: unknown) => {
            select: (c: string) => Promise<{
              data: OrderRow[] | null;
              error?: { message: string; code?: string } | null;
            }>;
          };
        };
      }
    )
      .from("material_orders")
      .insert(rows)
      .select("id, material_id");
    if (insertError) {
      // Postgres unique_violation (material_orders_material_buyer_unique):
      // match on the structured code, not message wording.
      if (isUniqueViolation(insertError)) {
        throw new Error("One or more packs are already unlocked for this account.");
      }
      throw new Error(insertError.message);
    }
    return { granted: inserted?.length ?? 0 };
  });

export type PayoutExportRow = {
  order_id: string;
  delivered_at: string;
  tutor_id: string;
  tutor_display_name: string;
  material_title: string;
  gross_hkd: number;
  platform_fee_hkd: number;
  tutor_net_hkd: number;
};

/**
 * #250 acceptance: "A zero-price grant does not appear in the tutor payout
 * export." Exports delivered, NON-grant orders as CSV for the manual
 * monthly payout (#203 Flow step 7 — admin pays by hand). Grant rows are
 * excluded by is_grant, and HK$0 rows by amount, so a grant can never
 * surface via either path.
 *
 * Review blocker fix: `from`/`to` (ISO dates, HKT) bound the export by
 * delivered_at — [from 00:00, to 00:00 next-ish) style half-open window,
 * so re-exporting a prior month cannot silently re-pay rows outside it.
 * A paid_out_at / statement-batch marker so one row can never be paid
 * twice at all is tracked as a #203 follow-up.
 */
export const exportTutorPayoutCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD"),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD"),
      })
      .refine((v) => v.from <= v.to, { message: "`to` must be on or after `from`" })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orders, error } = await (
      supabaseAdmin as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (
              c: string,
              v: string,
            ) => {
              eq: (
                c: string,
                v: boolean,
              ) => {
                gt: (
                  c: string,
                  v: number,
                ) => {
                  gte: (
                    c: string,
                    v: string,
                  ) => {
                    lt: (
                      c: string,
                      v: string,
                    ) => {
                      order: (
                        c: string,
                        opts: { ascending: boolean },
                      ) => Promise<{
                        data: Array<{
                          id: string;
                          delivered_at: string;
                          tutor_id: string;
                          gross_hkd: number;
                          platform_fee_hkd: number;
                          tutor_net_hkd: number;
                          is_grant: boolean;
                          digital_materials: {
                            title: string;
                          } | null;
                          tutors: { display_name: string } | null;
                        }> | null;
                        error?: { message: string } | null;
                      }>;
                    };
                  };
                };
              };
            };
          };
        };
      }
    )
      .from("material_orders")
      .select(
        "id, delivered_at, tutor_id, gross_hkd, platform_fee_hkd, tutor_net_hkd, is_grant, digital_materials(title), tutors(display_name)",
      )
      .eq("status", "delivered")
      .eq("is_grant", false)
      // What we actually pay out: filter on net with a real number (the
      // old string "0" against NUMERIC relied on PostgREST coercion), so
      // an HK$0 row can never reach the CSV.
      .gt("tutor_net_hkd", 0)
      // Half-open [from 00:00 HKT, to 00:00 HKT) window on delivered_at.
      .gte("delivered_at", `${data.from}T00:00:00+08:00`)
      .lt("delivered_at", `${data.to}T00:00:00+08:00`)
      .order("delivered_at", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = orders ?? [];
    const csv = buildPayoutCsv(rows);
    return {
      csv,
      rowCount: rows.length,
      fileName: `tutor-payouts-${new Date().toISOString().slice(0, 10)}.csv`,
    };
  });

// ---------------------------------------------------------------------------
// #202 Tutor home: the tutor's own notes summary.
// ---------------------------------------------------------------------------

export type MyNotesSummary = {
  /** Orders delivered in the CURRENT HKT calendar month. */
  deliveredThisMonth: number;
  /**
   * Sum of tutor_net over delivered, non-grant orders with no payout ledger
   * yet (the manual monthly payout has no paid marker — see the payout
   * export's paid_out_at note). Grant rows are HK$0 by construction and are
   * excluded anyway. The case admin fee is a PARENT fee and never enters
   * this number (it lives in case_fees, a different table).
   */
  netOwedHkd: number;
};

/**
 * Pure core of the #202 notes summary (extracted for tests): counts orders
 * DELIVERED in the current HKT calendar month and sums tutor_net over ALL
 * delivered non-grant rows (all-time — there is no paid_out_at ledger yet;
 * see the payout export's follow-up note). Grant rows are HK$0 by
 * construction: they count as deliveries but add nothing to net.
 */
export function summarizeMyNotesOrders(
  rows: Array<{
    delivered_at: string;
    tutor_net_hkd: number | string;
    is_grant: boolean;
  }>,
  now: Date,
): MyNotesSummary {
  // Current HKT month window, reusing the payout export's month logic.
  const monthKey = hktDateKey(now).slice(0, 7);
  const { fromIso, toIso } = parsePayoutMonthWindow(monthKey);
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();

  let deliveredThisMonth = 0;
  let netOwedHkd = 0;
  for (const row of rows) {
    if (!row.is_grant) netOwedHkd += Number(row.tutor_net_hkd) || 0;
    const at = new Date(row.delivered_at).getTime();
    if (at >= from && at < to) deliveredThisMonth += 1;
  }
  return {
    deliveredThisMonth,
    netOwedHkd: Math.round(netOwedHkd * 100) / 100,
  };
}

/**
 * #202 Tutor home notes block: delivered count this month (HKT) + net owed.
 * Tutor-gated (tutors.user_id); returns zeros for accounts without a card
 * instead of throwing — the block simply renders nothing.
 */
export const getMyNotesSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyNotesSummary> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tutorRow, error: tutorError } = await (
      supabaseAdmin as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (
              c: string,
              v: string,
            ) => {
              maybeSingle: () => Promise<{
                data: { id: string } | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      }
    )
      .from("tutors")
      .select("id")
      .eq("user_id", context.userId)
      // Review blocker: without .maybeSingle() supabase-js resolves an ARRAY
      // for this filter, so tutorRow?.id was always undefined and the whole
      // summary silently returned zeros. maybeSingle() yields the one row
      // (or null when the account has no card), matching the type above.
      .maybeSingle();
    if (tutorError) throw new Error(tutorError.message);
    const tutorId = tutorRow?.id;
    if (!tutorId) return { deliveredThisMonth: 0, netOwedHkd: 0 };

    const { data: orders, error } = await (
      supabaseAdmin as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (
              c: string,
              v: string,
            ) => {
              eq: (
                c: string,
                v: string,
              ) => Promise<{
                data: Array<{
                  delivered_at: string;
                  tutor_net_hkd: number;
                  is_grant: boolean;
                }> | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      }
    )
      .from("material_orders")
      .select("delivered_at, tutor_net_hkd, is_grant")
      .eq("tutor_id", tutorId)
      .eq("status", "delivered");
    if (error) throw new Error(error.message);

    return summarizeMyNotesOrders(orders ?? [], new Date());
  });

// ---------------------------------------------------------------------------
// #392 course access: lesson embeds + signed lesson PDFs for buyers.
// ---------------------------------------------------------------------------

/** Typed error the course detail page catches to render the locked state. */
export const COURSE_LOCKED_ERROR = "This course is not unlocked for your account.";

export type CourseAccessLesson = {
  id: string;
  position: number;
  title: string;
  videoProvider: string | null;
  /** youtube-nocookie / player.vimeo embed — NEVER the raw URL. */
  embedUrl: string | null;
  /** 10-minute signed URL for the watermarked lesson PDF (null when none). */
  pdfSignedUrl: string | null;
};

export type CourseAccess = {
  courseId: string;
  courseTitle: string;
  courseSlug: string | null;
  lessons: CourseAccessLesson[];
};

/**
 * Buyer access for a video_course / general_course: an authenticated buyer
 * with a DELIVERED order on the course gets each lesson's embed URL
 * (youtube-nocookie via parseYouTubeUrl, player.vimeo.com via
 * parseVimeoUrl) plus a 10-minute signed URL per watermarked lesson PDF.
 * Non-owners (and non-courses) get the typed COURSE_LOCKED_ERROR — the
 * embed URLs and pdf paths never cross the gate. The raw video_url /
 * pdf_path stay server-side.
 */
export const getCourseAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ materialId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<CourseAccess> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { validateCourseVideoUrl } = await import("@/lib/vimeo");

    const { data: order, error } = await (supabaseAdmin as unknown as OrdersClient)
      .from("material_orders")
      .select("*")
      .eq("material_id", data.materialId)
      .eq("buyer_account_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    try {
      assertOwnedDeliveredOrder(order, context.userId);
    } catch {
      throw new Error(COURSE_LOCKED_ERROR);
    }

    const { data: course, error: courseError } = await (
      supabaseAdmin as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (
              c: string,
              v: string,
            ) => {
              maybeSingle: () => Promise<{
                data: {
                  id: string;
                  title: string;
                  slug: string | null;
                  material_type: string;
                } | null;
                error?: { message: string } | null;
              }>;
            };
          };
        };
      }
    )
      .from("digital_materials")
      .select("id, title, slug, material_type")
      .eq("id", data.materialId)
      .maybeSingle();
    if (courseError) throw new Error(courseError.message);
    if (
      !course ||
      (course.material_type !== "video_course" && course.material_type !== "general_course")
    ) {
      throw new Error(COURSE_LOCKED_ERROR);
    }

    const { data: lessons, error: lessonsError } = await (
      supabaseAdmin as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (
              c: string,
              v: string,
            ) => {
              order: (
                c: string,
                opts: { ascending: boolean },
              ) => Promise<{
                data: Array<{
                  id: string;
                  position: number;
                  title: string;
                  video_url: string | null;
                  video_provider: string | null;
                  pdf_path: string | null;
                }> | null;
                error?: { message: string } | null;
              }>;
            };
          };
        };
      }
    )
      .from("course_lessons")
      .select("id, position, title, video_url, video_provider, pdf_path")
      .eq("material_id", course.id)
      .order("position", { ascending: true });
    if (lessonsError) throw new Error(lessonsError.message);

    const accessLessons: CourseAccessLesson[] = [];
    for (const lesson of lessons ?? []) {
      const parsed = validateCourseVideoUrl(lesson.video_url);
      let pdfSignedUrl: string | null = null;
      if (lesson.pdf_path) {
        const { data: signed, error: signError } = await supabaseAdmin.storage
          .from("materials-originals")
          .createSignedUrl(lesson.pdf_path, 60 * 10); // 10 minutes (#203)
        pdfSignedUrl = signError ? null : (signed?.signedUrl ?? null);
      }
      accessLessons.push({
        id: lesson.id,
        position: Number(lesson.position),
        title: lesson.title,
        videoProvider:
          lesson.video_provider === "youtube" || lesson.video_provider === "vimeo"
            ? lesson.video_provider
            : (parsed?.provider ?? null),
        embedUrl: parsed?.embedUrl ?? null,
        pdfSignedUrl,
      });
    }

    return {
      courseId: course.id,
      courseTitle: course.title,
      courseSlug: course.slug,
      lessons: accessLessons,
    };
  });
