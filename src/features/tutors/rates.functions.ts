import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computeSuggestedRates,
  tutorCardIsSimilar,
  type SuggestedRates,
} from "@/features/tutors/rates";

/**
 * Issue #319 — Suggest a rate. Walks published cards from most recently
 * updated, collecting up to 100 that are SIMILAR to the caller (shared
 * subject or curriculum) — the sample is similar-first, so niche subjects
 * are not crowded out by 100 unrelated recently-edited cards. Fewer than ten
 * similar cards means "not enough data yet" and fills nothing. Rounds each
 * median to the nearest $10. Never suggests extra rows — a custom label has
 * no market rate to query.
 */

const suggestRatesInputSchema = z.object({
  tutorCode: z.string().trim().min(1).max(20),
  subjects: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
  curricula: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
});

/** Target size of the similar-card sample. */
const SUGGEST_SAMPLE_LIMIT = 100;
/** PostgREST max rows per request; well under the hard 1000 cap. */
const PAGE_SIZE = 500;
/** Upper bound on pages walked before falling back to what was collected. */
const MAX_PAGES = 10;

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

    const similar: { online_rate: number | null; inperson_rate: number | null }[] = [];
    for (let page = 0; page < MAX_PAGES && similar.length < SUGGEST_SAMPLE_LIMIT; page++) {
      const { data: cards, error: cardsError } = await context.supabase
        .from("tutors")
        .select("online_rate, inperson_rate, subjects, pricing_tiers")
        .eq("is_published", true)
        .neq("tutor_code", data.tutorCode)
        .order("updated_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (cardsError) throw new Error(cardsError.message);

      for (const card of cards ?? []) {
        if (!tutorCardIsSimilar(card, ownSubjectKeys, ownCurriculumKeys, normalizeKey)) continue;
        similar.push({ online_rate: card.online_rate, inperson_rate: card.inperson_rate });
        if (similar.length >= SUGGEST_SAMPLE_LIMIT) break;
      }
      if ((cards ?? []).length < PAGE_SIZE) break;
    }

    return computeSuggestedRates(similar);
  });
