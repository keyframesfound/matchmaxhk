/**
 * Issue #201 — one-time CSV import (server wrapper).
 *
 * Per CSV row: resolve tutor (tutor_code, case-insensitive, exact
 * display_name fallback), optionally resolve the parent account by phone,
 * create the case via admin_create_sor_case (atomic org + member + case;
 * rerun-safe), insert the lesson rows (status done at 10:00 HKT), and — when
 * the fee was paid — insert a paid case_fees row. Planning logic lives in
 * import-plan.ts (vitest-covered).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { parseCaseImportCsv, type ParsedImportRow } from "@/features/cases/import-csv";
import { buildImportOps, normalizePhone, type ImportTutor } from "@/features/cases/import-plan";
import { computeFeeAmountHkd, hktFromParts } from "@/features/cases/sor";

type Row = Record<string, unknown>;
type Db = ReturnType<typeof asAdminDb>;

async function requireAdmin(db: Db, userId: string): Promise<void> {
  for (const role of ["admin", "super_admin"] as const) {
    const { data } = await db.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return;
  }
  throw new Error("FORBIDDEN");
}

export const importCases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ csv: z.string().min(1).max(200_000) }).parse(input),
  )
  .handler(
    async ({
      context,
      data,
    }): Promise<{ created: number; errors: { row: number; message: string }[] }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = asAdminDb(supabaseAdmin);
      await requireAdmin(db, context.userId);

      const parsed = parseCaseImportCsv(data.csv);
      if (parsed.rows.length === 0) {
        return {
          created: 0,
          errors: [...parsed.errors.map((e) => ({ row: e.row, message: e.message }))],
        };
      }

      // Lookups: tutors by code or exact name; parents by normalized phone.
      const tutorPage = async (offset: number): Promise<ImportTutor[]> => {
        const { data: tutors } = await db
          .from<Row>("tutors")
          .select("id, user_id, display_name, tutor_code")
          .order("created_at", { ascending: true })
          .limit(500);
        return ((tutors ?? []) as unknown as ImportTutor[]).slice(offset, offset + 500);
      };
      const allTutors: ImportTutor[] = [];
      for (let offset = 0; offset < 2000; offset += 500) {
        const page = await tutorPage(offset);
        allTutors.push(...page);
        if (page.length < 500) break;
      }
      const findTutor = (nameOrCode: string): ImportTutor | null => {
        const needle = nameOrCode.trim().toLowerCase();
        return (
          allTutors.find((t) => (t.tutor_code ?? "").toLowerCase() === needle) ??
          allTutors.find((t) => t.display_name.trim().toLowerCase() === needle) ??
          null
        );
      };

      // Parents: profiles carry the phone; load once (small table).
      const { data: parentRows } = await db.from<Row>("profiles").select("id, phone");
      const phoneToParent = new Map<string, string>();
      for (const p of (parentRows ?? []) as { id: string; phone: string | null }[]) {
        if (p.phone) phoneToParent.set(normalizePhone(p.phone), p.id);
      }

      const plan = buildImportOps(parsed.rows, {
        findTutor,
        findParentByPhone: (phone) => {
          const id = phoneToParent.get(normalizePhone(phone));
          return id ? { id } : null;
        },
      });
      const errors: { row: number; message: string }[] = [
        ...parsed.errors.map((e) => ({ row: e.row, message: e.message })),
        ...plan.errors,
      ];

      let created = 0;
      for (const op of plan.ops) {
        try {
          const { data: caseId, error } = await db.rpc("admin_create_sor_case", {
            _payload: {
              assigned_tutor_id: op.tutorId,
              parent_account_id: op.parentAccountId,
              concierge_id: context.userId,
              student_display_name: op.parentName,
              subject: op.subject,
              hourly_rate_hkd: op.hourlyRateHkd,
              contact_name: op.parentName,
              contact_phone: op.phone,
              source: "import",
            },
          });
          if (error) throw new Error(error.message ?? "create failed");
          const id = caseId as string;

          // Lessons: CSV date order; done at 10:00 HKT on the stored date.
          let sequence = 1;
          for (const dateKey of op.lessonDateKeys) {
            const startsAt = hktFromParts(dateKey, 10 * 60).toISOString();
            const { data: tutorUser } = await db
              .from<Row>("tutors")
              .select("user_id")
              .eq("id", op.tutorId)
              .maybeSingle();
            const { error: lessonError } = await db
              .from<Row>("case_lessons")
              .insert({
                case_id: id,
                sequence,
                tutor_id: op.tutorId,
                starts_at: startsAt,
                duration_min: 60,
                status: "done",
                marked_done_by: context.userId,
                done_at: startsAt,
                created_by: context.userId,
              })
              .select("id")
              .single();
            void tutorUser;
            if (lessonError) throw new Error(lessonError.message);
            sequence += 1;
          }

          // Fee paid -> a paid fee row (rate × 1.5), then the case is active-able.
          if (op.feePaid) {
            const amount = computeFeeAmountHkd(op.hourlyRateHkd);
            const { error: feeError } = await db
              .from<Row>("case_fees")
              .insert({
                case_id: id,
                rate_hkd: op.hourlyRateHkd,
                multiplier: 1.5,
                amount_hkd: amount,
                status: "paid",
                paid_at: new Date().toISOString(),
                marked_paid_by: context.userId,
              })
              .select("id")
              .single();
            if (feeError) throw new Error(feeError.message);
            await db
              .from<Row>("case_audit")
              .insert({
                case_id: id,
                actor_id: context.userId,
                from_status: null,
                to_status: "import_fee_paid",
                reason: "CSV import",
              })
              .select("id")
              .single();
          }

          created += 1;
        } catch (err) {
          errors.push({
            row: op.rowNumber,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return { created, errors };
    },
  );

export type { ParsedImportRow };
