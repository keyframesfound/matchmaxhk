import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { IB_BLOCKS } from "@/features/tutors/examSystems";
import { normalizeTutorRateRows } from "@/features/tutors/rates";
import { nextTutorCode } from "@/lib/tutor-code";
import { buildTutorCardInsert } from "@/lib/tutor-card-mapping";
import { CURRICULUM_OPTIONS, tutorApplicationSchema } from "./tutor-application.schema";
import type { TutorApplication } from "./tutor-application.schema";
import { getRuntimeEnv } from "./runtime-env";

const PUBLIC_SITE_URL = "https://matchmax.hk";

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

/**
 * Issue #310 — go live on submit.
 *
 * Reads the just-stored application row with the service-role client,
 * deterministically maps its jsonb `data` to a tutors INSERT (published), then
 * links the card back onto the application (status=accepted +
 * linked_tutor_id) so the existing claim flow
 * (request_tutor_claim matching data->>'email') works unchanged.
 */
async function publishTutorCardFromApplication(
  applicationId: string,
): Promise<{ tutorId: string; tutorCode: string; email: string; name: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: row, error: rowError } = await supabaseAdmin
    .from("tutor_applications")
    .select("data, attachment_files, referred_by")
    .eq("id", applicationId)
    .single();
  if (rowError || !row) {
    throw new Error(`Could not load the stored application: ${rowError?.message ?? "not found"}`);
  }
  const record = row as {
    data: unknown;
    attachment_files: unknown;
    referred_by: string | null;
  };
  const application = record.data as Omit<TutorApplication, "turnstileToken">;
  const files = Array.isArray(record.attachment_files)
    ? (record.attachment_files as { source?: string; url?: string }[])
    : [];

  // Issue #310 retry guard: if a previous attempt of this same email already
  // published a card, reuse it instead of allocating a second live card
  // (a failed publish leaves the first application row stored, so a resubmit
  // would otherwise double-publish).
  const applicationEmail =
    typeof application.email === "string" ? application.email.trim().toLowerCase() : "";
  if (applicationEmail) {
    const { data: linkedApps, error: dupeError } = await supabaseAdmin
      .from("tutor_applications")
      .select("id, linked_tutor_id")
      .eq("status", "accepted")
      .not("linked_tutor_id", "is", null)
      .neq("id", applicationId)
      .filter("data->>email", "ilike", applicationEmail)
      .limit(25);
    if (!dupeError) {
      const existingTutorId = (linkedApps as { linked_tutor_id: string }[] | null)?.[0]
        ?.linked_tutor_id;
      if (existingTutorId) {
        const { data: existingCard } = await supabaseAdmin
          .from("tutors")
          .select("id, tutor_code, is_published")
          .eq("id", existingTutorId)
          .maybeSingle();
        const card = existingCard as {
          id: string;
          tutor_code: string;
          is_published: boolean | null;
        } | null;
        if (card?.tutor_code) {
          await supabaseAdmin
            .from("tutor_applications")
            .update({ status: "accepted", linked_tutor_id: card.id } as never)
            .eq("id", applicationId);
          return {
            tutorId: card.id,
            tutorCode: card.tutor_code,
            email: applicationEmail,
            name: application.name ?? "",
          };
        }
      }
    }
  }

  const { data: tutorRows, error: tutorError } = await supabaseAdmin
    .from("tutors")
    .select("tutor_code");
  if (tutorError) throw new Error(`Could not allocate a tutor code: ${tutorError.message}`);
  const tutorCode = nextTutorCode((tutorRows ?? []) as { tutor_code: string }[]);

  const payload = buildTutorCardInsert(application, tutorCode, files);
  const { data: created, error: insertError } = await supabaseAdmin
    .from("tutors")
    .insert({ ...payload, referred_by: record.referred_by } as never)
    .select("id")
    .single();
  if (insertError || !created) {
    throw new Error(`Could not publish your tutor card: ${insertError?.message ?? "unknown"}`);
  }
  const tutorId = (created as { id: string }).id;

  // Linking the card is what makes the email-claim flow work (issue #189/#310).
  // An admin can also set linked_tutor_id manually later, so a failure here is
  // logged, not fatal — the card itself is already live.
  const { error: linkError } = await supabaseAdmin
    .from("tutor_applications")
    .update({ status: "accepted", linked_tutor_id: tutorId } as never)
    .eq("id", applicationId);
  if (linkError) {
    console.error(
      `[tutor-application] could not link card ${tutorId} to application ${applicationId}:`,
      linkError.message,
    );
  }

  return { tutorId, tutorCode, email: application.email, name: application.name };
}

/** Best-effort "your card is live" email — never fails the submission. */
async function sendCardLiveEmail(params: {
  email: string;
  name: string;
  tutorCode: string;
}): Promise<void> {
  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    await sendTemplateEmail("tutor-card-live", params.email, {
      templateData: {
        tutorName: params.name,
        tutorCode: params.tutorCode,
        cardUrl: `${PUBLIC_SITE_URL}/tutors/${params.tutorCode}`,
      },
    });
  } catch (err) {
    // Degrade gracefully: unset RESEND_API_KEY or a Resend outage must not
    // fail the submission.
    console.error(
      `[tutor-application] card-live email not sent to ${params.email}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

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

    // Issue #319: build the stored payload. The application row keeps the
    // whole application as jsonb (`data`), so this mapping is what downstream
    // readers (admin join-requests, autofill) see:
    // - hourlyRate (legacy, NOT NULL, still read by legacy surfaces) becomes
    //   the card floor: Math.min of the two base rates (schema guarantees at
    //   least one is set per the format rules).
    // - onlineRate/inpersonRate are blanked when the format excludes them.
    // - rateRows are stored as the normalized output (empty rows dropped,
    //   half-filled rows already rejected by the schema).
    // - travelNote is blanked unless the in-person rate is set.
    const baseRates = [application.onlineRate, application.inpersonRate].filter(
      (rate): rate is number => typeof rate === "number",
    );
    const normalizedRateRows = normalizeTutorRateRows(application.rateRows);
    const storedApplication = {
      ...application,
      hourlyRate: String(Math.min(...baseRates)),
      onlineRate: application.format === "Face to face" ? null : application.onlineRate,
      inpersonRate: application.format === "Online" ? null : application.inpersonRate,
      rateRows: normalizedRateRows.ok ? normalizedRateRows.rows : [],
      travelNote: application.format === "Online" ? "" : application.travelNote,
    };
    const { storeTutorApplication } = await import("./tutor-application.server");
    const { id } = await storeTutorApplication(storedApplication);

    // Issue #310: publish the card immediately. Everything above this line
    // (zod schema incl. the server-side contact filter on the bio/headline/
    // rate texts, Turnstile) has already gated the submission BEFORE the row
    // was stored, so a card is only ever published from a fully valid
    // application.
    const published = await publishTutorCardFromApplication(id);
    await sendCardLiveEmail({
      email: published.email,
      name: published.name,
      tutorCode: published.tutorCode,
    });

    // Issue #189: the WhatsApp activation message names this reference so the
    // team can match the chat thread to the stored application row.
    return {
      ok: true as const,
      applicationId: id,
      tutorCode: published.tutorCode,
      tutorId: published.tutorId,
    };
  });
