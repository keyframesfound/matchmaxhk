import { freeChat, FREE_AI_MAX_TEXT } from "@/features/materials/free-ai.server";
import {
  buildModerationPrompt,
  parseModerationReply,
  type ModerationResult,
} from "@/features/materials/note-moderation";

/**
 * Run the AI content review on free providers only (Workers AI free
 * allocation, then OpenRouter ":free" models). Returns null when no free
 * option is left: the caller then decides on the keyword scan alone.
 * `images` are https or data URLs (page renders + seller pictures).
 */
export async function moderateNoteContent(input: {
  listingText: string;
  fileText: string | null;
  images: string[];
  regexHints: string[];
  userId?: string | null;
}): Promise<ModerationResult | null> {
  const text = [
    `Listing:\n${input.listingText.slice(0, 3_000)}`,
    input.fileText ? `Document text (excerpt):\n${input.fileText.slice(0, FREE_AI_MAX_TEXT)}` : "",
    input.regexHints.length > 0
      ? `Keyword scanner hints (not proof): ${input.regexHints.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  // One call: multimodal when there are pictures, text-only otherwise
  // (one call per note keeps more of the free daily quota).
  const vision = input.images.length > 0;
  const reply = await freeChat({
    system: buildModerationPrompt(),
    content: vision
      ? [
          { type: "text", text: `${text}\n\nCheck these page / cover images too.` },
          ...input.images.slice(0, 3).map((url) => ({
            type: "image_url" as const,
            image_url: { url },
          })),
        ]
      : text,
    vision,
    maxTokens: 300,
    userId: input.userId ?? null,
    title: "MatchMax Notes Moderation",
  });
  if (!reply.text && vision) {
    // Vision quota gone: still check the text for free.
    const textOnly = await freeChat({
      system: buildModerationPrompt(),
      content: text,
      maxTokens: 300,
      userId: input.userId ?? null,
      title: "MatchMax Notes Moderation",
    });
    return textOnly.text ? safeParse(textOnly.text) : null;
  }
  return reply.text ? safeParse(reply.text) : null;
}

function safeParse(text: string): ModerationResult | null {
  try {
    return parseModerationReply(text);
  } catch {
    return null;
  }
}
