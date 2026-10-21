import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { mergeCaseTags } from "@/features/tutors/profile-tags";
import { SEN_CATEGORY_OPTIONS } from "@/features/tutors/sen";
import {
  buildVerticalInsert,
  normalizeFunnelLevel,
  SECONDARY_BANDS,
  storedStudentLevel,
} from "@/features/cases/case-verticals";
import { FEE_TERMS_VERSION } from "@/features/legal/terms";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { TARGET_PATHWAY_LABELS, TUTOR_BACKGROUND_LABELS } from "@/features/cases/case-options";
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from "@/lib/money";
import { sanitizeCaseFreeText } from "@/lib/contact-filter";

const phoneRegex = /^[+(\d][\d\s()./+-]{4,19}\d$/;

const CaseRequestInput = z
  .object({
    requesterType: z.enum(["parent", "student"]),
    parentName: z.string().trim().min(1, "Name is required.").max(80),
    contactPhone: z.string().trim().regex(phoneRegex, "Please enter a valid phone number."),
    supportType: z.enum(["subject_tutoring", "admissions"]),
    // Issue #190: the level-first funnel. The academic level drives the
    // vertical columns (academic_tier + uni/K fields) at save time.
    academicLevel: z.enum(["Kindergarten", "Primary", "Secondary", "University"]),
    secondaryBand: z.enum(SECONDARY_BANDS).optional().nullable(),
    uniField: z.string().trim().max(80).optional().nullable(),
    uniName: z.string().trim().max(120).optional().nullable(),
    uniProgram: z.string().trim().max(120).optional().nullable(),
    uniCourseCodes: z.string().trim().max(2000).optional().nullable(),
    kindergartenTopics: z.array(z.string().trim().min(1).max(80)).max(20).optional().nullable(),
    // "Admissions" for the admissions path; the chosen curriculum otherwise.
    curriculum: z.string().trim().max(40).optional().nullable(),
    subjects: z.array(z.string().trim().min(1).max(120)).max(4),
    // Issue #311: parent-picked preset tags, max five (the preset
    // allowlist + dedupe/contact gating runs in mergeCaseTags at save
    // time — one tag table shared with tutor profile tags; non-preset
    // input from a crafted payload is dropped, never published).
    tags: z.array(z.string().trim().min(1).max(30)).max(5).optional().nullable(),
    specificComponent: z.string().trim().max(80).optional().nullable(),
    instructionLanguage: z
      .array(z.enum(["english_only", "cantonese", "mandarin", "any"]))
      .max(5)
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
    // Issue #112: native budget currency. The public form stays HKD-only
    // until #114 ships the selector; the API already accepts the field.
    budgetCurrency: z.enum(SUPPORTED_CURRENCIES).optional(),
    tutorBackground: z.enum(["uni_student", "official_examiner", "any"]),
    // Issue #199: SEN support requirements. Categories use the shared
    // HK-common vocabulary; details stay off the public board (see
    // PUBLIC_CASE_COLUMNS) and are only used for matching.
    senRequired: z.boolean().default(false),
    senCategories: z
      .array(z.enum(SEN_CATEGORY_OPTIONS))
      .max(SEN_CATEGORY_OPTIONS.length)
      .default([]),
    senDetails: z.string().trim().max(2000).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
    termsAck: z.literal(true),
    // Issue #253 (F2): the matching-fee agreement (fee-2026-10) is a
    // separate, mandatory checkbox; the version is recorded server-side.
    feeTermsAck: z.literal(true),
    website: z.string().max(0).optional().nullable(),
    elapsedMs: z.number().int(),
  })
  .superRefine((data, ctx) => {
    if (!data.curriculum) {
      ctx.addIssue({ code: "custom", path: ["curriculum"], message: "Curriculum is required." });
    }
    if (data.supportType === "subject_tutoring") {
      if (data.subjects.length === 0) {
        ctx.addIssue({ code: "custom", path: ["subject1"], message: "Subject is required." });
      }
      if (!data.instructionLanguage || data.instructionLanguage.length === 0) {
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
  // Issue #190: vertical columns (safe subset — no contact data).
  academicTier: string | null;
  uniField: string | null;
  uniName: string | null;
  uniProgram: string | null;
  uniCourseCodes: string | null;
  kindergartenFocus: string[];
  examSystem: string | null;
  district: string | null;
  mode: "online" | "in_person" | "either";
  sessionsPerWeek: number;
  sessionLengthMinutes: number;
  languageOfInstruction: string | null;
  tutorBackground: string | null;
  specificComponent: string | null;
  targetSchool: string | null;
  tags: string[];
  senRequired: boolean;
  senCategories: string[];
  preferredGender: "any" | "male" | "female";
  startTiming: string | null;
  budgetCurrency: string;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetMinHkd: number | null;
  budgetMaxHkd: number | null;
  boardPublishedAt: string | null;
  createdAt: string;
};

const PUBLIC_CASE_COLUMNS =
  "id, case_code, title, description, subjects, student_level, academic_tier, uni_field, uni_name, uni_program, uni_course_codes, kindergarten_focus, exam_system, district, mode, sessions_per_week, session_length_minutes, language_of_instruction, tutor_background, specific_component, target_school, tags, sen_required, sen_categories, preferred_gender, start_timing, budget_currency, budget_min, budget_max, budget_min_hkd, budget_max_hkd, board_published_at, created_at";

// Never contact_name / contact_phone / student_school / student_grade_current.
// sen_details is also withheld: the board is public and the free-text needs
// details can identify the student — matching reads it via admin surfaces.
function mapPublicCaseRow(row: Record<string, unknown>): PublicCaseBoardItem {
  return {
    id: row.id as string,
    caseCode: row.case_code as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    subjects: (row.subjects as string[] | null) ?? [],
    studentLevel: row.student_level as string,
    // Issue #190: tolerant reads — legacy rows have nulls here and derive
    // the tier client-side via caseAcademicTier(studentLevel).
    academicTier: (row.academic_tier as string | null) ?? null,
    uniField: (row.uni_field as string | null) ?? null,
    uniName: (row.uni_name as string | null) ?? null,
    uniProgram: (row.uni_program as string | null) ?? null,
    uniCourseCodes: (row.uni_course_codes as string | null) ?? null,
    kindergartenFocus: Array.isArray(row.kindergarten_focus)
      ? (row.kindergarten_focus as unknown[]).filter(
          (value): value is string => typeof value === "string",
        )
      : [],
    examSystem: (row.exam_system as string | null) ?? null,
    district: (row.district as string | null) ?? null,
    mode: row.mode as "online" | "in_person" | "either",
    sessionsPerWeek: (row.sessions_per_week as number | null) ?? 1,
    sessionLengthMinutes: (row.session_length_minutes as number | null) ?? 60,
    languageOfInstruction: (row.language_of_instruction as string | null) ?? null,
    tutorBackground: (row.tutor_background as string | null) ?? null,
    specificComponent: (row.specific_component as string | null) ?? null,
    targetSchool: (row.target_school as string | null) ?? null,
    tags: (row.tags as string[] | null) ?? [],
    senRequired: row.sen_required === true,
    senCategories: Array.isArray(row.sen_categories)
      ? (row.sen_categories as string[]).filter(
          (value): value is string => typeof value === "string",
        )
      : [],
    preferredGender: (row.preferred_gender as "any" | "male" | "female") ?? "any",
    startTiming: (row.start_timing as string | null) ?? null,
    budgetCurrency: (row.budget_currency as string) ?? "HKD",
    budgetMin: (row.budget_min as number | null) ?? null,
    budgetMax: (row.budget_max as number | null) ?? null,
    budgetMinHkd: (row.budget_min_hkd as number | null) ?? null,
    budgetMaxHkd: (row.budget_max_hkd as number | null) ?? null,
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
  const subjectPart = data.subjects.slice(0, 2).join(", ");
  const extra = data.subjects.length > 2 ? ` +${data.subjects.length - 2} more` : "";
  if (data.supportType === "admissions") {
    const bits = [
      TARGET_PATHWAY_LABELS[data.targetPathway ?? ""] ?? "",
      data.targetSchool?.trim() || data.interviewTest || "",
      subjectPart ? `${subjectPart}${extra}` : "",
    ].filter(Boolean);
    const label = bits.length ? bits.join(" · ") : "University admissions";
    return level ? `${level}: ${label}` : label;
  }
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
  any: "either",
};

// Multi-select tokens -> the single legacy DB token. One distinct language
// family wins; any mix (or empty) falls back to "either".
function instructionLanguageToDb(tokens: string[] | null | undefined): string {
  const langs = new Set<string>();
  for (const token of tokens ?? []) {
    const mapped = LANGUAGE_TO_DB[token];
    if (mapped) langs.add(mapped);
  }
  if (langs.size !== 1) return "either";
  return langs.values().next().value ?? "either";
}

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
  // Issue #253 (F2): the fee acceptance row records the submitting account,
  // so the request form is a signed-in surface end to end.
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) => CaseRequestInput.parse(data))
  .handler(async ({ data, context }) => {
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
      // Issue #410: parent free text that reaches the public board runs
      // through the shared contact filter (strip, never reject — #396
      // precedent). Blank becomes null, so the old trim-then-null branch
      // collapses into the helper.
      description: sanitizeCaseFreeText(data.notes, 2000),
      subjects: data.subjects,
      exam_system: data.curriculum || null,
      // Issue #190: the funnel answer is the source of truth for the stored
      // level; the optional step-2 year select only fills legacy gaps.
      student_level:
        storedStudentLevel(normalizeFunnelLevel(data.academicLevel), data.secondaryBand ?? null) ??
        data.year?.trim() ??
        "Unspecified",
      // Issue #190: academic tier + Kindergarten/University vertical fields
      // (uni fields only survive on the university tier, K topics only on
      // the kindergarten tier — see buildVerticalInsert).
      ...buildVerticalInsert({
        academicLevel: normalizeFunnelLevel(data.academicLevel),
        uniField: data.uniField,
        uniName: data.uniName,
        uniProgram: data.uniProgram,
        uniCourseCodes: data.uniCourseCodes,
        kindergartenTopics: data.kindergartenTopics,
      }),
      requester_type: data.requesterType,
      support_type: data.supportType,
      specific_component:
        data.supportType === "subject_tutoring" ? (data.specificComponent ?? null) : null,
      target_pathway: data.supportType === "admissions" ? (data.targetPathway ?? null) : null,
      // Issue #410: target_school is parent free text on the public
      // whitelist — contact-filter it like description.
      target_school:
        data.supportType === "admissions" ? sanitizeCaseFreeText(data.targetSchool, 120) : null,
      interview_test: data.supportType === "admissions" ? (data.interviewTest ?? null) : null,
      school_type: data.supportType === "subject_tutoring" ? data.schoolType || null : null,
      tutor_background: data.tutorBackground,
      language_of_instruction: instructionLanguageToDb(data.instructionLanguage),
      // Issue #311: parent-picked preset tags first; derived requirement
      // tags always survive (mergeCaseTags keeps them in full up to
      // MAX_CASE_TAGS), so five parent picks never drop the subjects.
      tags: mergeCaseTags(data.tags, buildCaseTags(data)),
      // Issue #199: SEN requirements (categories only when required).
      sen_required: data.senRequired,
      sen_categories: data.senRequired ? data.senCategories : [],
      sen_details: data.senRequired ? data.senDetails?.trim() || null : null,
      district: data.district || null,
      mode: MODE_TO_DB[data.mode] ?? "either",
      sessions_per_week: 1,
      session_length_minutes: 60,
      preferred_gender: "any" as const,
      budget_min: data.budgetMin ?? null,
      budget_max: data.budgetMax ?? null,
      budget_currency: data.budgetCurrency ?? DEFAULT_CURRENCY,
      contact_name: data.parentName,
      contact_phone: data.contactPhone,
      source: "website",
      status: "new" as const,
    };

    const { data: row, error } = await supabaseAdmin
      .from("tutoring_cases")
      .insert(insertRow)
      .select("id,case_code")
      .single();
    if (error) throw new Error(error.message);

    // Issue #253 (F2): record the matching-fee acceptance (account, version,
    // time) against the created case. Fail-closed — a submit without the
    // checkbox never reaches this point (zod), and the acceptance write is
    // atomic with the case row via compensating delete: if the acceptance
    // insert throws, the just-created case is removed before rethrowing, so
    // no case ever exists without its fee agreement on file and a retry
    // cannot strand an orphan (review blocker, 2026-10-18).
    const { recordTermsAcceptance } = await import("@/features/legal/terms-acceptance.server");
    try {
      await recordTermsAcceptance({
        userId: context.userId,
        surface: "case_request",
        termsVersion: FEE_TERMS_VERSION,
        subjectId: row.id as string,
      });
    } catch (acceptanceError) {
      const { error: rollbackError } = await supabaseAdmin
        .from("tutoring_cases")
        .delete()
        .eq("id", row.id as string);
      if (rollbackError) {
        console.error(
          "[case-request] failed to roll back case after acceptance write failed:",
          rollbackError.message,
        );
      }
      throw acceptanceError;
    }

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
  .middleware([requireSupabaseAuth, requireAccountActive])
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
