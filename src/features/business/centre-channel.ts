/**
 * #815 §2.2 / §2.3: pure rules for the public Thin Partner Channel.
 *
 * - The "Verified Partner" badge shows only when staff approved the
 *   partnership: the organisation is active and its BR review is recorded.
 * - An affiliated tutor lists only when the affiliation is approved AND the
 *   tutor's own card is live (published, not hidden by a ban, account active).
 * - An affiliate card never carries a phone, email or WhatsApp (AC-CH-5).
 */

export type CentrePartnerState = {
  status: string | null;
  br_reviewed_at: string | null;
};

export function isVerifiedPartner(org: CentrePartnerState | null | undefined): boolean {
  return Boolean(org && org.status === "active" && org.br_reviewed_at);
}

export type AffiliateTutorRow = {
  user_id: string | null;
  tutor_code: string | null;
  display_name: string | null;
  photo_url: string | null;
  headline: string | null;
  subjects: string[] | null;
  hourly_rate: number | null;
  min_hourly_rate_hkd: number | null;
  verification_tier: string | null;
  is_published: boolean | null;
  card_hidden_by_ban: boolean | null;
  owner_account_status: string | null;
  // Any contact field that might ride along must never reach the card.
  [key: string]: unknown;
};

export type AffiliateTutorCard = {
  tutorCode: string;
  displayName: string;
  photoUrl: string | null;
  headline: string | null;
  subjects: string[];
  fromRateHkd: number | null;
  verified: boolean;
};

export function isListableAffiliate(row: AffiliateTutorRow): boolean {
  return Boolean(
    row.tutor_code &&
    row.is_published === true &&
    row.card_hidden_by_ban !== true &&
    (row.owner_account_status ?? "active") === "active",
  );
}

export function toAffiliateCard(row: AffiliateTutorRow): AffiliateTutorCard {
  const rate = row.min_hourly_rate_hkd ?? row.hourly_rate ?? null;
  return {
    tutorCode: row.tutor_code ?? "",
    displayName: (row.display_name ?? "").trim() || (row.tutor_code ?? ""),
    photoUrl: row.photo_url ?? null,
    headline: row.headline ?? null,
    subjects: (row.subjects ?? []).filter(Boolean).slice(0, 4),
    fromRateHkd: typeof rate === "number" && rate > 0 ? Math.round(rate) : null,
    verified: row.verification_tier === "tier_2_verified",
  };
}

export function affiliateCards(
  approvedUserIds: Iterable<string>,
  rows: AffiliateTutorRow[],
): AffiliateTutorCard[] {
  const approved = new Set(approvedUserIds);
  return rows
    .filter((r) => r.user_id && approved.has(r.user_id) && isListableAffiliate(r))
    .map(toAffiliateCard)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** AC-CH-3: words that turn the channel into a careers page. */
export const HIRE_LANGUAGE =
  /\b(?:hire|hiring|recruit(?:ing|ment)?|vacanc(?:y|ies)|job openings?|apply to (?:the )?centre|salary|wages?)\b|招聘|聘請|職位空缺|薪金|薪酬|應徵/i;

export function hasHireLanguage(...texts: (string | null | undefined)[]): boolean {
  return texts.some((t) => Boolean(t) && HIRE_LANGUAGE.test(t as string));
}
