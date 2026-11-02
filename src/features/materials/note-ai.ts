import { z } from "zod";

import { MATERIAL_TYPES, NOTE_CURRICULA } from "@/features/materials/lifecycle";
import {
  CONTENT_LANGUAGES,
  getSubcategoriesForCurriculum,
  NOTE_SUBCATEGORIES,
} from "@/features/materials/note-taxonomy";
import { getSubjectOptionsForCategory } from "@/features/tutors/subjects";

/**
 * Notes upload v2: prompt + result normalisation for the AI "detect this
 * document" helper. The model only SUGGESTS; every value is re-validated
 * against the site's own lists here, and the seller can edit everything
 * before submitting. Pure (no network); the server fn lives in
 * note-ai.functions.ts.
 */

/** Alibaba Qwen via OpenRouter (OpenAI / Anthropic / Gemini are not licensed in HK). */
export const NOTE_AI_TEXT_MODEL = "qwen/qwen3-235b-a22b-instruct-2507";
/** Vision model for scanned PDFs / photos (page images instead of text). */
export const NOTE_AI_VISION_MODEL = "qwen/qwen2.5-vl-72b-instruct";

/** Max characters of extracted text sent to the model. */
export const NOTE_AI_MAX_TEXT = 24_000;
/** Max page images sent to the vision model. */
export const NOTE_AI_MAX_IMAGES = 4;

export function buildNoteAiSystemPrompt(): string {
  const subjectsByCurriculum = NOTE_CURRICULA.map(
    (c) => `${c}: ${getSubjectOptionsForCategory(c === "Other" ? undefined : c).join(" | ")}`,
  ).join("\n");
  const subcats = Object.entries(NOTE_SUBCATEGORIES)
    .map(([c, list]) => `${c}: ${list.map((s) => s.value).join(", ")}`)
    .join("\n");
  return [
    "You classify study materials uploaded to MatchMax, a Hong Kong tutoring marketplace.",
    "Read the document excerpt (or page images) and return ONE JSON object, no prose.",
    "Write title, summary and description in the SAME language as the document",
    "(Traditional Chinese stays Traditional, Simplified stays Simplified, English stays English).",
    "Never invent facts the document does not support. Never include phone numbers, emails,",
    "social handles, school names of other students or any contact details.",
    "",
    "JSON keys:",
    '- "title": short buyer-facing title, max 90 chars (e.g. "IB Biology HL Paper 2 Revision Notes").',
    '- "summary": one sentence saying what this is and who it is for, max 200 chars.',
    '- "description": 2-5 short lines covering contents, coverage and how to use it, max 900 chars.',
    `- "curriculum": one of ${NOTE_CURRICULA.join(", ")}.`,
    '- "subject": one subject from the list for that curriculum (exact spelling), or "".',
    `- "materialType": one of ${MATERIAL_TYPES.join(", ")} (notes = revision notes; mock = practice/mock papers written by the tutor; exemplar = a graded student work such as an IA/EE/essay; flashcards = Q/A cards).`,
    '- "subcategory": one value from the list for that curriculum, or "".',
    '- "topic": the main topic, max 40 chars, or "".',
    '- "year": exam year / session if stated (e.g. "2025" or "May 2025"), or "".',
    `- "language": one of ${CONTENT_LANGUAGES.join(", ")}.`,
    '- "tags": 3-10 short search keywords; mix English and Chinese synonyms buyers might type.',
    '- "confidence": 0 to 1.',
    "",
    "Subjects by curriculum:",
    subjectsByCurriculum,
    "",
    "Subcategories by curriculum:",
    subcats,
  ].join("\n");
}

export function buildNoteAiUserText(input: {
  fileName?: string | null;
  pageCount?: number | null;
  text?: string | null;
}): string {
  const parts = [
    input.fileName ? `File name: ${input.fileName}` : "",
    input.pageCount ? `Pages: ${input.pageCount}` : "",
    input.text ? `Document text (excerpt):\n${input.text.slice(0, NOTE_AI_MAX_TEXT)}` : "",
  ].filter(Boolean);
  return parts.join("\n");
}

const rawSchema = z.object({
  title: z.string().catch(""),
  summary: z.string().catch(""),
  description: z.string().catch(""),
  curriculum: z.string().catch(""),
  subject: z.string().catch(""),
  materialType: z.string().catch(""),
  subcategory: z.string().catch(""),
  topic: z.string().catch(""),
  year: z.union([z.string(), z.number()]).catch(""),
  language: z.string().catch(""),
  tags: z.array(z.string()).catch([]),
  confidence: z.coerce.number().catch(0.5),
});

export type NoteAiSuggestion = {
  title: string;
  summary: string;
  description: string;
  curriculum: (typeof NOTE_CURRICULA)[number] | "";
  subject: string;
  materialType: (typeof MATERIAL_TYPES)[number] | "";
  subcategory: string;
  topic: string;
  year: string;
  language: (typeof CONTENT_LANGUAGES)[number] | "";
  tags: string[];
  confidence: number;
};

/** Strip contact-like strings the model might echo from the document. */
function scrub(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "")
    .replace(/(?:\+?852[\s-]?)?\b[2-9]\d{3}[\s-]?\d{4}\b/g, "")
    .replace(/(?:wa\.me|whatsapp|instagram|ig:|telegram|t\.me)\S*/gi, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function matchFromList<T extends string>(value: string, list: readonly T[]): T | "" {
  const v = value.trim().toLowerCase();
  if (!v) return "";
  const exact = list.find((item) => item.toLowerCase() === v);
  if (exact) return exact;
  const loose = list.find(
    (item) =>
      item.toLowerCase().replace(/[^a-z0-9]/g, "") === v.replace(/[^a-z0-9]/g, "") ||
      (v.length >= 4 && item.toLowerCase().includes(v)),
  );
  return loose ?? "";
}

/** Parse the model's JSON text and coerce every field onto the site's lists. */
export function normalizeNoteAiResult(content: string): NoteAiSuggestion {
  let parsed: unknown;
  try {
    const jsonText = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("The AI reply was not valid JSON.");
  }
  const raw = rawSchema.parse(parsed);

  const curriculumAlias: Record<string, string> = {
    ibdp: "IB",
    hkdse: "DSE",
    "a level": "A-Level",
    alevel: "A-Level",
    gcse: "IGCSE",
  };
  const curriculumInput = curriculumAlias[raw.curriculum.trim().toLowerCase()] ?? raw.curriculum;
  const curriculum = matchFromList(curriculumInput, NOTE_CURRICULA);
  const subjectPool = getSubjectOptionsForCategory(
    curriculum && curriculum !== "Other" ? curriculum : undefined,
  );
  const subject = matchFromList(raw.subject, subjectPool);
  const materialType = matchFromList(raw.materialType, MATERIAL_TYPES);
  const subcategories = getSubcategoriesForCurriculum(curriculum || "Other").map((s) => s.value);
  const subcategory = matchFromList(raw.subcategory.replace(/\s+/g, "_"), subcategories);
  const language = matchFromList(raw.language, CONTENT_LANGUAGES);
  const tags = Array.from(
    new Set(raw.tags.map((t) => scrub(String(t)).slice(0, 30)).filter((t) => t.length >= 2)),
  ).slice(0, 10);

  return {
    title: scrub(raw.title).slice(0, 120),
    summary: scrub(raw.summary).slice(0, 220),
    description: scrub(raw.description).slice(0, 1500),
    curriculum,
    subject,
    materialType,
    subcategory,
    topic: scrub(raw.topic).slice(0, 40),
    year: String(raw.year).trim().slice(0, 20),
    language,
    tags,
    confidence: Math.min(1, Math.max(0, raw.confidence)),
  };
}
