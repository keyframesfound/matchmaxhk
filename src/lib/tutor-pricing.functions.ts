import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as React from "react";
import { render } from "@react-email/render";
import { Resend } from "resend";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TutorPriceChangeEmail } from "./email-templates/tutor-price-change";
import { getRuntimeEnv } from "./runtime-env";

/**
 * Issue #110 — self-serve pricing edits, admin safety-guardrail half. The
 * tutor dashboard already writes hourly_rate/pricing_tiers directly
 * (my-tutor-profile-section.tsx, via the tutors_owner_update RLS policy).
 * After a successful save the dashboard calls notifyTutorPriceChange with the
 * previous + new pricing so the admin team gets a lightweight
 * "tutor_price_updated" email. Notification is best-effort: it must never
 * fail the tutor's save, so every error is logged and swallowed.
 */

const RECIPIENT = "matchmaxedu@gmail.com";
const FROM = "MatchMax <noreply@matchmax.hk>";
const ADMIN_TUTORS_URL = "https://matchmax.hk/admin/tutors";

type Tier = { curriculum: string; rate: number };

function sortTiers(tiers: Tier[]): Tier[] {
  return [...tiers]
    .map((tier) => ({ curriculum: tier.curriculum.trim().toLowerCase(), rate: tier.rate }))
    .sort((a, b) => a.curriculum.localeCompare(b.curriculum) || a.rate - b.rate);
}

const tierSchema = z.object({
  curriculum: z.string().trim().min(1).max(80),
  rate: z.number().int().min(0).max(100000),
});

const priceChangeInputSchema = z
  .object({
    tutorCode: z.string().trim().min(1).max(20),
    displayName: z.string().trim().max(120).default(""),
    hourlyRate: z.number().int().min(0).max(100000),
    pricingTiers: z.array(tierSchema).max(8),
    previousHourlyRate: z.number().int().min(0).max(100000),
    previousPricingTiers: z.array(tierSchema).max(8),
  })
  .refine(
    (data) =>
      data.hourlyRate !== data.previousHourlyRate ||
      JSON.stringify(sortTiers(data.pricingTiers)) !==
        JSON.stringify(sortTiers(data.previousPricingTiers)),
    { message: "Pricing is unchanged — nothing to report." },
  );

export const notifyTutorPriceChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => priceChangeInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Confirm the caller actually owns this tutor row (RLS enforces the same
    // on the UPDATE; re-checking here keeps the notification unspoofable).
    const { data: owned, error } = await context.supabase
      .from("tutors")
      .select("id")
      .eq("user_id", context.userId)
      .eq("tutor_code", data.tutorCode)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!owned) throw new Error("Forbidden");

    const apiKey = getRuntimeEnv("RESEND_API_KEY");
    if (!apiKey) {
      console.error("[tutor-price-change] RESEND_API_KEY missing; notification email skipped");
      return { ok: true as const, notified: false };
    }

    const element = React.createElement(TutorPriceChangeEmail, {
      displayName: data.displayName || data.tutorCode,
      tutorCode: data.tutorCode,
      previousHourlyRate: data.previousHourlyRate,
      previousTiers: data.previousPricingTiers,
      newHourlyRate: data.hourlyRate,
      newTiers: data.pricingTiers,
      adminUrl: ADMIN_TUTORS_URL,
    });
    const html = await render(element);
    const text = [
      `Tutor pricing updated — ${data.displayName || data.tutorCode}`,
      "",
      "Previous:",
      `Flat rate: HK$${data.previousHourlyRate}/hr`,
      ...(data.previousPricingTiers.length
        ? data.previousPricingTiers.map((tier) => `${tier.curriculum}: HK$${tier.rate}/hr`)
        : ["(no curriculum rates)"]),
      "",
      "New:",
      `Flat rate: HK$${data.hourlyRate}/hr`,
      ...(data.pricingTiers.length
        ? data.pricingTiers.map((tier) => `${tier.curriculum}: HK$${tier.rate}/hr`)
        : ["(no curriculum rates)"]),
      "",
      `Review: ${ADMIN_TUTORS_URL}`,
    ].join("\n");

    try {
      const { error: sendError } = await new Resend(apiKey).emails.send({
        from: FROM,
        to: RECIPIENT,
        subject: `Tutor pricing updated — ${data.displayName || data.tutorCode}`,
        html,
        text,
      });
      if (sendError) {
        console.error("[tutor-price-change] notification email failed:", sendError.message);
        return { ok: true as const, notified: false };
      }
    } catch (sendError) {
      console.error("[tutor-price-change] notification email failed:", sendError);
    }
    return { ok: true as const, notified: true };
  });
