import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { getRuntimeEnv } from "@/lib/runtime-env";
import {
  buildNoteAiSystemPrompt,
  buildNoteAiUserText,
  normalizeNoteAiResult,
  NOTE_AI_MAX_IMAGES,
  NOTE_AI_MAX_TEXT,
  NOTE_AI_TEXT_MODEL,
  NOTE_AI_TEXT_FALLBACKS,
  NOTE_AI_VISION_FALLBACKS,
  NOTE_AI_VISION_MODEL,
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

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * GLM review fix: per-account abuse cap on the AI endpoint (up to 4 x 2 MB
 * images per call at a 90 s timeout). One row per call that reaches
 * OpenRouter, recorded in ai_suggestion_events (service-role only). The
 * guard fails OPEN when the table is missing (pre-migration environments)
 * so detection keeps working exactly as before the migration lands.
 */
const NOTE_AI_DAILY_LIMIT = 50;
const NOTE_AI_EVENT_KIND = "note_detect";

const Input = z.object({
  fileName: z.string().trim().max(200).nullish(),
  pageCount: z.number().int().min(0).max(10_000).nullish(),
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
    const apiKey = getRuntimeEnv("OPENROUTER_API_KEY");
    if (!apiKey) {
      throw new Error("AI detection is not configured yet (OPENROUTER_API_KEY is missing).");
    }
    const text = (data.text ?? "").replace(/\s+/g, " ").trim();
    const images = data.images ?? [];
    // Scanned PDFs and photos carry little or no text layer: read the pages.
    const useVision = text.length < 200 && images.length > 0;
    if (!useVision && text.length < 20 && !data.fileName) {
      throw new Error("Not enough content to detect. Fill in the details by hand.");
    }

    // Per-account rolling-24h cap. Fails open when the events table is not
    // there yet (pre-migration), never blocking detection on bookkeeping.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asAdminDb } = await import("@/features/materials/storage-helpers");
    const aiDb = asAdminDb(supabaseAdmin);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    try {
      const recent = await aiDb
        .from<{ created_at: string }>("ai_suggestion_events")
        .select("created_at")
        .eq("account_id", context.userId)
        .eq("kind", NOTE_AI_EVENT_KIND)
        .gte("created_at", since)
        .limit(NOTE_AI_DAILY_LIMIT);
      if ((recent.data?.length ?? 0) >= NOTE_AI_DAILY_LIMIT) {
        throw new Error(
          "AI detection limit reached for today. Fill in the details by hand and try again tomorrow.",
        );
      }
      await aiDb
        .from<never>("ai_suggestion_events")
        .insert({ account_id: context.userId, kind: NOTE_AI_EVENT_KIND });
    } catch (error) {
      if (error instanceof Error && error.message.includes("limit reached")) throw error;
    }

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

    // Try the configured model first, then fallbacks: one provider outage or
    // an unsupported option must not make detection fail outright.
    const models = useVision
      ? [NOTE_AI_VISION_MODEL, ...NOTE_AI_VISION_FALLBACKS]
      : [NOTE_AI_TEXT_MODEL, ...NOTE_AI_TEXT_FALLBACKS];
    let lastError = "AI detection failed.";
    for (const model of models) {
      try {
        const response = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://matchmax.hk",
            "X-Title": "MatchMax Notes Upload Assistant",
          },
          signal: AbortSignal.timeout(45_000),
          body: JSON.stringify({
            model,
            temperature: 0.2,
            max_tokens: 1_200,
            messages: [
              { role: "system", content: buildNoteAiSystemPrompt() },
              { role: "user", content: userContent },
            ],
          }),
        });
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          let detail = "";
          try {
            detail = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? "";
          } catch {
            detail = body;
          }
          lastError = `AI detection failed (OpenRouter ${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`;
          console.error(`[note-ai] ${model}: ${lastError}`);
          // A bad or out-of-credit key fails the same way on every model.
          if (response.status === 401 || response.status === 402) break;
          continue;
        }
        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = payload.choices?.[0]?.message?.content;
        if (!content) {
          lastError = "AI detection returned an empty reply.";
          continue;
        }
        return normalizeNoteAiResult(content);
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.error(`[note-ai] ${model}: ${lastError}`);
      }
    }
    throw new Error(lastError);
  });
