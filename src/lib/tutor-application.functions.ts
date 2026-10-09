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
            content: `Extract academic results from the image. Return only JSON with overall, best6, and scores. Each score must have subject, grade, detail, level, gradeSystem. Use empty strings when unavailable. Only include results visible in the document.${data.curriculum === "IBDP" ? ` For IBDP, use only these exact subject names: ${IB_BLOCKS.flatMap(([, subjects]) => subjects).join(", ")}. Use grades 7, 6, 5, 4, 3, 2, or 1 for subjects; use A, B, C, D, or E only for TOK and Extended Essay.` : ""}${data.curriculum === "IELTS" ? " For IELTS, use only these subject names: Overall, Reading, Writing, Listening, Speaking. Use band scores such as 8.5 or 7.0 as grades, and report the overall band as overall." : ""}${data.curriculum === "ISAT" ? " For ISAT, use only these subject names: Overall, Critical Reasoning, Quantitative Reasoning. Scaled scores are integers from 100 to 200 (e.g. 165), and report the overall scaled score as overall." : ""}${data.curriculum === "UCAT(3600)" ? " For UCAT(3600), use only these subject names: Total, Verbal Reasoning, Decision Making, Quantitative Reasoning, Abstract Reasoning, Situational Judgement. Cognitive subtests use scaled scores from 300 to 900 (e.g. 650); Situational Judgement uses Band 1, Band 2, Band 3, or Band 4; report the total score (1200-3600) as overall." : ""}${data.curriculum === "UCAT(2700)" ? " For UCAT(2700), use only these subject names: Total, Verbal Reasoning, Decision Making, Quantitative Reasoning, Situational Judgement. Cognitive subtests use scaled scores from 300 to 900 (e.g. 650); Situational Judgement uses Band 1, Band 2, Band 3, or Band 4; report the total score (900-2700) as overall." : ""}`,
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

export const generateSelfIntroduction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        university: z.string().trim().max(200).default(""),
        programme: z.string().trim().max(200).default(""),
        curricula: z.array(z.string().trim().max(60)).max(12).default([]),
        overallScore: z.string().trim().max(200).default(""),
        subjects: z.array(z.string().trim().max(120)).max(40).default([]),
        experience: z.string().trim().max(2000).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = getRuntimeEnv("OPENROUTER_API_KEY");
    if (!apiKey) throw new Error("AI writing is not configured.");

    // Issue #120: one premium first-person bio from the academic data the
    // applicant already entered. The form shows the draft for review — the
    // model writes, it never submits.
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
        temperature: 0.7,
        max_tokens: 600,
        messages: [
          {
            role: "system",
            content:
              "You are a top-tier private tutor in Hong Kong. Write a professional, confident, and friendly self-introduction in the first person ('I'). Use the provided academic data to write exactly 2 short paragraphs. Focus on a passion for teaching and helping students achieve their target grades. Keep the tone premium and natural. Do not use overly robotic words like 'Furthermore' or 'In conclusion.' Maximum 150 words. Return only the introduction text, with no preamble or quotes.",
          },
          {
            role: "user",
            content: `University: ${data.university || "Not provided"}\nMajor: ${data.programme || "Not provided"}\nHigh School Curriculum: ${data.curricula.join(", ") || "Not provided"}\nTop Grades: ${data.overallScore || "Not provided"}\nSubjects I want to teach: ${data.subjects.join(", ") || "Not provided"}\nTeaching experience: ${data.experience || "Not provided"}`,
          },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(
        `AI writing failed (OpenRouter ${response.status}). Please try again or write your introduction manually.`,
      );
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("AI writing returned nothing. Please try again.");
    // Defense against chatty models wrapping the bio in markdown fences.
    return content.replace(/^```[a-z]*\s*|\s*```$/g, "").trim();
  });

// Issue #122: pricing-recommender output contract.
const suggestedRateSchema = z.object({
  suggested_range: z.string().trim().min(1).max(60),
  justification: z.string().trim().min(1).max(400),
});

export const suggestHourlyRate = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        university: z.string().trim().max(200).default(""),
        major: z.string().trim().max(200).default(""),
        curricula: z.array(z.string().trim().max(60)).max(12).default([]),
        overallScore: z.string().trim().max(200).default(""),
        experience: z.string().trim().max(800).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = getRuntimeEnv("OPENROUTER_API_KEY");
    if (!apiKey) throw new Error("Rate suggestions are not configured.");

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
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a pricing analyst for MatchMax, a premium tutoring agency in Hong Kong. \nI will provide you with a tutor applicant's academic background and experience. \nCalculate a suggested hourly rate (in HKD) based on these foundational baseline rules:\n1. Standard DSE / Lower Secondary (HKTA baseline): $150 - $250 HKD/hr.\n2. Premium Curriculums (IB / A-Level / IGCSE): Add a $100 - $150 premium.\n3. Elite Pedigree (Medical/Law students, scores of IB 43+/A-Level 3A*+): Base rate starts at $400 - $600+ HKD/hr.\n4. Experience: Add $50/hr for every 2+ years of experience.\n\nReturn ONLY a valid JSON object with two keys:\n- `suggested_range`: A string formatted like '$300 - $400'\n- `justification`: One short, encouraging sentence explaining the price (e.g., 'With your IB score of 44 and HKU Medical background, parents are willing to pay a premium for your expertise.')",
          },
          {
            role: "user",
            content: `University: ${data.university || "Not provided"}\nMajor: ${data.major || "Not provided"}\nCurriculum to Teach: ${data.curricula.join(", ") || "Not provided"}\nGrades: ${data.overallScore || "Not provided"}\nExperience: ${data.experience || "Not provided"}`,
          },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Rate suggestion failed (OpenRouter ${response.status}). Please enter your rate manually.`,
      );
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("Rate suggestion returned nothing. Please try again.");
    return suggestedRateSchema.parse(JSON.parse(content));
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

    const { storeTutorApplication } = await import("./tutor-application.server");
    await storeTutorApplication(application);
    return { ok: true as const };
  });
