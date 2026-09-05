import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const phoneRegex = /^[+(\d][\d\s()./+-]{4,19}\d$/;

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

export type PublicCaseBoardItem = {
  id: string;
  caseCode: string;
  title: string;
  description: string | null;
  subjects: string[];
  studentLevel: string;
  examSystem: string | null;
  district: string | null;
  mode: "online" | "in_person" | "either";
  sessionsPerWeek: number;
  sessionLengthMinutes: number;
  preferredGender: "any" | "male" | "female";
  startTiming: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  boardPublishedAt: string | null;
  createdAt: string;
};

// Public board read: admin client + explicit safe columns only
// (never contact_name / contact_phone / student_school / student_grade_current)
// Also returns the MatchMax WhatsApp number so Apply links render server-side.
export const getPublicCaseBoard = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [casesResult, settingsResult] = await Promise.all([
    supabaseAdmin
      .from("tutoring_cases")
      .select(
        "id, case_code, title, description, subjects, student_level, exam_system, district, mode, sessions_per_week, session_length_minutes, preferred_gender, start_timing, budget_min, budget_max, board_published_at, created_at",
      )
      .not("board_published_at", "is", null)
      .not("status", "in", "(matched,closed,rejected)")
      .order("board_published_at", { ascending: false })
      .limit(60),
    supabaseAdmin.from("app_settings").select("value").eq("key", "whatsapp_number").maybeSingle(),
  ]);
  if (casesResult.error) throw new Error(casesResult.error.message);
  const rows = (casesResult.data ?? []) as Array<Record<string, unknown>>;
  const settingsValue = settingsResult.data?.value;
  return {
    items: rows.map((row): PublicCaseBoardItem => ({
      id: row.id as string,
      caseCode: row.case_code as string,
      title: row.title as string,
      description: (row.description as string | null) ?? null,
      subjects: (row.subjects as string[] | null) ?? [],
      studentLevel: row.student_level as string,
      examSystem: (row.exam_system as string | null) ?? null,
      district: (row.district as string | null) ?? null,
      mode: row.mode as "online" | "in_person" | "either",
      sessionsPerWeek: (row.sessions_per_week as number | null) ?? 1,
      sessionLengthMinutes: (row.session_length_minutes as number | null) ?? 60,
      preferredGender: (row.preferred_gender as "any" | "male" | "female") ?? "any",
      startTiming: (row.start_timing as string | null) ?? null,
      budgetMin: (row.budget_min as number | null) ?? null,
      budgetMax: (row.budget_max as number | null) ?? null,
      boardPublishedAt: (row.board_published_at as string | null) ?? null,
      createdAt: row.created_at as string,
    })),
    whatsappNumber: typeof settingsValue === "string" ? settingsValue.trim() : "",
  };
});

function buildCaseTitle(subjects: string[], level: string): string {
  const subjectPart = subjects.slice(0, 2).join(", ");
  const extra = subjects.length > 2 ? ` +${subjects.length - 2} more` : "";
  return `${level}: ${subjectPart}${extra}`;
}

// Each phone number can create at most 5 case requests in total.
const MAX_REQUESTS_PER_PHONE = 5;

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

    // Every submission creates a new case — no duplicate collapsing by phone number.
    const { count: totalCount, error: countError } = await supabaseAdmin
      .from("tutoring_cases")
      .select("id", { count: "exact", head: true })
      .eq("contact_phone", data.contactPhone);
    if (countError) throw new Error(countError.message);
    if ((totalCount ?? 0) >= MAX_REQUESTS_PER_PHONE) {
      throw new Error(
        "This phone number has reached the maximum of 5 case requests. Our team will contact you on WhatsApp about your existing requests.",
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

    return { caseCode: row.case_code as string };
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
