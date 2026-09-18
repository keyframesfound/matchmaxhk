import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EXAM_SYSTEMS } from "@/features/tutors/examSystems";
import { MTR_STATION_OPTIONS } from "@/features/tutor-application/mtr";
import {
  IA_EE_TOK_SUPPORT_OPTIONS,
  MAX_TUTOR_CARD_HIGHLIGHTS,
  TUTOR_CARD_HIGHLIGHT_ROW_LIMIT,
} from "@/features/tutors/queries";
import { buildAnswerRows, type TutorApplication } from "@/lib/tutor-application.schema";
import { getRuntimeEnv } from "@/lib/runtime-env";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// Alibaba Qwen3 via OpenRouter — accessible from Hong Kong (OpenAI, Anthropic
// and Google Gemini APIs are not licensed for HK, so they must not be used).
const AUTOFILL_MODEL = "qwen/qwen3-235b-a22b-instruct-2507";

async function assertAdmin(supabase: unknown, userId: string) {
  const roles: Array<"admin" | "super_admin"> = ["admin", "super_admin"];
  const client = supabase as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error?: { message?: string } }>;
  };
  for (const role of roles) {
    const { data, error } = await client.rpc("has_role", { _user_id: userId, _role: role });
    if (error) throw new Error(error.message || "Failed to verify admin role");
    if (data === true) return;
  }
  throw new Error("Forbidden");
}

const loadApplicationInputSchema = z.object({
  applicationId: z.string().uuid("Invalid application reference"),
});

/** Loads the raw text of a stored tutor application for the AI autofill box. */
export const fetchAutofillApplicationSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => loadApplicationInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data: rows, error } = await context.supabase
      .from("tutor_applications")
      .select("id, created_at, data")
      .eq("id", data.applicationId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!rows) throw new Error("Application not found (it may have been purged).");

    const record = rows as { id: string; created_at: string; data: unknown };
    const application = record.data as TutorApplication;
    const submitted = record.created_at
      ? new Date(record.created_at).toLocaleDateString("en-HK", { dateStyle: "medium" })
      : "unknown date";

    const lines = [
      `TUTOR APPLICATION (submitted ${submitted})`,
      ...buildAnswerRows(application).map((row) => `${row.label}: ${row.value}`),
    ];
    return { source: lines.join("\n") };
  });

const autofillInputSchema = z.object({
  source: z.string().trim().min(30, "Add some info about the tutor first").max(30_000),
});

const paperSchema = z.object({
  label: z.string().trim().max(40),
  score: z.string().trim().max(40),
});

const examEntrySchema = z.object({
  subject: z.string().trim().max(120).catch(""),
  grade: z.string().trim().max(40).catch(""),
  papers: z.array(paperSchema).max(5).optional().catch([]),
});

const autofillResultSchema = z.object({
  tutor_code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{2,20}$/)
    .catch(""),
  gender: z.enum(["male", "female", "other"]).catch("other"),
  academic_headline: z.string().trim().max(200).catch(""),
  university: z.string().trim().max(200).catch(""),
  secondary_school: z.string().trim().max(200).catch(""),
  subjects: z.array(z.string().trim().min(1).max(80)).max(20).catch([]),
  target_students: z.array(z.string().trim().min(1).max(80)).max(10).catch([]),
  exam_results: z
    .array(
      z.object({
        system: z.string().trim().min(1).max(20),
        subjects: z.array(examEntrySchema).max(20).catch([]),
      }),
    )
    .max(3)
    .catch([]),
  lesson_mode: z.enum(["online", "in_person", "either"]).catch("either"),
  hourly_rate: z.coerce.number().int().min(0).max(100000).catch(0),
  stations: z.array(z.string().trim().min(1).max(80)).max(100).catch([]),
  experience_years: z.coerce.number().int().min(0).max(80).nullable().catch(null),
  languages: z.array(z.string().trim().min(1).max(60)).max(8).catch([]),
  card_highlights: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(TUTOR_CARD_HIGHLIGHT_ROW_LIMIT + 40),
    )
    .max(MAX_TUTOR_CARD_HIGHLIGHTS + 2)
    .catch([]),
  qualifications_summary: z.string().trim().min(1).max(2000).catch(""),
  ia_ee_tok_support: z.array(z.enum(IA_EE_TOK_SUPPORT_OPTIONS)).max(3).catch([]),
  ia_ee_tok_notes: z.string().trim().max(1000).catch(""),
  notes: z.array(z.string().trim().min(1).max(300)).max(10).catch([]),
});

export type TutorAutofillResult = z.infer<typeof autofillResultSchema>;

const STYLE_COLUMNS = [
  "tutor_code",
  "gender",
  "academic_headline",
  "university",
  "secondary_school",
  "subjects",
  "target_students",
  "exam_results",
  "lesson_mode",
  "hourly_rate",
  "stations",
  "experience_years",
  "languages",
  "card_highlights",
  "qualifications_summary",
  "ia_ee_tok_support",
] as const;

type StyleExample = Record<string, unknown>;

function compactExample(row: Record<string, unknown>): StyleExample {
  const example: StyleExample = {};
  for (const column of STYLE_COLUMNS) {
    const value = row[column];
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === "string" && !value.trim()) continue;
    example[column] = value;
  }
  return example;
}

function buildExamSystemVocab(): string {
  return EXAM_SYSTEMS.filter((system) => system.subjects.length > 0)
    .map((system) => `${system.id} (${system.label}): ${system.subjects.join(" | ")}`)
    .join("\n");
}

function nextTutorCode(rows: { tutor_code?: string | null }[]): string {
  let max = 0;
  for (const row of rows) {
    const match = /^MM-T(\d+)$/i.exec((row.tutor_code ?? "").trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `MM-T${String(max + 1).padStart(3, "0")}`;
}

function buildSystemPrompt(styleExamples: StyleExample[], suggestedCode: string): string {
  return `You are the profile-builder assistant for MatchMax, a Hong Kong tutoring marketplace. You convert raw tutor application information into a complete tutor profile that matches the MatchMax house style EXACTLY.

Return ONLY a JSON object with these keys:
- tutor_code (suggest "${suggestedCode}" unless the source specifies a code)
- gender ("male" | "female" | "other")
- academic_headline (string <= 120 chars, e.g. "IBDP 44/45", "HKDSE Best 5: 32", "Official IB Maths Examiner & School Teacher")
- university (short name e.g. "HKU", "CUHK", "University College London"; empty if unknown)
- secondary_school (empty if unknown)
- subjects (array of teachable subject names, using the exam-system vocabulary below where possible)
- target_students (subset of: Primary, Junior Secondary, IBDP, IGCSE, HKDSE, A-Level, AP, SAT, University, Adult learners)
- exam_results (array of at most 3 objects: { system: "<system id>", subjects: [{ subject, grade, papers?: [{ label, score }] }] }). Grade formats: IB "7"-"1" (TOK/EE "A"-"E"); DSE "5**","5*","5"...; IGCSE "A* (legacy)" or "9"-"1"; A-Level "A*"-"U"; AP "5"-"1"; IELTS bands like "8.5". Only include papers when the source gives component scores (labels "Paper 1", "Paper 2", "Paper 3").
- lesson_mode ("online" | "in_person" | "either"; "Face to face" -> in_person, "Online" -> online, "Both" -> either)
- hourly_rate (integer HKD)
- stations (array of exact MTR station names from the list below; empty if online only or unknown)
- experience_years (integer or null)
- languages (array e.g. ["English","Cantonese","Mandarin"])
- card_highlights (array of EXACTLY 1-3 strings, each <= 55 characters, headline style, no trailing period; may end with one relevant emoji; these are the tutor's strongest credential hooks)
- qualifications_summary (markdown <= 1500 chars. House style: blocks of "**• <Award or honor title> :** <one-sentence description of what it is and why it matters>" separated by blank lines, title bold, institution names italic when natural, a relevant emoji at the end of each block. Finish with a lighter unbolded bullet about tutoring experience. NEVER invent awards, scores, scholarships, or schools that are not in the source. If the source has no awards, write a simple experience-focused summary instead.)
- ia_ee_tok_support (subset of ["IA","EE","TOK"]; only when the source clearly indicates IB coursework mentoring or examiner status)
- ia_ee_tok_notes (short optional string)
- notes (array of strings flagging anything uncertain, invented nothing: e.g. "University not mentioned - left blank", "Award X could not be verified from source")

STRICT RULES:
1. Use ONLY facts present in the source. Do not fabricate universities, awards, scores, schools, or experience.
2. Map informal subject descriptions to the exact vocabulary (e.g. "IB Chemistry higher level" -> "Chem HL").
3. Omit a field (empty array/empty string) rather than guessing.

EXAM SYSTEM VOCABULARY (system id: allowed subject names):
${buildExamSystemVocab()}

MTR STATION NAMES (use exact names):
${MTR_STATION_OPTIONS.join(", ")}

HOUSE STYLE EXAMPLES (real published tutor profiles — copy this voice, structure, and formatting):
${JSON.stringify(styleExamples, null, 1)}

Now generate the profile JSON for the new tutor from the user's source information.`;
}

/** Generates a house-style tutor profile suggestion from raw source text. */
export const generateTutorAutofill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => autofillInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const apiKey = getRuntimeEnv("OPENROUTER_API_KEY");
    if (!apiKey) throw new Error("AI autofill is not configured.");

    const { data: tutorRows, error: tutorError } = await context.supabase
      .from("tutors")
      .select(
        "tutor_code, gender, academic_headline, university, secondary_school, subjects, target_students, exam_results, lesson_mode, hourly_rate, stations, experience_years, languages, card_highlights, qualifications_summary, ia_ee_tok_support",
      )
      .eq("is_published", true)
      .gt("hourly_rate", 0)
      .order("created_at", { ascending: true })
      .limit(30);

    if (tutorError) throw new Error(tutorError.message);
    const styleExamples = ((tutorRows ?? []) as Record<string, unknown>[]).map(compactExample);
    const suggestedCode = nextTutorCode((tutorRows ?? []) as { tutor_code?: string | null }[]);

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://matchmax.hk",
        "X-Title": "MatchMax Tutor Profile Autofill",
      },
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        model: AUTOFILL_MODEL,
        temperature: 0.2,
        max_tokens: 4_500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt(styleExamples, suggestedCode) },
          { role: "user", content: data.source },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let providerMessage = "";
      try {
        const parsed = JSON.parse(errorBody) as { error?: { message?: string } };
        providerMessage = parsed.error?.message?.trim() ?? "";
      } catch {
        providerMessage = errorBody.trim();
      }
      const detail = providerMessage ? `: ${providerMessage.slice(0, 240)}` : "";
      throw new Error(`AI autofill failed (OpenRouter ${response.status})${detail}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI autofill returned an empty response.");

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(content.replace(/^```json\s*|\s*```$/g, ""));
    } catch {
      throw new Error("AI autofill returned invalid JSON. Please try again.");
    }

    const result = autofillResultSchema.parse(parsedJson);

    // Clamp to the hard limits the editor enforces.
    const cardHighlights = result.card_highlights
      .map((value) => value.trim().slice(0, TUTOR_CARD_HIGHLIGHT_ROW_LIMIT))
      .filter(Boolean)
      .slice(0, MAX_TUTOR_CARD_HIGHLIGHTS);

    return {
      ...result,
      card_highlights: cardHighlights,
      qualifications_summary: result.qualifications_summary.slice(0, 1500),
    } satisfies TutorAutofillResult & { card_highlights: string[]; qualifications_summary: string };
  });
