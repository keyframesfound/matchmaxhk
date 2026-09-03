import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { CURRICULUM_OPTIONS, tutorApplicationSchema } from "./tutor-application.schema";

const transcriptExtractionSchema = z.object({
  overall: z.string().trim().max(200).default(""),
  best6: z.string().trim().max(200).default(""),
  scores: z.array(
    z.object({
      subject: z.string().trim().min(1).max(200),
      grade: z.string().trim().min(1).max(100),
      detail: z.string().trim().max(500).default(""),
      level: z.string().trim().max(100).default(""),
      gradeSystem: z.string().trim().max(100).default(""),
    }),
  ).min(1).max(20),
});

const transcriptInputSchema = z.object({
  curriculum: z.enum(CURRICULUM_OPTIONS),
  contentType: z.enum(["image/jpeg", "image/png"]),
  content: z.string().min(100).max(7_000_000),
});

export const extractTranscriptQualification = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => transcriptInputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("Transcript auto-fill is not configured.");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Extract academic results from the image. Return only JSON with overall, best6, and scores. Each score must have subject, grade, detail, level, gradeSystem. Use empty strings when unavailable. Only include results visible in the document.",
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
      throw new Error(
        `Transcript auto-fill failed (OpenRouter ${response.status}). Please try again or enter your results manually.`,
      );
    }

    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("Transcript auto-fill could not read that image.");
    return transcriptExtractionSchema.parse(JSON.parse(content.replace(/^```json\s*|\s*```$/g, "")));
  });

export const submitTutorApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tutorApplicationSchema.parse(input))
  .handler(async ({ data }) => {
    const { turnstileToken, ...application } = data;
    const secret = process.env.TURNSTILE_SECRET;
    const expectedHostnames = new Set(
      (process.env.TURNSTILE_HOSTNAMES ?? "")
        .split(",")
        .map((hostname) => hostname.trim())
        .filter(Boolean),
    );

    if (!secret || expectedHostnames.size === 0) {
      throw new Error("Application verification is unavailable.");
    }

    let result: { success?: boolean; action?: string; hostname?: string };
    try {
      const response = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          signal: AbortSignal.timeout(10_000),
          body: new URLSearchParams({ secret, response: turnstileToken }),
        },
      );
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
