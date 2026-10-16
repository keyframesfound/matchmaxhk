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
});

/**
 * Issue #310 — go live on submit.
 * Issue #357 / #359 — one card per normalized email, and no contact text on it.
 *
 * Reads the just-stored application row with the service-role client,
 * deterministically maps its jsonb `data` to a tutors payload, then asks
 * `publish_tutor_from_application` to insert the card and link it in one
 * transaction (status=accepted + linked_tutor_id). A second submit for the
 * same email reuses that card instead of publishing another one.
 */
async function publishTutorCardFromApplication(
  applicationId: string,
): Promise<{ tutorId: string; tutorCode: string; email: string; name: string }> {
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
  };
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
    // by how they arrived — through a referrer link (?ref=) the surface is
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
