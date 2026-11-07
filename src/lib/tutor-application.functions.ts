import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { selectRows } from "@/features/cases/desk-db";
import { asAdminDb } from "@/features/materials/storage-helpers";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { referralSurfaceFor } from "@/features/legal/referral-surface";
import { normalizeTutorRateRows } from "@/features/tutors/rates";
import { buildTutorCardInsert, mappedCardContactError } from "@/lib/tutor-card-mapping";
import {
  activationSchema,
  buildActivationApplication,
  phoneIsValid,
} from "@/features/tutor-application/activation";
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

// Issue #122: pricing-recommender output contract.
const suggestedRateSchema = z.object({
  suggested_range: z.string().trim().min(1).max(60),
  justification: z.string().trim().min(1).max(400),
});

type ExistingCard = { id: string; tutor_code: string; is_published: boolean | null };

async function findExistingCard(userId: string, email: string): Promise<ExistingCard | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const columns = "id, tutor_code, is_published";
  const { data: owned } = await supabaseAdmin
    .from("tutors")
    .select(columns)
    .eq("user_id", userId)
    .maybeSingle();
  if (owned) return owned as ExistingCard;
  // Not in the generated types; read through the untyped admin helpers.
  const [link] = await selectRows<{ tutor_id: string }>(
    asAdminDb(supabaseAdmin),
    "tutor_live_card_emails",
    "tutor_id",
    [{ col: "email", op: "eq", value: email.trim().toLowerCase() }],
  );
  if (!link) return null;
  const { data: card } = await supabaseAdmin
    .from("tutors")
    .select(columns)
    .eq("id", link.tutor_id)
    .maybeSingle();
  return (card as ExistingCard | null) ?? null;
}

async function assertTutorAge(userId: string): Promise<void> {
  // #522 age tier: under-16s are blocked from the tutor role (13-15 tier);
  // a missing DOB never blocks (legacy users). Defence in depth — the
  // complete_onboarding RPC enforces the same tier.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: dobRow } = await supabaseAdmin
    .from("profiles")
    .select("date_of_birth")
    .eq("id", userId)
    .maybeSingle();
  const dob = (dobRow as { date_of_birth: string | null } | null)?.date_of_birth ?? null;
  if (!dob) return;
  const age = Math.floor((Date.now() - Date.parse(`${dob}T00:00:00Z`)) / (365.2425 * 86400_000));
  if (age < 16) throw new Error("AGE_RESTRICTED");
}

async function verifyTurnstile(token: string): Promise<void> {
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
      body: new URLSearchParams({ secret, response: token }),
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
}

/**
 * Issue #576 Stage 2: the 60-second sheet publishes the card straight away.
 * The sheet is mapped to a stored application, so the #310 publish path, the
 * contact scans and the join-request archive all stay the single route to a
 * public card. The card then links to this account, enabling Teaching Mode.
 */
export const activateTutorCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => activationSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertTutorAge(context.userId);
    await verifyTurnstile(data.turnstileToken);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userResult, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    const email = userResult?.user?.email;
    if (userError || !email) throw new Error("Your account has no email address.");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, handle, phone")
      .eq("id", context.userId)
      .maybeSingle();
    // A re-publish refreshes SEN and university columns from the payload, and this
    // short sheet has none, so an existing card is linked and left untouched.
    const existing = await findExistingCard(context.userId, email);
    if (existing) {
      await context.supabase.rpc("confirm_tutor_claim", { p_tutor_id: existing.id });
      return {
        ok: true as const,
        applicationId: null,
        tutorCode: existing.tutor_code,
        tutorId: existing.id,
        published: existing.is_published === true,
        handle: profile?.handle ?? null,
      };
    }

    const phone = profile?.phone?.trim() || data.phone;
    if (!phoneIsValid(phone)) throw new Error("Enter a valid phone number.");
    if (!profile?.phone) {
      await supabaseAdmin.from("profiles").update({ phone }).eq("id", context.userId);
    }

    const application = buildActivationApplication(data, {
      email,
      displayName: profile?.display_name?.trim() ?? "",
      phone,
    });
    const { storeTutorApplication } = await import("./tutor-application.server");
    const { id } = await storeTutorApplication(application);

    // Issue #214: the acceptance is fail-closed and recorded before publishing,
    // so a card can never go live without one.
    const { recordTermsAcceptance } = await import("@/features/legal/terms-acceptance.server");
    await recordTermsAcceptance({
      userId: context.userId,
      surface: referralSurfaceFor(application.referralCode),
      subjectId: id,
    });

    const published = await publishTutorCardFromApplication(id);

    // The application email is this account's email, so the claim's own check passes.
    const { error: claimError } = await context.supabase.rpc("confirm_tutor_claim", {
      p_tutor_id: published.tutorId,
    });
    if (claimError) console.warn("[activate-tutor-card] claim failed:", claimError.message);
    if (data.gender !== "prefer_not_to_say") {
      const { error: genderError } = await supabaseAdmin
        .from("tutors")
        .update({ gender: data.gender })
        .eq("id", published.tutorId);
      if (genderError) console.warn("[activate-tutor-card] gender failed:", genderError.message);
    }
    if (published.published) {
      await sendCardLiveEmail({
        email: published.email,
        name: published.name,
        tutorCode: published.tutorCode,
      });
    }
    return {
      ok: true as const,
      applicationId: id,
      tutorCode: published.tutorCode,
      tutorId: published.tutorId,
      published: published.published,
      handle: profile?.handle ?? null,
    };
  });
