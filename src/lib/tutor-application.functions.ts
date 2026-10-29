import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { referralSurfaceFor } from "@/features/legal/referral-surface";
import { normalizeTutorRateRows } from "@/features/tutors/rates";
import { buildTutorCardInsert, mappedCardContactError } from "@/lib/tutor-card-mapping";
import { tutorApplicationSchema } from "./tutor-application.schema";
import type { TutorApplication } from "./tutor-application.schema";
import type { Json } from "@/integrations/supabase/types";
import { getRuntimeEnv } from "./runtime-env";

const PUBLIC_SITE_URL = "https://matchmax.hk";

/**
 * Issue #214: the join form's terms gate. The checkbox must arrive true or
 * the application is rejected before anything is stored; the acceptance row
 * itself is written after the application insert succeeds (see handler).
 */
const TermsGateInput = z.object({ legalAgreed: z.literal(true) });

const publishResultSchema = z.object({
  tutor_id: z.string().uuid(),
  tutor_code: z.string().min(1),
  reused: z.boolean(),
  // Issue #358: false when the reused card has been unpublished by staff —
  // the caller must not claim a live card or send the card-live email.
  published: z.boolean(),
});

/**
 * Issue #310, go live on submit.
 * Issue #357 / #359, one card per normalized email, and no contact text on it.
 *
 * Reads the just-stored application row with the service-role client,
 * deterministically maps its jsonb `data` to a tutors payload, then asks
 * `publish_tutor_from_application` to insert the card and link it in one
 * transaction (status=accepted + linked_tutor_id). A second submit for the
 * same email reuses that card instead of publishing another one.
 */
async function publishTutorCardFromApplication(applicationId: string): Promise<{
  tutorId: string;
  tutorCode: string;
  email: string;
  name: string;
  /** Issue #358: false when a reused card has been unpublished by staff. */
  published: boolean;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: row, error: rowError } = await supabaseAdmin
    .from("tutor_applications")
    .select("data, attachment_files")
    .eq("id", applicationId)
    .single();
  if (rowError || !row) {
    throw new Error(`Could not load the stored application: ${rowError?.message ?? "not found"}`);
  }
  const record = row as {
    data: unknown;
    attachment_files: unknown;
  };
  const application = record.data as Omit<TutorApplication, "turnstileToken">;
  const files = Array.isArray(record.attachment_files)
    ? (record.attachment_files as { source?: string; url?: string }[])
    : [];

  const applicationEmail =
    typeof application.email === "string" ? application.email.trim().toLowerCase() : "";

  // Tutor code is allocated inside the RPC under the email lock. The placeholder
  // is only so the mapper can build the rest of the payload; the RPC overwrites it.
  const payload = buildTutorCardInsert(application, "MM-T000", files);
  // Issue #357 / #359: service-role INSERT bypasses the owner UPDATE contact
  // guard. Refuse to publish if any mapped free-text field still has a
  // phone, email, link, or off-platform channel.
  const contactError = mappedCardContactError(payload);
  if (contactError) {
    throw new Error(contactError);
  }

  const { data: published, error: publishError } = await supabaseAdmin.rpc(
    "publish_tutor_from_application",
    {
      p_application_id: applicationId,
      p_card: payload as unknown as Json,
    },
  );
  if (publishError || published == null) {
    throw new Error(`Could not publish your tutor card: ${publishError?.message ?? "unknown"}`);
  }
  const parsed = publishResultSchema.safeParse(published);
  if (!parsed.success) {
    throw new Error("Could not publish your tutor card: unexpected result");
  }

  return {
    tutorId: parsed.data.tutor_id,
    tutorCode: parsed.data.tutor_code,
    email: applicationEmail || application.email,
    name: application.name ?? "",
    // Issue #358: false when a reused card has been unpublished by staff.
    published: parsed.data.published,
  };
}

/** Best-effort "your card is live" email, never fails the submission. */
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

export const generateSelfIntroduction = createServerFn({ method: "POST" })
  // Spends the account's OpenRouter quota: never callable without a session
  // (the /join form sits behind the _authenticated layout anyway).
  .middleware([requireSupabaseAuth])
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
    // applicant already entered. The form shows the draft for review, the
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
  // Same OpenRouter-quota rule as generateSelfIntroduction.
  .middleware([requireSupabaseAuth])
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
  // #214: the acceptance row references auth.users(id), so the submit must
  // carry the applicant's session (the /join page sits behind the
  // _authenticated layout, so this never blocks a legitimate applicant).
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    // #214: validate the terms gate FIRST so a missing/unchecked checkbox is
    // rejected before any application field is even parsed.
    TermsGateInput.parse(input);
    return tutorApplicationSchema.parse(input);
  })
  .handler(async ({ data, context }) => {
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

    // Issue #214: record WHICH terms version the applicant accepted, tagged
    // by how they arrived, through a referrer link (?ref=) the surface is
    // referral_signup, otherwise plain signup. Recorded AFTER the application
    // insert succeeds (subject_id = application id) and BEFORE the card is
    // published; the insert is fail-closed, so an acceptance that was never
    // recorded can never let a card go live.
    const { recordTermsAcceptance } = await import("@/features/legal/terms-acceptance.server");
    await recordTermsAcceptance({
      userId: context.userId,
      surface: referralSurfaceFor(application.referralCode),
      subjectId: id,
    });

    // Issue #310: publish the card immediately. Everything above this line
    // (zod schema incl. the server-side contact filter on every field that
    // maps onto the live card, Turnstile) has already gated the submission
    // BEFORE the row was stored, so a card is only ever published from a
    // fully valid application. publishTutorCardFromApplication scans the
    // mapped text again and publishes inside one transaction.
    const published = await publishTutorCardFromApplication(id);
    // Issue #358: a reused card that staff have since unpublished is NOT
    // live, skip the "your card is live" email and say so in the result.
    if (published.published) {
      await sendCardLiveEmail({
        email: published.email,
        name: published.name,
        tutorCode: published.tutorCode,
      });
    }

    // Issue #189: the WhatsApp activation message names this reference so the
    // team can match the chat thread to the stored application row.
    return {
      ok: true as const,
      applicationId: id,
      tutorCode: published.tutorCode,
      tutorId: published.tutorId,
      published: published.published,
    };
  });
