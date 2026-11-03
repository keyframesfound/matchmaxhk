import { getRuntimeBinding, getRuntimeEnv } from "@/lib/runtime-env";

/**
 * Owner request (2026-11-03): AI for notes must be completely free.
 *
 * 1. Cloudflare Workers AI (the `AI` binding) inside its daily free
 *    allocation. A site-wide daily call budget keeps usage under it, so no
 *    usage-based charge can build up.
 * 2. OpenRouter models with the ":free" suffix only (never billed, even
 *    when the account has credit). They have daily request limits.
 * When both are exhausted the caller gets null (detect shows a message, the
 * content check publishes on the keyword scan, as before).
 */

export type ChatContent =
  | string
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

type AiBinding = {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
};

/** Workers AI models: multimodal first (Chinese + images), then text. */
const WORKERS_AI_VISION_MODELS = [
  "@cf/meta/llama-4-scout-17b-16e-instruct",
  "@cf/google/gemma-3-12b-it",
];
const WORKERS_AI_TEXT_MODELS = [
  "@cf/meta/llama-4-scout-17b-16e-instruct",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
];

/** OpenRouter ":free" models (zero cost). */
const OPENROUTER_FREE_TEXT_MODELS = [
  "qwen/qwen3-235b-a22b:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-27b-it:free",
];
const OPENROUTER_FREE_VISION_MODELS = [
  "qwen/qwen2.5-vl-72b-instruct:free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-4-scout:free",
];

/**
 * Site-wide Workers AI calls per UTC day. The free allocation is 10,000
 * neurons a day; one notes call (about 3k input + 400 output tokens on
 * Llama 4 Scout) costs roughly 100-150 neurons, so 60 calls stay well
 * inside it. Override with the WORKERS_AI_DAILY_CALLS variable.
 */
const DEFAULT_WORKERS_AI_DAILY_CALLS = 60;
const WORKERS_AI_EVENT_KIND = "workers_ai";

/** Keep prompts small: fewer tokens = more free calls per day. */
export const FREE_AI_MAX_TEXT = 8_000;

async function workersAiBudgetLeft(): Promise<boolean> {
  const limit = Number(getRuntimeEnv("WORKERS_AI_DAILY_CALLS") ?? DEFAULT_WORKERS_AI_DAILY_CALLS);
  if (!Number.isFinite(limit) || limit <= 0) return false;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asAdminDb } = await import("@/features/materials/storage-helpers");
    const db = asAdminDb(supabaseAdmin);
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { data, error } = await db
      .from<{ id: string }>("ai_suggestion_events")
      .select("id")
      .eq("kind", WORKERS_AI_EVENT_KIND)
      .gte("created_at", startOfDay.toISOString())
      .limit(limit);
    // Cannot count -> do not risk going over the free allocation.
    if (error) return false;
    return (data ?? []).length < limit;
  } catch {
    return false;
  }
}

async function recordWorkersAiCall(userId: string | null) {
  if (!userId) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asAdminDb } = await import("@/features/materials/storage-helpers");
    await asAdminDb(supabaseAdmin)
      .from<never>("ai_suggestion_events")
      .insert({ account_id: userId, kind: WORKERS_AI_EVENT_KIND });
  } catch {
    // bookkeeping only
  }
}

function replyText(result: unknown): string | null {
  if (!result || typeof result !== "object") return typeof result === "string" ? result : null;
  const r = result as { response?: unknown; result?: { response?: unknown } };
  const value = r.response ?? r.result?.response;
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return JSON.stringify(value);
  return null;
}

async function viaWorkersAi(
  system: string,
  content: ChatContent,
  vision: boolean,
  maxTokens: number,
  userId: string | null,
): Promise<string | null> {
  const ai = getRuntimeBinding<AiBinding>("AI");
  if (!ai || typeof ai.run !== "function") {
    console.error("[free-ai] Workers AI binding AI not found");
    return null;
  }
  if (!(await workersAiBudgetLeft())) {
    console.error("[free-ai] Workers AI daily budget used up");
    return null;
  }
  for (const model of vision ? WORKERS_AI_VISION_MODELS : WORKERS_AI_TEXT_MODELS) {
    try {
      await recordWorkersAiCall(userId);
      const result = await ai.run(model, {
        messages: [
          { role: "system", content: system },
          { role: "user", content },
        ],
        max_tokens: maxTokens,
        temperature: 0.1,
      });
      const text = replyText(result);
      if (text) return text;
    } catch (error) {
      console.error(`[free-ai] workers-ai ${model}:`, error);
    }
  }
  return null;
}

async function viaOpenRouterFree(
  system: string,
  content: ChatContent,
  vision: boolean,
  maxTokens: number,
  title: string,
): Promise<{ text: string | null; status: number | null }> {
  const apiKey = getRuntimeEnv("OPENROUTER_API_KEY");
  if (!apiKey) return { text: null, status: null };
  let status: number | null = null;
  for (const model of vision ? OPENROUTER_FREE_VISION_MODELS : OPENROUTER_FREE_TEXT_MODELS) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://matchmax.hk",
          "X-Title": title,
        },
        signal: AbortSignal.timeout(40_000),
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content },
          ],
        }),
      });
      status = response.status;
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.error(
          `[free-ai] openrouter ${model}: HTTP ${response.status} ${body.slice(0, 200)}`,
        );
        if (response.status === 401) break;
        continue;
      }
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = payload.choices?.[0]?.message?.content;
      if (text) return { text, status };
    } catch (error) {
      console.error(`[free-ai] openrouter ${model}:`, error);
    }
  }
  return { text: null, status };
}

/**
 * One chat completion from free providers only. Returns the reply text, or
 * null with the last provider status when every free option is used up.
 */
export async function freeChat(input: {
  system: string;
  content: ChatContent;
  vision?: boolean;
  maxTokens?: number;
  userId?: string | null;
  title?: string;
}): Promise<{ text: string | null; status: number | null }> {
  const vision = Boolean(input.vision);
  const maxTokens = input.maxTokens ?? 900;
  const fromWorkers = await viaWorkersAi(
    input.system,
    input.content,
    vision,
    maxTokens,
    input.userId ?? null,
  );
  if (fromWorkers) return { text: fromWorkers, status: 200 };
  return viaOpenRouterFree(
    input.system,
    input.content,
    vision,
    maxTokens,
    input.title ?? "MatchMax Notes",
  );
}
