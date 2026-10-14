import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeSuggestedRates, type SuggestedRates } from "@/features/tutors/rates";

/**
 * Issue #319 — Suggest a rate. Finds live cards sharing at least one of the
 * tutor's curricula or subjects, takes the median online and in-person base
 * rate of the 100 most recently updated similar cards (excluding this tutor's
 * own card), rounds each to the nearest $10. Fewer than ten similar cards
 * means "not enough data yet" and fills nothing. Never suggests extra rows —
 * a custom label has no market rate to query.
 */

const suggestRatesInputSchema = z.object({
  tutorCode: z.string().trim().min(1).max(20),
  subjects: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
  curricula: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
});

const SUGGEST_SAMPLE_LIMIT = 100;
const SUGGEST_MIN_SIMILAR = 10;

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export const suggestTutorRates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => suggestRatesInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<SuggestedRates> => {
    // Confirm the caller actually owns this tutor row (the button only reads
    // public data, but the suggestion must exclude the caller's own card and
    // be anchored to a card they own).
    const { data: owned, error } = await context.supabase
      .from("tutors")
      .select("id, subjects, pricing_tiers")
      .eq("user_id", context.userId)
      .eq("tutor_code", data.tutorCode)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!owned) throw new Error("Forbidden");

    const ownSubjectKeys = new Set(
      ((owned.subjects as string[] | null) ?? []).map(normalizeKey).filter(Boolean),
    );
    for (const curriculum of data.subjects) ownSubjectKeys.add(normalizeKey(curriculum));

    const ownCurriculumKeys = new Set(data.curricula.map(normalizeKey).filter(Boolean));
    const ownTiers = Array.isArray(owned.pricing_tiers) ? owned.pricing_tiers : [];
    for (const tier of ownTiers) {
      const curriculum = normalizeKey(String((tier as { curriculum?: string })?.curriculum ?? ""));
      if (curriculum) ownCurriculumKeys.add(curriculum);
    }

    const { data: cards, error: cardsError } = await context.supabase
      .from("tutors")
      .select("online_rate, inperson_rate, subjects, pricing_tiers")
      .eq("is_published", true)
      .neq("tutor_code", data.tutorCode)
      .order("updated_at", { ascending: false })
      .limit(SUGGEST_SAMPLE_LIMIT);
    if (cardsError) throw new Error(cardsError.message);

    const similar = (cards ?? []).filter((card) => {
      const subjects = ((card.subjects as string[] | null) ?? []).map(normalizeKey);
      if (subjects.some((subject) => subject && ownSubjectKeys.has(subject))) return true;
      const tiers = Array.isArray(card.pricing_tiers) ? card.pricing_tiers : [];
      return tiers.some((tier) => {
        const curriculum = normalizeKey(
          String((tier as { curriculum?: string })?.curriculum ?? ""),
        );
        return curriculum && ownCurriculumKeys.has(curriculum);
      });
    });

    return computeSuggestedRates(similar);
  });
