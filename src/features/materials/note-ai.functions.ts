import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { CONTENT_LANGUAGES } from "@/features/materials/note-taxonomy";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import {
  buildNoteAiSystemPrompt,
  detectDocumentLanguage,
  buildNoteAiUserText,
  normalizeNoteAiResult,
  NOTE_AI_MAX_IMAGES,
  NOTE_AI_MAX_TEXT,
  type NoteAiSuggestion,
} from "@/features/materials/note-ai";

/**
 * Notes upload v2: "detect this document". The browser extracts the PDF's
 * text with pdfjs (or, for scanned PDFs / photos, renders up to 4 small page
 * images); this server fn asks Alibaba Qwen via OpenRouter for a title,
 * summary, description and classification, then coerces the reply onto the
 * site's own lists (note-ai.ts). Same provider + pattern as the tutor
 * profile autofill (OpenAI, Anthropic and Gemini are not licensed in HK).
 * Suggestions only: the seller reviews and edits everything.
 */

/**
 * Owner request (2026-11-03): no per-account cap on AI detection. Every
 * call is still logged in ai_suggestion_events (usage tracking only).
 */
const NOTE_AI_EVENT_KIND = "note_detect";

const Input = z.object({
  fileName: z.string().trim().max(200).nullish(),
  pageCount: z.number().int().min(0).max(10_000).nullish(),
  documentLanguage: z.enum(CONTENT_LANGUAGES).nullish(),
  text: z
    .string()
    .max(NOTE_AI_MAX_TEXT + 1000)
    .nullish(),
  // JPEG data URLs, ~1.5 MB each at most.
  images: z
    .array(
      z
        .string()
        .max(2_000_000)
        .regex(/^data:image\/(jpeg|png|webp);base64,/),
    )
    .max(NOTE_AI_MAX_IMAGES)
    .optional(),
});

export const suggestNoteDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }): Promise<NoteAiSuggestion> => {
    const text = (data.text ?? "").replace(/\s+/g, " ").trim().slice(0, 8_000);
    const images = data.images ?? [];
    // Scanned PDFs and photos carry little or no text layer: read the pages.
    const useVision = text.length < 200 && images.length > 0;
    if (!useVision && text.length < 20 && !data.fileName) {
      throw new Error("Not enough content to detect. Fill in the details by hand.");
    }

    // Usage log only (no cap); bookkeeping never blocks detection.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asAdminDb } = await import("@/features/materials/storage-helpers");
    const aiDb = asAdminDb(supabaseAdmin);
    await aiDb
      .from<never>("ai_suggestion_events")
      .insert({ account_id: context.userId, kind: NOTE_AI_EVENT_KIND })
      .then(
        () => undefined,
        () => undefined,
      );

    // Follow the document's language: the client's guess, else detect here.
    const language = data.documentLanguage ?? detectDocumentLanguage(text);
    const userText = buildNoteAiUserText({
      fileName: data.fileName,
      pageCount: data.pageCount,
      text,
    });
    const userContent = useVision
      ? [
          { type: "text", text: userText || "Classify these document pages." },
          ...images.map((url) => ({ type: "image_url", image_url: { url } })),
        ]
      : userText;

    // Owner (2026-11-03): free providers only (Workers AI free allocation,
    // then OpenRouter ":free" models).
    const { freeChat } = await import("@/features/materials/free-ai.server");
    const reply = await freeChat({
      system: buildNoteAiSystemPrompt(language),
      content: userContent as never,
      vision: useVision,
      maxTokens: 1_000,
      userId: context.userId,
      title: "MatchMax Notes Upload Assistant",
    });
    if (!reply.text) {
      throw new Error(
        `The free AI quota for today is used up. Fill in the details by hand, or try Detect again later. 今日的免費 AI 額度已用完，請先手動填寫，或稍後再試。${reply.status ? ` (code ${reply.status})` : ""}`,
      );
    }
    return normalizeNoteAiResult(reply.text);
  });
