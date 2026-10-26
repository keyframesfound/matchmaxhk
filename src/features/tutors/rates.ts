import { contactFilterError } from "@/lib/contact-filter";

/**
 * Issue #319, Lowest rate on the card, full rates on the profile.
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
/** Minimum similar live cards before suggest-a-rate fills anything (issue #345). */
export const SUGGEST_MIN_SIMILAR = 10;

/**
 * #391, per-row class mode. The rate row answers "what does this rate buy":
 * `one_on_one` rows are the classic hourly quote, `small_group_2` /
 * `small_group_3_6` are per-STUDENT group rates, `intensive_bootcamp` is a
 * cram-mode rate. Group rows are profile-only extras, like every extra row
 * they never enter the card floor (#319 trigger), which is exactly the
 * floor-price protection the issue demands.
 */
export const RATE_ROW_MODES = [
  "one_on_one",
  "small_group_2",
  "small_group_3_6",
  "intensive_bootcamp",
] as const;
export type TutorRateRowMode = (typeof RATE_ROW_MODES)[number];

export const GROUP_RATE_ROW_MODES: readonly TutorRateRowMode[] = [
  "small_group_2",
  "small_group_3_6",
];

export const RATE_ROW_DESCRIPTION_MAX = 300;

export type TutorRateRow = {
  label: string;
  rate: number;
  mode?: TutorRateRowMode;
  description?: string;
};

/** True when the row quotes a per-student small-group rate. */
export function isGroupRateRow(row: { mode?: string | null }): boolean {
  return GROUP_RATE_ROW_MODES.includes(row.mode as TutorRateRowMode);
}

/**
 * Cheapest small-group per-student rate across the profile's rows, the
 * `👥 Group from HK$Y/hr` card badge figure. Null when the tutor quotes no
 * group rate.
 */
export function groupRateFloor(rows: { mode?: string | null; rate: number }[]): number | null {
  const groupRates = rows.filter(isGroupRateRow).map((row) => row.rate);
  return groupRates.length > 0 ? Math.min(...groupRates) : null;
}

/** Whole dollars inside the 50-3000 band, $49 and $3001 are rejected. */
export function isValidTutorRate(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isInteger(value) && value >= RATE_MIN && value <= RATE_MAX
  );
}

export type NormalizedRateRows =
  { ok: true; rows: TutorRateRow[] } | { ok: false; rows: TutorRateRow[]; errors: string[] };

/**
 * Extra rate rows (profile-only): a row saves only when BOTH the label and
 * the rate are filled; a half-filled row is rejected, not silently trimmed.
 * Completely empty rows are dropped. Max six rows. Mode is optional
 * (legacy rows have none); the optional 300-char description is
 * contact-filtered like the label.
 */
export function normalizeTutorRateRows(
  rows: {
    label?: string | null;
    rate?: number | string | null;
    mode?: string | null;
    description?: string | null;
  }[],
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
        : (rawRate ?? null);
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
      errors.push(
        `Extra rate row ${index + 1}: label must be ${RATE_ROW_LABEL_MAX} characters or fewer`,
      );
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
    const cleanedRow: TutorRateRow = { label, rate: rate as number };
    const rawMode = (row.mode ?? "").trim();
    if (rawMode) {
      if (!(RATE_ROW_MODES as readonly string[]).includes(rawMode)) {
        errors.push(`Extra rate row ${index + 1}: unknown class mode`);
        continue;
      }
      cleanedRow.mode = rawMode as TutorRateRowMode;
    }
    const description = (row.description ?? "").trim();
    if (description) {
      if (description.length > RATE_ROW_DESCRIPTION_MAX) {
        errors.push(
          `Extra rate row ${index + 1}: description must be ${RATE_ROW_DESCRIPTION_MAX} characters or fewer`,
        );
        continue;
      }
      const descriptionContactError = contactFilterError(description);
      if (descriptionContactError) {
        errors.push(`Extra rate row ${index + 1}: ${descriptionContactError}`);
        continue;
      }
      cleanedRow.description = description;
    }
    cleaned.push(cleanedRow);
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

/** Median of a rate sample; null when the sample is empty. */
export function medianRate(values: number[]): number | null {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const mid = Math.floor(clean.length / 2);
  const median = clean.length % 2 === 1 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
  return median;
}

/** Round a median to the nearest $10 ("suggest a rate": $250, not $247). */
export function roundRateTo10(value: number): number {
  return Math.round(value / 10) * 10;
}

export type SuggestedRates =
  { status: "not_enough_data" } | { status: "ok"; online: number | null; inPerson: number | null };

/**
 * Similarity for the suggest-a-rate sample (issue #319): a live card shares
 * at least one subject or curriculum with the caller. Keys are pre-normalized
 * by the caller; `normalizeKey` is injected so the function stays pure.
 */
export function tutorCardIsSimilar(
  card: { subjects: unknown; pricing_tiers: unknown },
  subjectKeys: Set<string>,
  curriculumKeys: Set<string>,
  normalizeKey: (value: string) => string,
): boolean {
  const subjects = Array.isArray(card.subjects)
    ? (card.subjects as unknown[]).map((s) => normalizeKey(String(s)))
    : [];
  if (subjects.some((subject) => subject && subjectKeys.has(subject))) return true;
  const tiers = Array.isArray(card.pricing_tiers) ? card.pricing_tiers : [];
  return tiers.some((tier) => {
    const curriculum = normalizeKey(String((tier as { curriculum?: string })?.curriculum ?? ""));
    return Boolean(curriculum) && curriculumKeys.has(curriculum);
  });
}

/**
 * Suggest-a-rate core (issue #319): median online and in-person base rates of
 * similar live cards, each rounded to the nearest $10. Fewer than
 * SUGGEST_MIN_SIMILAR similar cards fills nothing. Suggests base fields
 * only, never extra rows.
 */
export function computeSuggestedRates(
  cards: { online_rate: number | null; inperson_rate: number | null }[],
): SuggestedRates {
  if (cards.length < SUGGEST_MIN_SIMILAR) return { status: "not_enough_data" };
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
