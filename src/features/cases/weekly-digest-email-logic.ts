/**
 * Issue #796 §2.6 (AC-742-4) — weekly learning digest email, pure half.
 *
 * The Sunday sweep sends ONE email per parent, not one per case, so the email
 * payload is a list of per-case sections. This module owns the two decisions
 * that can be made without a database or a network:
 *
 *  - which cases belong in which parent's email (`selectDigestRecipients`),
 *    excluding quiet weeks (a null digest) and parentless cases;
 *  - what one section looks like in both languages (`buildDigestSection`),
 *    reusing the card's `digestLines` so the email and the in-app card can
 *    never disagree about a number.
 *
 * No copy is authored here: the caller passes the `weekly_digest.*` locale
 * strings already read from the JSON files, and the logic module interpolates
 * them. Free text stays scrubbed by `digestLines` (no ids, emails, phones).
 */

import { hktClock, hktDayLabel } from "@/features/cases/case-schedule";
import {
  digestLines,
  type DigestLabels,
  type WeeklyDigest,
} from "@/features/cases/weekly-digest-logic";

/** The section shape the `weekly-digest` email template renders. */
export type DigestEmailSection = {
  caseCode: string;
  url: string;
  en: string[];
  zh: string[];
};

/** One case as the sweep found it: a digest, or null on a quiet week. */
export type DigestCandidate = {
  caseId: string;
  caseCode: string;
  parentId: string | null;
  digest: WeeklyDigest | null;
};

/** A case that made it into its parent's email. */
export type DigestRecipientCase = {
  caseId: string;
  caseCode: string;
  digest: WeeklyDigest;
};

/** Sunday-evening sends use the same case link the card's copy button does. */
export function digestCaseUrl(caseCode: string): string {
  return `https://matchmax.hk/calendar?case=${caseCode}`;
}

/** "Tue, 10 Nov 18:30" in HKT, in the block's language (no host timezone). */
function formatWhen(iso: string, zone: "en" | "zh"): string {
  const locale = zone === "zh" ? "zh-HK" : "en";
  return `${hktDayLabel(iso, locale)} ${hktClock(iso)}`;
}

/**
 * One case's block in both languages, ending with the case link.
 *
 * The lines come from `digestLines` (the card's own formatter), so this adds
 * only the URL — no second copy of the numbers, no re-rounding.
 */
export function buildDigestSection(input: {
  digest: WeeklyDigest;
  caseCode: string;
  labels: { en: DigestLabels; zh: DigestLabels };
}): DigestEmailSection {
  const url = digestCaseUrl(input.caseCode);
  const digest = input.digest;
  // The template prints its own "Case <code>" heading, so the section skips
  // the WhatsApp block's header + case preamble.
  const en = digestLines({
    digest,
    zone: "en",
    labels: input.labels.en,
    caseCode: input.caseCode,
    formatWhen,
    includePreamble: false,
  });
  const zh = digestLines({
    digest,
    zone: "zh",
    labels: input.labels.zh,
    caseCode: input.caseCode,
    formatWhen,
    includePreamble: false,
  });
  return { caseCode: input.caseCode, url, en: [...en, url], zh: [...zh, url] };
}

/**
 * Group cases by parent for the one-email-per-parent send.
 *
 * Only parents with at least one non-null digest appear, so a quiet week never
 * produces a send. Parents and their sections are ordered by case code, which
 * makes the payload and the logs stable across runs (the database read order
 * is not).
 */
export function selectDigestRecipients(
  cases: readonly DigestCandidate[],
): Map<string, DigestRecipientCase[]> {
  const grouped = new Map<string, DigestRecipientCase[]>();
  for (const kase of cases) {
    if (!kase.parentId || !kase.digest) continue;
    const list = grouped.get(kase.parentId) ?? [];
    list.push({ caseId: kase.caseId, caseCode: kase.caseCode, digest: kase.digest });
    grouped.set(kase.parentId, list);
  }

  const ordered = new Map<string, DigestRecipientCase[]>();
  for (const parentId of [...grouped.keys()].sort()) {
    const list = grouped.get(parentId) ?? [];
    list.sort((a, b) => (a.caseCode < b.caseCode ? -1 : a.caseCode > b.caseCode ? 1 : 0));
    ordered.set(parentId, list);
  }
  return ordered;
}
