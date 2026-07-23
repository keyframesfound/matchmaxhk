import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const POST_CASES_ENABLED = false;

const phoneRegex = /^[+\d][\d\s()\-]{5,20}$/;

const CaseInput = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  subject: z.string().trim().min(1).max(120),
  exam_system: z.string().trim().max(40).optional().nullable(),
  student_level: z.string().trim().min(1).max(40),
  student_grade_current: z.string().trim().max(80).optional().nullable(),
  student_school: z.string().trim().max(120).optional().nullable(),
  district: z.string().trim().max(80).optional().nullable(),
  mode: z.enum(["online", "in_person", "either"]),
  sessions_per_week: z.number().int().min(1).max(14),
  session_length_minutes: z.number().int().min(30).max(240),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  schedule_note: z.string().trim().max(400).optional().nullable(),
  preferred_gender: z.enum(["any", "male", "female"]),
  language_of_instruction: z.enum(["en", "zh-HK", "either"]),
  preferred_tutor_type: z.enum(["any", "university", "full_time", "experienced"]),
  urgency: z.enum(["low", "normal", "high"]),
  budget_min: z.number().int().min(0).max(100000).optional().nullable(),
  budget_max: z.number().int().min(0).max(100000).optional().nullable(),
  contact_name: z.string().trim().min(1).max(80),
  contact_phone: z.string().trim().regex(phoneRegex, "Invalid phone"),
  whatsapp_ok: z.boolean(),
});

export type CaseFormInput = z.infer<typeof CaseInput>;

async function assertAdmin(supabase: unknown, userId: string) {
  const roles: Array<"admin" | "super_admin" | "staff"> = ["admin", "super_admin", "staff"];
  const client = supabase as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  for (const r of roles) {
    const { data } = await client.rpc("has_role", { _user_id: userId, _role: r });
    if (data === true) return;
  }
  throw new Error("Forbidden");
}

export const createCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CaseInput.parse(data))
  .handler(async ({ data, context }) => {
    if (!POST_CASES_ENABLED) {
      throw new Error("Posting cases is temporarily disabled.");
    }
    const { supabase, userId } = context;
    const insertRow = { ...data, parent_id: userId };
    const { data: row, error } = await supabase
      .from("tutoring_cases")
      .insert(insertRow)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const { data: matches, error: mErr } = await supabase.rpc("match_tutors_for_case", {
      _case_id: row.id,
      _limit: 5,
    });
    if (mErr) throw new Error(mErr.message);
    return { caseId: row.id as string, matches: matches ?? [] };
  });

export const listMyCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tutoring_cases")
      .select("id, title, subject, student_level, district, status, is_public, created_at, budget_min, budget_max")
      .eq("parent_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ caseId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("tutoring_cases")
      .select("*")
      .eq("id", data.caseId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const getMatchesForCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ caseId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: matches, error } = await context.supabase.rpc("match_tutors_for_case", {
      _case_id: data.caseId,
      _limit: 5,
    });
    if (error) throw new Error(error.message);
    return matches ?? [];
  });

const ListFilters = z.object({
  subject: z.string().trim().max(80).optional().nullable(),
  district: z.string().trim().max(80).optional().nullable(),
  student_level: z.string().trim().max(40).optional().nullable(),
});

export const listPublicCases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ListFilters.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("tutoring_cases")
      .select("id, title, subject, exam_system, student_level, student_grade_current, district, mode, sessions_per_week, budget_min, budget_max, urgency, language_of_instruction, description, created_at, status")
      .eq("is_public", true)
      .in("status", ["approved", "matched"])
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.subject) q = q.eq("subject", data.subject);
    if (data.district) q = q.eq("district", data.district);
    if (data.student_level) q = q.eq("student_level", data.student_level);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getPublicCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ caseId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("tutoring_cases")
      .select("id, title, subject, exam_system, student_level, student_grade_current, district, mode, sessions_per_week, session_length_minutes, budget_min, budget_max, urgency, language_of_instruction, preferred_gender, preferred_tutor_type, schedule_note, description, created_at, status, is_public, parent_id")
      .eq("id", data.caseId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const isOwner = row.parent_id === context.userId;
    // Non-owners never see parent_id
    if (!isOwner) {
      const { parent_id: _drop, ...safe } = row;
      return safe;
    }
    return row;
  });

export const expressInterest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      caseId: z.string().uuid(),
      tutorId: z.string().uuid(),
      note: z.string().trim().max(1000).optional().nullable(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    // Verify caller owns the tutor row or is admin
    const { data: tutor, error: tErr } = await context.supabase
      .from("tutors")
      .select("id, created_by")
      .eq("id", data.tutorId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!tutor) throw new Error("Tutor not found");
    const isOwner = tutor.created_by === context.userId;
    let isAdmin = false;
    if (!isOwner) {
      const { data: adm } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
      isAdmin = adm === true;
    }
    if (!isOwner && !isAdmin) throw new Error("Only the tutor profile owner or an admin can express interest");
    const { error } = await context.supabase
      .from("case_interests")
      .insert({
        case_id: data.caseId,
        tutor_id: data.tutorId,
        submitted_by: context.userId,
        note: data.note ?? null,
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyInterests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("case_interests")
      .select("id, case_id, tutor_id, note, status, created_at")
      .eq("submitted_by", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Admin
export const listCasesForAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ status: z.string().optional().nullable() }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("tutoring_cases")
      .select("id, title, subject, student_level, district, status, is_public, created_at, contact_name, contact_phone, budget_min, budget_max")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status) q = q.eq("status", data.status as "pending" | "approved" | "matched" | "closed" | "rejected");
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const updateCaseStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      caseId: z.string().uuid(),
      status: z.enum(["pending", "approved", "matched", "closed", "rejected"]),
      is_public: z.boolean().optional(),
      admin_notes: z.string().trim().max(2000).optional().nullable(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const patch: { status: "pending" | "approved" | "matched" | "closed" | "rejected"; is_public?: boolean; admin_notes?: string | null } = { status: data.status };
    if (typeof data.is_public === "boolean") patch.is_public = data.is_public;
    if (data.admin_notes !== undefined) patch.admin_notes = data.admin_notes;
    if (data.status === "approved" && data.is_public === undefined) patch.is_public = true;
    if (data.status === "rejected" || data.status === "closed") patch.is_public = false;
    const { error } = await context.supabase
      .from("tutoring_cases")
      .update(patch)
      .eq("id", data.caseId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listInterestsForCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ caseId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("case_interests")
      .select("id, tutor_id, note, status, created_at, tutors ( display_name, tutor_code, hourly_rate, rating, photo_url )")
      .eq("case_id", data.caseId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const setInterestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      interestId: z.string().uuid(),
      status: z.enum(["pending", "contact_released", "declined"]),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("case_interests")
      .update({ status: data.status })
      .eq("id", data.interestId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

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
