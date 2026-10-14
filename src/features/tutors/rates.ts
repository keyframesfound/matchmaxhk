import { contactFilterError } from "@/lib/contact-filter";

/**
 * Issue #319 — Lowest rate on the card, full rates on the profile.
 *
 * Pure helpers shared by the join form, the profile editor, the suggest-a-rate
 * server fn and the vitest suite. The DB trigger (migration
 * 20261014120000_tutor_rate_floor.sql) owns the card-floor snapshot
 * (min_hourly_rate_hkd); these helpers own the same rules at the form layer.
 */

export const RATE_MIN = 50;
export const RATE_MAX = 3000;
export const MAX_RATE_ROWS = 6;
export const RATE_ROW_LABEL_MAX = 30;
export const TRAVEL_NOTE_MAX = 80;
export const RATE_NOTE_MAX = 120;

/** Headline cap (issue #323). */
export const ACADEMIC_HEADLINE_MAX = 40;

export type TutorRateRow = { label: string; rate: number };

/** Whole dollars inside the 50-3000 band — $49 and $3001 are rejected. */
export function isValidTutorRate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= RATE_MIN &&
    value <= RATE_MAX
  );
}

export type NormalizedRateRows =
  | { ok: true; rows: TutorRateRow[] }
  | { ok: false; rows: TutorRateRow[]; errors: string[] };

/**
 * Extra rate rows (profile-only): a row saves only when BOTH the label and
 * the rate are filled; a half-filled row is rejected, not silently trimmed.
 * Completely empty rows are dropped. Max six rows.
 */
export function normalizeTutorRateRows(
  rows: { label?: string | null; rate?: number | string | null }[],
): NormalizedRateRows {
  const errors: string[] = [];
  const cleaned: TutorRateRow[] = [];

  for (const [index, row] of rows.entries()) {
    const label = (row.label ?? "").trim();
    const rawRate = row.rate;
    const rate =
      typeof rawRate === "string"
        ? rawRate.trim() === ""
          ? null
          : Number(rawRate)
        : rawRate ?? null;
    const hasLabel = label.length > 0;
    const hasRate = rate !== null && rate !== undefined && Number.isFinite(rate);

    if (!hasLabel && !hasRate) continue; // completely empty rows are not stored
    if (hasLabel !== hasRate) {
      errors.push(
        hasLabel
          ? `Extra rate row ${index + 1}: enter a rate for "${label}"`
          : `Extra rate row ${index + 1}: enter a label for the rate`,
      );
      continue;
    }
    if (label.length > RATE_ROW_LABEL_MAX) {
      errors.push(`Extra rate row ${index + 1}: label must be ${RATE_ROW_LABEL_MAX} characters or fewer`);
      continue;
    }
    if (!isValidTutorRate(rate)) {
      errors.push(
        `Extra rate row ${index + 1}: rate must be a whole number between ${RATE_MIN} and ${RATE_MAX}`,
      );
      continue;
    }
    const contactError = contactFilterError(label);
    if (contactError) {
      errors.push(`Extra rate row ${index + 1}: ${contactError}`);
      continue;
    }
    cleaned.push({ label, rate: rate as number });
  }

  if (cleaned.length > MAX_RATE_ROWS) {
    return {
      ok: false,
      rows: cleaned.slice(0, MAX_RATE_ROWS),
      errors: [`At most ${MAX_RATE_ROWS} extra rate rows are saved`],
    };
  }

  return errors.length > 0 ? { ok: false, rows: cleaned, errors } : { ok: true, rows: cleaned };
}

/**
 * Issue #323 — the Smart Default headline.
 * Rule 1: `[Curriculum] [Score]` ("IBDP 44/45"); Rule 2: multiple curricula
 * join with " - "; Rule 3: curriculum with a blank score appends "Tutor";
 * Rule 4: truncate at 40 and trim trailing separator debris.
 */
export function buildSmartHeadline(
  entries: { curriculum: string; score?: string | null }[],
): string {
  const parts = entries
    .map((entry) => {
      const curriculum = entry.curriculum.trim();
      const score = (entry.score ?? "").trim();
      if (!curriculum) return "";
      return score ? `${curriculum} ${score}` : `${curriculum} Tutor`;
    })
    .filter(Boolean);

  return truncateHeadline(parts.join(" - "));
}

/** Rule 4: hard 40-char cut, then strip trailing hyphens/spaces. */
export function truncateHeadline(text: string): string {
  const cut = text.slice(0, ACADEMIC_HEADLINE_MAX);
  return cut.replace(/[\s-]+$/u, "");
}

/** Median of a rate sample; null when the sample is empty. */
export function medianRate(values: number[]): number | null {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const mid = Math.floor(clean.length / 2);
  const median =
    clean.length % 2 === 1 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
  return median;
}

/** Round a median to the nearest $10 ("suggest a rate": $250, not $247). */
export function roundRateTo10(value: number): number {
  return Math.round(value / 10) * 10;
}

export type SuggestedRates =
  | { status: "not_enough_data" }
  | { status: "ok"; online: number | null; inPerson: number | null };

/**
 * Suggest-a-rate core (issue #319): median online and in-person base rates of
 * similar live cards, each rounded to the nearest $10. Fewer than ten similar
 * cards fills nothing. Suggests base fields only — never extra rows.
 */
export function computeSuggestedRates(
  cards: { online_rate: number | null; inperson_rate: number | null }[],
): SuggestedRates {
  if (cards.length < 10) return { status: "not_enough_data" };
  const online = medianRate(
    cards.map((card) => card.online_rate).filter((rate): rate is number => rate !== null),
  );
  const inPerson = medianRate(
    cards.map((card) => card.inperson_rate).filter((rate): rate is number => rate !== null),
  );
  if (online === null && inPerson === null) return { status: "not_enough_data" };
  return {
    status: "ok",
    online: online === null ? null : roundRateTo10(online),
    inPerson: inPerson === null ? null : roundRateTo10(inPerson),
  };
}
