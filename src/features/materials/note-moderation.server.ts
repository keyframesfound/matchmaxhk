import { getRuntimeEnv } from "@/lib/runtime-env";
import {
  NOTE_AI_TEXT_FALLBACKS,
  NOTE_AI_TEXT_MODEL,
  NOTE_AI_VISION_FALLBACKS,
  NOTE_AI_VISION_MODEL,
} from "@/features/materials/note-ai";
import {
  buildModerationPrompt,
  parseModerationReply,
  type ModerationResult,
} from "@/features/materials/note-moderation";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_TEXT = 20_000;

/**
 * Run the AI content review. Returns null when it cannot run (no key, every
 * model failed): the caller then routes the note to the staff queue.
 * `images` are https or data URLs (page renders + seller pictures).
 */
export async function moderateNoteContent(input: {
  listingText: string;
  fileText: string | null;
  images: string[];
  regexHints: string[];
}): Promise<ModerationResult | null> {
  const apiKey = getRuntimeEnv("OPENROUTER_API_KEY");
  if (!apiKey) {
    console.error("[note-moderation] OPENROUTER_API_KEY missing");
    return null;
  }

  const text = [
    `Listing:\n${input.listingText.slice(0, 4_000)}`,
    input.fileText ? `Document text (excerpt):\n${input.fileText.slice(0, MAX_TEXT)}` : "",
    input.regexHints.length > 0
      ? `Keyword scanner hints (not proof): ${input.regexHints.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  // Two independent passes: a vision outage must not block the text check
  // (the text model is the one AI detect already uses successfully).
  const [textResult, imageResult] = await Promise.all([
    runModel(apiKey, text, [NOTE_AI_TEXT_MODEL, ...NOTE_AI_TEXT_FALLBACKS]),
    input.images.length > 0
      ? runModel(
          apiKey,
          [
            { type: "text", text: `${text}\n\nCheck these page / cover images too.` },
            ...input.images.slice(0, 4).map((url) => ({ type: "image_url", image_url: { url } })),
          ],
          [NOTE_AI_VISION_MODEL, ...NOTE_AI_VISION_FALLBACKS],
        )
      : Promise.resolve(null),
  ]);
  if (!textResult && !imageResult) return null;
  return mergeResults(textResult, imageResult);
}

function mergeResults(a: ModerationResult | null, b: ModerationResult | null): ModerationResult {
  const list = [a, b].filter((r): r is ModerationResult => r !== null);
  const flagged = list.filter((r) => r.categories.length > 0);
  if (flagged.length === 0) return list[0];
  const worst = flagged.reduce((x, y) => (y.confidence > x.confidence ? y : x));
  return {
    ...worst,
    categories: Array.from(new Set(flagged.flatMap((r) => r.categories))),
  };
}

async function runModel(
  apiKey: string,
  content: unknown,
  models: string[],
): Promise<ModerationResult | null> {
  for (const model of models) {
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://matchmax.hk",
          "X-Title": "MatchMax Notes Moderation",
        },
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 400,
          messages: [
            { role: "system", content: buildModerationPrompt() },
            { role: "user", content },
          ],
        }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.error(`[note-moderation] ${model}: HTTP ${response.status} ${body.slice(0, 200)}`);
        if (response.status === 401 || response.status === 402) return null;
        continue;
      }
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const reply = payload.choices?.[0]?.message?.content;
      if (!reply) continue;
      return parseModerationReply(reply);
    } catch (error) {
      console.error(`[note-moderation] ${model}:`, error);
    }
  }
  return null;
}
