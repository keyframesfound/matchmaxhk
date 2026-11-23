/**
 * #783 §2.6 item 8: pre-match risk holds on book, as rules not an LLM.
 *
 * Two signals route a parent request to compliance_hold before it can reach
 * the board:
 *  - a venue that reads as an industrial building, hotel or guesthouse,
 *  - a late-night session requested for an adult with a specific tutor gender.
 *
 * The result is advisory only in the sense that staff still review the held
 * case; nothing here blocks the parent from submitting, and no money or
 * matching decision is made.
 */

export type PrematchRiskInput = {
  notes?: string | null;
  locationEstate?: string | null;
  schoolType?: string | null;
  scheduleNote?: string | null;
  /** "Kindergarten" | "Primary" | "Secondary" | "University". */
  academicLevel?: string | null;
  /** "my_child" | "myself" | "someone_else". */
  whoFor?: string | null;
  /** "any" | "male" | "female". */
  preferredGender?: string | null;
};

export type PrematchRisk = { hold: boolean; reasons: string[] };

const VENUE_PATTERN =
  /\b(industrial\s+(building|unit|estate)|factory\s+(building|unit)|hotel|guest\s*house|hostel|motel|love\s*hotel)\b|工廈|工廠大廈|工業大廈|酒店|賓館|旅館|時鐘酒店/i;

const LATE_NIGHT_PATTERNS: RegExp[] = [
  /\b(10|11|12)\s*(pm|p\.m\.?)\b/i,
  /\b(1|2|3|4|5)\s*(am|a\.m\.?)\b/i,
  /\b2[2-3]:[0-5]\d\b/,
  /\b0[0-5]:[0-5]\d\b/,
  /深夜|凌晨|午夜/,
];

function textOf(...values: (string | null | undefined)[]): string {
  return values.filter((v): v is string => typeof v === "string").join(" \n ");
}

export function hasVenueRisk(input: PrematchRiskInput): boolean {
  return VENUE_PATTERN.test(textOf(input.notes, input.locationEstate, input.schoolType));
}

export function hasLateNightPattern(input: PrematchRiskInput): boolean {
  const text = textOf(input.notes, input.scheduleNote);
  return LATE_NIGHT_PATTERNS.some((pattern) => pattern.test(text));
}

export function isAdultRequest(input: PrematchRiskInput): boolean {
  return (
    input.academicLevel === "University" ||
    input.whoFor === "myself" ||
    input.whoFor === "someone_else"
  );
}

export function assessPrematchRisk(input: PrematchRiskInput): PrematchRisk {
  const reasons: string[] = [];
  if (hasVenueRisk(input)) {
    reasons.push("venue_industrial_or_hotel");
  }
  if (
    hasLateNightPattern(input) &&
    isAdultRequest(input) &&
    (input.preferredGender === "male" || input.preferredGender === "female")
  ) {
    reasons.push("late_night_adult_specific_gender");
  }
  return { hold: reasons.length > 0, reasons };
}
