import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { IB_BLOCKS } from "@/features/tutors/examSystems";
import { CURRICULUM_OPTIONS, tutorApplicationSchema } from "./tutor-application.schema";
import { getRuntimeEnv } from "./runtime-env";

function normalizeTranscriptValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(normalizeTranscriptValue).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${normalizeTranscriptValue(item)}`)
      .join(", ");
  }
  return "";
}

function transcriptString(schema: z.ZodString) {
  return z.preprocess(normalizeTranscriptValue, schema);
}

function transcriptSummary(maximum: number) {
  return z.preprocess(
    (value) => normalizeTranscriptValue(value).slice(0, maximum),
    z.string().trim().max(maximum),
  );
}

const transcriptExtractionSchema = z.object({
  overall: transcriptSummary(200),
  best6: transcriptSummary(200),
  scores: z
    .array(
      z.object({
        subject: transcriptString(z.string().trim().min(1).max(200)),
        grade: transcriptString(z.string().trim().min(1).max(100)),
        detail: transcriptString(z.string().trim().max(500)),
        level: transcriptString(z.string().trim().max(100)),
        gradeSystem: transcriptString(z.string().trim().max(100)),
      }),
    )
    .min(1)
    .max(20),
});

const transcriptInputSchema = z.object({
  curriculum: z.enum(CURRICULUM_OPTIONS),
  contentType: z.enum(["image/jpeg", "image/png"]),
  content: z.string().min(100).max(7_000_000),
});

export const extractTranscriptQualification = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => transcriptInputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = getRuntimeEnv("OPENROUTER_API_KEY");
    if (!apiKey) throw new Error("Transcript auto-fill is not configured.");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://matchmax.hk",
        "X-Title": "MatchMax Tutor Application",
      },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: "qwen/qwen3-vl-32b-instruct",
        temperature: 0,
        max_tokens: 2_000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Extract academic results from the image. Return only JSON with overall, best6, and scores. Each score must have subject, grade, detail, level, gradeSystem. Use empty strings when unavailable. Only include results visible in the document.${data.curriculum === "IBDP" ? ` For IBDP, use only these exact subject names: ${IB_BLOCKS.flatMap(([, subjects]) => subjects).join(", ")}. Use grades 7, 6, 5, 4, 3, 2, or 1 for subjects; use A, B, C, D, or E only for TOK and Extended Essay.` : ""}`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Extract the ${data.curriculum} qualification.` },
              {
                type: "image_url",
                image_url: { url: `data:${data.contentType};base64,${data.content}` },
              },
            ],
          },
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
      throw new Error(
        `Transcript auto-fill failed (OpenRouter ${response.status})${detail}. Please try again or enter your results manually.`,
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("Transcript auto-fill could not read that image.");
    return transcriptExtractionSchema.parse(
      JSON.parse(content.replace(/^```json\s*|\s*```$/g, "")),
    );
  });

export const submitTutorApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tutorApplicationSchema.parse(input))
  .handler(async ({ data }) => {
    const { turnstileToken, ...application } = data;
    const secret = getRuntimeEnv("TURNSTILE_SECRET");
    const expectedHostnames = new Set(
      (getRuntimeEnv("TURNSTILE_HOSTNAMES") ?? "")
        .split(",")
        .map((hostname) => hostname.trim())
        .filter(Boolean),
    );

    if (!secret || expectedHostnames.size === 0) {
      throw new Error("Application verification is unavailable.");
    }

    let result: { success?: boolean; action?: string; hostname?: string };
    try {
      const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(10_000),
        body: new URLSearchParams({ secret, response: turnstileToken }),
      });
      if (!response.ok) throw new Error(`siteverify ${response.status}`);
      result = await response.json();
    } catch {
      throw new Error("Application verification failed.");
    }

    if (
      !result.success ||
      result.action !== "tutor_application" ||
      !result.hostname ||
      !expectedHostnames.has(result.hostname)
    ) {
      throw new Error("Application verification failed.");
    }

    const { sendTutorApplication } = await import("./tutor-application.server");
    await sendTutorApplication(application);
    return { ok: true as const };
  });
