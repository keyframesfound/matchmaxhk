/**
 * #528 L1 retention: low-friction fit data (Phase A).
 *
 * Optional soft tags on the tutor profile and the parent's case (< 15s, ENUM),
 * one required fit-reason tag when a stop after Lesson 1 is verified, and a
 * soft matching hint for the desk. Never a long survey; nothing here claims
 * to observe the lesson.
 */
import type { DropReasonClass, OutcomeKind, DropVerification } from "@/features/cases/fee-drop";

export const TEACHING_STYLES = ["EXAM_DRILLING", "CONCEPT_PATIENCE", "HOMEWORK_COACHING"] as const;
export const MATERIALS_POLICIES = ["PROVIDES_OWN_NOTES", "USES_SCHOOL_MATERIALS"] as const;
export const VIBE_PREFERENCES = ["STRICT_DISCIPLINED", "WARM_ENCOURAGING"] as const;
export const HOMEWORK_EXPECTATIONS = ["WEEKLY_EXTRA_HOMEWORK", "IN_CLASS_ONLY"] as const;

export type TeachingStyle = (typeof TEACHING_STYLES)[number];
export type MaterialsPolicy = (typeof MATERIALS_POLICIES)[number];
export type VibePreference = (typeof VIBE_PREFERENCES)[number];
export type HomeworkExpectation = (typeof HOMEWORK_EXPECTATIONS)[number];

export type FitTags = {
  teachingStyle: TeachingStyle | null;
  materialsPolicy: MaterialsPolicy | null;
  vibe: VibePreference | null;
  homework: HomeworkExpectation | null;
};

export const FIT_TAG_KEYS = ["teachingStyle", "materialsPolicy", "vibe", "homework"] as const;
export type FitTagKey = (typeof FIT_TAG_KEYS)[number];

export const FIT_TAG_OPTIONS: { [K in FitTagKey]: readonly NonNullable<FitTags[K]>[] } = {
  teachingStyle: TEACHING_STYLES,
  materialsPolicy: MATERIALS_POLICIES,
  vibe: VIBE_PREFERENCES,
  homework: HOMEWORK_EXPECTATIONS,
};

/** DB column names: tutors.<tutor>, tutoring_cases.<case>. */
export const FIT_TAG_COLUMNS: Record<FitTagKey, { tutor: string; case: string }> = {
  teachingStyle: { tutor: "teaching_style", case: "pref_teaching_style" },
  materialsPolicy: { tutor: "materials_policy", case: "pref_materials_policy" },
  vibe: { tutor: "vibe_preference", case: "pref_vibe" },
  homework: { tutor: "homework_expectation", case: "pref_homework" },
};

export const DROP_FIT_REASONS = [
  "STYLE_TOO_LENIENT",
  "STYLE_TOO_STRICT",
  "NO_CUSTOM_MATERIALS",
  "PACE_MISMATCH",
  "COMMUNICATION_GAP",
  "TUTOR_UNPREPARED",
  "SCHEDULE_CHANGE",
  "TUTOR_QUIT",
  "OTHER",
] as const;
export type DropFitReason = (typeof DROP_FIT_REASONS)[number];

export const EMPTY_FIT_TAGS: FitTags = {
  teachingStyle: null,
  materialsPolicy: null,
  vibe: null,
  homework: null,
};

function oneOfOrNull<T extends string>(values: readonly T[], value: unknown): T | null {
  return (values as readonly unknown[]).includes(value) ? (value as T) : null;
}

/** Read tags from a tutors or tutoring_cases row; junk falls back to null. */
export function fitTagsFromRow(row: Record<string, unknown>, side: "tutor" | "case"): FitTags {
  return {
    teachingStyle: oneOfOrNull(TEACHING_STYLES, row[FIT_TAG_COLUMNS.teachingStyle[side]]),
    materialsPolicy: oneOfOrNull(MATERIALS_POLICIES, row[FIT_TAG_COLUMNS.materialsPolicy[side]]),
    vibe: oneOfOrNull(VIBE_PREFERENCES, row[FIT_TAG_COLUMNS.vibe[side]]),
    homework: oneOfOrNull(HOMEWORK_EXPECTATIONS, row[FIT_TAG_COLUMNS.homework[side]]),
  };
}

export function fitTagsToRow(tags: FitTags, side: "tutor" | "case"): Record<string, string | null> {
  return Object.fromEntries(FIT_TAG_KEYS.map((k) => [FIT_TAG_COLUMNS[k][side], tags[k]]));
}

export type FitHint = {
  matches: FitTagKey[];
  mismatches: FitTagKey[];
  /** Both set and different on materials: hard-filter out of suggestions. */
  hardBlock: boolean;
  /** Tags set on both sides; 0 means no signal, not a bad fit. */
  compared: number;
};

/** Soft matching hint for admin / suggest. Unset tags never count against. */
export function fitHint(tutor: FitTags, parent: FitTags): FitHint {
  const matches: FitTagKey[] = [];
  const mismatches: FitTagKey[] = [];
  for (const key of FIT_TAG_KEYS) {
    const t = tutor[key];
    const p = parent[key];
    if (t === null || p === null) continue;
    (t === p ? matches : mismatches).push(key);
  }
  return {
    matches,
    mismatches,
    hardBlock: mismatches.includes("materialsPolicy"),
    compared: matches.length + mismatches.length,
  };
}

/** Pre-select for the desk: tutor-side reason classes map straight across. */
export function defaultFitReason(reasonClass: DropReasonClass | null): DropFitReason | null {
  switch (reasonClass) {
    case "tutor_flake":
    case "tutor_emergency":
      return "TUTOR_QUIT";
    case "tutor_fault":
      return "TUTOR_UNPREPARED";
    default:
      return null;
  }
}

export type FitReasonError = "FIT_REASON_REQUIRED";

/** One fit tag is required when a stop after L1 is recorded as verified. */
export function fitReasonError(input: {
  kind: OutcomeKind;
  verification: DropVerification | null;
  fitReason: DropFitReason | null;
}): FitReasonError | null {
  if (input.kind !== "stopped_after_l1" || input.verification !== "verified") return null;
  return input.fitReason ? null : "FIT_REASON_REQUIRED";
}

/**
 * #528 §1 tutor L1 quit: own it, rematch in 24–48h at no extra cost, and no
 * cash refund of tuition paid to the tutor. Copy for Tim / Austin / #512.
 */
export function tutorQuitRematchMessage(input: { caseCode: string; emergency: boolean }): string {
  const opener = input.emergency
    ? "Your tutor has had to stop for an emergency, and we're sorry for the disruption."
    : "Your tutor has let us know they can't continue, and we're sorry. That's on us to fix.";
  return [
    opener,
    `We're already shortlisting replacement tutors for case ${input.caseCode}, briefed on how Lesson 1 went, so you don't need to repeat yourself.`,
    "You'll have options within 24 to 48 hours, at no extra cost to you.",
    "Is the same time and format still good for you?",
  ].join(" ");
}
