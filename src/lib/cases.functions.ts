import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const phoneRegex = /^[+\d][\d\s()-]{5,20}$/;

const CaseRequestInput = z.object({
  parentName: z.string().trim().min(1, "Name is required.").max(80),
  contactPhone: z.string().trim().regex(phoneRegex, "Please enter a valid phone number."),
  level: z.string().trim().min(1).max(40),
  examSystem: z.string().trim().max(40).optional().nullable(),
  subjects: z.array(z.string().trim().min(1).max(120)).min(1).max(4),
  mode: z.enum(["online", "in_person", "either"]),
  district: z.string().trim().max(80).optional().nullable(),
  sessionsPerWeek: z.number().int().min(1).max(14).optional().nullable(),
  sessionLengthMinutes: z.number().int().min(30).max(240).optional().nullable(),
  budgetMin: z.number().int().min(0).max(100000).optional().nullable(),
  budgetMax: z.number().int().min(0).max(100000).optional().nullable(),
  preferredGender: z.enum(["any", "male", "female"]),
  startTiming: z.enum(["asap", "two_weeks", "flexible"]).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  website: z.string().max(0).optional().nullable(),
  elapsedMs: z.number().int(),
});

export type CaseRequestPayload = z.infer<typeof CaseRequestInput>;

function buildCaseTitle(subjects: string[], level: string): string {
  const subjectPart = subjects.slice(0, 2).join(", ");
  const extra = subjects.length > 2 ? ` +${subjects.length - 2} more` : "";
  return `${level}: ${subjectPart}${extra}`;
}

export const submitCaseRequest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CaseRequestInput.parse(data))
  .handler(async ({ data }) => {
    if (data.website && data.website.length > 0) {
      throw new Error("Submission could not be accepted.");
    }
    if (data.elapsedMs < 3000) {
      throw new Error("Submission could not be accepted.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = Date.now();

    const { data: recent, error: recentError } = await supabaseAdmin
      .from("tutoring_cases")
      .select("id, case_code, created_at")
      .eq("contact_phone", data.contactPhone)
      .gte("created_at", new Date(now - 10 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1);
    if (recentError) throw new Error(recentError.message);
    if (recent && recent.length > 0) {
      return { caseCode: recent[0].case_code as string, duplicate: true };
    }

    const { count: hourCount, error: countError } = await supabaseAdmin
      .from("tutoring_cases")
      .select("id", { count: "exact", head: true })
      .eq("contact_phone", data.contactPhone)
      .gte("created_at", new Date(now - 60 * 60 * 1000).toISOString());
    if (countError) throw new Error(countError.message);
    if ((hourCount ?? 0) >= 3) {
      throw new Error(
        "We already received several requests from this number. Our team will reach out shortly.",
      );
    }

    const insertRow = {
      title: buildCaseTitle(data.subjects, data.level),
      description: data.notes?.trim() ? data.notes.trim() : null,
      subjects: data.subjects,
      exam_system: data.examSystem || null,
      student_level: data.level,
      district: data.district || null,
      mode: data.mode,
      sessions_per_week: data.sessionsPerWeek ?? 1,
      session_length_minutes: data.sessionLengthMinutes ?? 60,
      start_timing: data.startTiming || null,
      preferred_gender: data.preferredGender,
      budget_min: data.budgetMin ?? null,
      budget_max: data.budgetMax ?? null,
      contact_name: data.parentName,
      contact_phone: data.contactPhone,
      source: "website",
      status: "new" as const,
    };

    const { data: row, error } = await supabaseAdmin
      .from("tutoring_cases")
      .insert(insertRow)
      .select("case_code")
      .single();
    if (error) throw new Error(error.message);

    return { caseCode: row.case_code as string, duplicate: false };
  });

async function assertAdmin(supabase: unknown, userId: string) {
  const roles: Array<"admin" | "super_admin" | "staff"> = ["admin", "super_admin", "staff"];
  const client = supabase as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
  };
  for (const r of roles) {
    const { data } = await client.rpc("has_role", { _user_id: userId, _role: r });
    if (data === true) return;
  }
  throw new Error("Forbidden");
}

// Account deletion (admin only)
export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: tutorError } = await supabaseAdmin
      .from("tutors")
      .delete()
      .eq("created_by", data.userId);
    if (tutorError) throw new Error(tutorError.message);

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (deleteError) throw new Error(deleteError.message);

    return { ok: true };
  });
