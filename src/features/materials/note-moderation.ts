import { z } from "zod";

/**
 * Owner / CEO request (2026-11-02): notes go live straight away unless an
 * automatic check finds a problem (Carousell-style). Two layers:
 *  1. the #573 regex scanner (contact details, payment handles, official
 *     papers / marking schemes) — instant, no network;
 *  2. an AI review of the listing text, the PDF text and up to 4 page /
 *     picture images for copyrighted material, contact details, violence,
 *     sexual content, hate and illegal content.
 * Decision: clear violation -> rejected (reason shown to the seller);
 * unsure or AI unavailable -> staff queue; clean -> published.
 * The pure parts (prompt, parsing, decision) live here and are unit-tested;
 * the network call is in note-moderation.server.ts.
 */

export const MODERATION_CATEGORIES = [
  "copyright",
  "contact_info",
  "violence",
  "sexual",
  "hate",
  "illegal",
] as const;
export type ModerationCategory = (typeof MODERATION_CATEGORIES)[number];

export type ModerationResult = {
  categories: ModerationCategory[];
  /** 0..1, how sure the model is that a listed category applies. */
  confidence: number;
  reasonEn: string;
  reasonZh: string;
};

export type ModerationDecision =
  | { status: "published"; reason: null }
  | { status: "pending_review"; reason: string | null }
  | { status: "rejected"; reason: string };

/** Above this the AI verdict auto-rejects; between UNSURE and this, staff decide. */
export const REJECT_CONFIDENCE = 0.75;
export const UNSURE_CONFIDENCE = 0.4;

export function buildModerationPrompt(): string {
  return [
    "You are the content safety reviewer for MatchMax, a Hong Kong study-notes marketplace.",
    "Sellers upload their OWN revision notes, summaries, mock papers they wrote, and exemplars.",
    "Check the listing text, the document text and any page images. Return ONE JSON object, no prose.",
    "",
    "Flag a category only when the material itself clearly contains it:",
    '- "copyright": copied third-party copyrighted work offered for sale: official exam papers or',
    "  marking schemes (HKEAA / DSE, IBO, Cambridge, Edexcel, College Board), scanned textbook or",
    "  published book pages, school internal exam papers, paid course material. Notes that merely",
    "  mention a syllabus, exam board or question style are FINE; original summaries are FINE.",
    '- "contact_info": phone numbers, emails, WhatsApp / WeChat / Telegram / Instagram handles,',
    "  QR codes, websites or any way to contact or pay the seller off the platform.",
    '- "violence": graphic violence, gore, threats, weapons instructions.',
    '- "sexual": sexual or nude content (any sexual content involving minors is always flagged).',
    '- "hate": hate speech or harassment against a group or person.',
    '- "illegal": cheating services (doing coursework for students), drugs, other illegal content.',
    "",
    "JSON keys:",
    `- "categories": array of the flagged keys from: ${MODERATION_CATEGORIES.join(", ")} (empty if clean).`,
    '- "confidence": 0 to 1, how sure you are the flagged categories apply (0 when clean).',
    '- "reason_en": one short English sentence for the seller saying what to fix ("" if clean).',
    '- "reason_zh": the same in Traditional Chinese ("" if clean).',
  ].join("\n");
}

const rawSchema = z.object({
  categories: z.array(z.string()).catch([]),
  confidence: z.coerce.number().catch(0),
  reason_en: z.string().catch(""),
  reason_zh: z.string().catch(""),
});

export function parseModerationReply(content: string): ModerationResult {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Moderation reply was not JSON.");
  const raw = rawSchema.parse(JSON.parse(content.slice(start, end + 1)));
  const categories = raw.categories
    .map((c) => c.trim().toLowerCase())
    .filter((c): c is ModerationCategory =>
      (MODERATION_CATEGORIES as readonly string[]).includes(c),
    );
  return {
    categories: Array.from(new Set(categories)),
    confidence: Math.min(1, Math.max(0, raw.confidence)),
    reasonEn: raw.reason_en.trim().slice(0, 300),
    reasonZh: raw.reason_zh.trim().slice(0, 300),
  };
}

/** Regex flags that are hard rules (no AI needed to reject). */
const HARD_REGEX_FLAGS = new Set(["contact_details", "payment_handle"]);

const REGEX_REASON: Record<string, string> = {
  contact_details:
    "Remove phone numbers, emails and social / messaging handles from the file and listing. 請刪除檔案及資料中的電話、電郵及社交或通訊帳號。",
  payment_handle:
    "Remove payment details (PayMe, FPS, AlipayHK). Buyers pay through MatchMax. 請刪除付款資料（PayMe、轉數快、AlipayHK），買家須經 MatchMax 付款。",
};

const CATEGORY_REASON: Record<ModerationCategory, string> = {
  copyright:
    "This looks like copyrighted material (official papers, marking schemes, textbook pages). Only sell your own work. 內容疑似受版權保護（官方試卷、評卷參考或課本內容），只可出售自己原創的教材。",
  contact_info:
    "Remove contact details or QR codes from the file. 請刪除檔案中的聯絡資料或二維碼。",
  violence: "Violent content is not allowed. 不可包含暴力內容。",
  sexual: "Sexual content is not allowed. 不可包含色情內容。",
  hate: "Hateful or harassing content is not allowed. 不可包含仇恨或騷擾內容。",
  illegal: "This content is not allowed on MatchMax. 此內容不容許在 MatchMax 出售。",
};

/**
 * Combine the regex scanner and the AI review into one decision.
 * `ai` is null when the AI check could not run (fail closed: staff queue).
 */
export function decideModeration(input: {
  regexFlags: string[];
  ai: ModerationResult | null;
  /** The file had no text and no page images could be checked. */
  uncheckable: boolean;
}): ModerationDecision {
  const hard = input.regexFlags.filter((f) => HARD_REGEX_FLAGS.has(f));
  if (hard.length > 0) {
    return { status: "rejected", reason: hard.map((f) => REGEX_REASON[f]).join(" ") };
  }
  if (!input.ai) {
    return { status: "pending_review", reason: "automatic check unavailable" };
  }
  const { categories, confidence } = input.ai;
  if (categories.length > 0 && confidence >= REJECT_CONFIDENCE) {
    const reason =
      [input.ai.reasonEn, input.ai.reasonZh].filter(Boolean).join(" ") ||
      categories.map((c) => CATEGORY_REASON[c]).join(" ");
    return { status: "rejected", reason };
  }
  if (categories.length > 0 && confidence >= UNSURE_CONFIDENCE) {
    return { status: "pending_review", reason: `possible: ${categories.join(", ")}` };
  }
  if (input.uncheckable) {
    return { status: "pending_review", reason: "file could not be checked automatically" };
  }
  return { status: "published", reason: null };
}
