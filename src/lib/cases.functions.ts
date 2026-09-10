import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TARGET_PATHWAY_LABELS, TUTOR_BACKGROUND_LABELS } from "@/features/cases/case-options";

const phoneRegex = /^[+(\d][\d\s()./+-]{4,19}\d$/;

const CaseRequestInput = z
  .object({
    requesterType: z.enum(["parent", "student"]),
    parentName: z.string().trim().min(1, "Name is required.").max(80),
    contactPhone: z.string().trim().regex(phoneRegex, "Please enter a valid phone number."),
    contactEmail: z.string().trim().email("Please enter a valid email address.").max(120),
    supportType: z.enum(["subject_tutoring", "admissions"]),
    // Path A: subject tutoring (null for admissions)
    curriculum: z.string().trim().max(40).optional().nullable(),
    subjects: z.array(z.string().trim().min(1).max(120)).max(4),
    specificComponent: z.string().trim().max(80).optional().nullable(),
    instructionLanguage: z
      .enum(["english_only", "cantonese", "mandarin", "bilingual", "any"])
      .optional()
      .nullable(),
    schoolType: z.string().trim().max(80).optional().nullable(),
    // Path B: admissions (null for subject tutoring)
    targetPathway: z.enum(["ucas_uk", "us_admissions", "hk_jupas", "tests"]).optional().nullable(),
    targetSchool: z.string().trim().max(120).optional().nullable(),
    interviewTest: z
      .enum(["Medicine MMI", "Oxbridge", "IELTS", "SAT", "UCAT", "ISAT"])
      .optional()
      .nullable(),
    // Shared
    year: z.string().trim().max(40).optional().nullable(),
    schoolName: z.string().trim().max(120).optional().nullable(),
    mode: z.enum(["online", "offline", "both", "no_pref"]),
    district: z.string().trim().max(80).optional().nullable(),
    budgetMin: z.number().int().min(0).max(100000).optional().nullable(),
    budgetMax: z.number().int().min(0).max(100000).optional().nullable(),
    tutorBackground: z.enum(["uni_student", "official_examiner", "any"]),
    notes: z.string().trim().max(2000).optional().nullable(),
    website: z.string().max(0).optional().nullable(),
    elapsedMs: z.number().int(),
  })
  .superRefine((data, ctx) => {
    if (data.supportType === "subject_tutoring") {
      if (!data.curriculum) {
        ctx.addIssue({ code: "custom", path: ["curriculum"], message: "Curriculum is required." });
      }
      if (data.subjects.length === 0) {
        ctx.addIssue({ code: "custom", path: ["subject1"], message: "Subject is required." });
      }
      if (!data.instructionLanguage) {
        ctx.addIssue({
          code: "custom",
          path: ["instructionLanguage"],
          message: "Instruction language is required.",
        });
      }
    } else {
      if (!data.targetPathway) {
        ctx.addIssue({
          code: "custom",
          path: ["targetPathway"],
          message: "Target pathway is required.",
        });
      }
      if (!data.interviewTest) {
        ctx.addIssue({
          code: "custom",
          path: ["interviewTest"],
          message: "Interview / test is required.",
        });
      }
    }
    if (data.mode !== "online" && !data.district) {
      ctx.addIssue({ code: "custom", path: ["district"], message: "MTR station is required." });
    }
    if (
      data.budgetMin !== null &&
      data.budgetMin !== undefined &&
      data.budgetMax !== null &&
      data.budgetMax !== undefined &&
      data.budgetMin > data.budgetMax
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["budgetMax"],
        message: "Min budget cannot exceed max budget.",
      });
    }
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
  languageOfInstruction: string | null;
  tutorBackground: string | null;
  tags: string[];
  preferredGender: "any" | "male" | "female";
  startTiming: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  boardPublishedAt: string | null;
  createdAt: string;
};

const PUBLIC_CASE_COLUMNS =
  "id, case_code, title, description, subjects, student_level, exam_system, district, mode, sessions_per_week, session_length_minutes, language_of_instruction, tutor_background, tags, preferred_gender, start_timing, budget_min, budget_max, board_published_at, created_at";

// Never contact_name / contact_phone / contact_email / student_school / student_grade_current.
function mapPublicCaseRow(row: Record<string, unknown>): PublicCaseBoardItem {
  return {
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
    languageOfInstruction: (row.language_of_instruction as string | null) ?? null,
    tutorBackground: (row.tutor_background as string | null) ?? null,
    tags: (row.tags as string[] | null) ?? [],
    preferredGender: (row.preferred_gender as "any" | "male" | "female") ?? "any",
    startTiming: (row.start_timing as string | null) ?? null,
    budgetMin: (row.budget_min as number | null) ?? null,
    budgetMax: (row.budget_max as number | null) ?? null,
    boardPublishedAt: (row.board_published_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

// Public board read: admin client + explicit safe columns only
// Also returns the MatchMax WhatsApp number so Apply links render server-side.
export const getPublicCaseBoard = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [casesResult, settingsResult] = await Promise.all([
    supabaseAdmin
      .from("tutoring_cases")
      .select(PUBLIC_CASE_COLUMNS)
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
    items: rows.map(mapPublicCaseRow),
    whatsappNumber: typeof settingsValue === "string" ? settingsValue.trim() : "",
  };
});

// Single public case detail, same safe columns as the board.
export const getPublicCaseByCode = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ caseCode: z.string().trim().min(1).max(40) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [caseResult, settingsResult] = await Promise.all([
      supabaseAdmin
        .from("tutoring_cases")
        .select(PUBLIC_CASE_COLUMNS)
        .eq("case_code", data.caseCode)
        .not("board_published_at", "is", null)
        .not("status", "in", "(matched,closed,rejected)")
        .maybeSingle(),
      supabaseAdmin.from("app_settings").select("value").eq("key", "whatsapp_number").maybeSingle(),
    ]);
    if (caseResult.error) throw new Error(caseResult.error.message);
    const row = caseResult.data as Record<string, unknown> | null;
    if (!row) return null;
    const settingsValue = settingsResult.data?.value;
    return {
      item: mapPublicCaseRow(row),
      whatsappNumber: typeof settingsValue === "string" ? settingsValue.trim() : "",
    };
  });

function buildCaseTitle(data: CaseRequestPayload): string {
  const level = data.year?.trim() || "";
  if (data.supportType === "admissions") {
    const bits = [
      TARGET_PATHWAY_LABELS[data.targetPathway ?? ""] ?? "",
      data.targetSchool?.trim() || data.interviewTest || "",
    ].filter(Boolean);
    const label = bits.length ? bits.join(" · ") : "University admissions";
    return level ? `${level}: ${label}` : label;
  }
  const subjectPart = data.subjects.slice(0, 2).join(", ");
  const extra = data.subjects.length > 2 ? ` +${data.subjects.length - 2} more` : "";
  if (!subjectPart) return level || "Tutor request";
  return level ? `${level}: ${subjectPart}${extra}` : `${subjectPart}${extra}`;
}

// Delivered-mode form values -> case_mode enum.
const MODE_TO_DB: Record<string, "online" | "in_person" | "either"> = {
  online: "online",
  offline: "in_person",
  both: "either",
  no_pref: "either",
};

// Instruction-language form tokens -> legacy tokens the tutor-matching
// function (match_tutors_for_case) already understands.
const LANGUAGE_TO_DB: Record<string, string> = {
  english_only: "en",
  cantonese: "zh-HK",
  mandarin: "zh-HK",
  bilingual: "either",
  any: "either",
};

// Standardized tags that map this request onto tutor-profile vocabulary
// ("Subjects Taught" and "Achievements and Experiences") for Case Cards.
function buildCaseTags(data: CaseRequestPayload): string[] {
  const tags = new Set<string>();
  for (const subject of data.subjects) tags.add(subject.trim());
  if (data.specificComponent && data.specificComponent !== "None") {
    tags.add(data.specificComponent.trim());
  }
  const backgroundLabel = TUTOR_BACKGROUND_LABELS[data.tutorBackground ?? ""];
  if (backgroundLabel && data.tutorBackground !== "any") tags.add(backgroundLabel);
  if (data.supportType === "admissions") {
    const pathwayLabel = TARGET_PATHWAY_LABELS[data.targetPathway ?? ""];
    if (pathwayLabel) tags.add(pathwayLabel);
    if (data.interviewTest) tags.add(data.interviewTest);
  }
  return Array.from(tags)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
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
      title: buildCaseTitle(data),
      description: data.notes?.trim() ? data.notes.trim() : null,
      subjects: data.subjects,
      exam_system: data.supportType === "subject_tutoring" ? data.curriculum || null : null,
      student_level: data.year?.trim() || "Unspecified",
      contact_email: data.contactEmail,
      requester_type: data.requesterType,
      support_type: data.supportType,
      specific_component:
        data.supportType === "subject_tutoring" ? (data.specificComponent ?? null) : null,
      target_pathway: data.supportType === "admissions" ? (data.targetPathway ?? null) : null,
      target_school: data.supportType === "admissions" ? data.targetSchool || null : null,
      interview_test: data.supportType === "admissions" ? (data.interviewTest ?? null) : null,
      school_type: data.supportType === "subject_tutoring" ? data.schoolType || null : null,
      tutor_background: data.tutorBackground,
      language_of_instruction: LANGUAGE_TO_DB[data.instructionLanguage ?? ""] ?? "either",
      tags: buildCaseTags(data),
      district: data.district || null,
      mode: MODE_TO_DB[data.mode] ?? "either",
      sessions_per_week: 1,
      session_length_minutes: 60,
      preferred_gender: "any" as const,
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
