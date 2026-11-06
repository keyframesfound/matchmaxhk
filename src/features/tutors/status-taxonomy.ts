/**
 * Issue #658: Tutor Status taxonomy — canonical codes, legacy mapping, and
 * search backfill predicates.
 *
 * Canonical vocabulary (6 primary + 2 "More"): the SoT table in issue #658
 * §2.1. Display labels live in the i18n locale files under `tutor_status.*`.
 *
 * Legacy stored values (pre-#658 rows keep them; the DB CHECK still accepts
 * them so no data backfill is needed):
 *   - `uni_student` is a pure rename of `uni_undergrad` (same identity, same
 *     rank everywhere).
 *   - `full_part_time_tutor` is the bundled Full/Part-Time value: it renders
 *     ONE temporary chip until the tutor completes the 1-tap split
 *     (split_tutor_status RPC) and, in search, matches a `full_time` or
 *     `part_time` selection at a LOWER rank so legacy profiles stay
 *     discoverable with no Day-1 empty results (issue §2.2).
 */

export const PRIMARY_TUTOR_STATUSES = [
  "uni_undergrad",
  "part_time",
  "full_time",
  "uni_grad",
  "school_teacher",
  "examiner",
] as const;

export const MORE_TUTOR_STATUSES = ["sub_degree", "native_speaker"] as const;

export type PrimaryTutorStatus = (typeof PRIMARY_TUTOR_STATUSES)[number];
export type MoreTutorStatus = (typeof MORE_TUTOR_STATUSES)[number];
export type TutorStatusCode = PrimaryTutorStatus | MoreTutorStatus;

/** Legacy stored value that bundles Full-Time and Part-Time (issue §2.2/§2.5). */
export const LEGACY_BUNDLED_STATUS = "full_part_time_tutor";
/** Legacy stored value that is a pure rename of uni_undergrad. */
export const LEGACY_UNI_STUDENT_STATUS = "uni_student";

/** Every value the DB CHECK accepts (canonical + legacy). */
export const STORED_TUTOR_STATUSES: readonly string[] = [
  ...PRIMARY_TUTOR_STATUSES,
  ...MORE_TUTOR_STATUSES,
  LEGACY_UNI_STUDENT_STATUS,
  LEGACY_BUNDLED_STATUS,
];

/** What a stored legacy value means in the canonical vocabulary (null = not a status). */
const LEGACY_ALIASES: Record<string, TutorStatusCode> = {
  [LEGACY_UNI_STUDENT_STATUS]: "uni_undergrad",
};

const CANONICAL_SET = new Set<string>([...PRIMARY_TUTOR_STATUSES, ...MORE_TUTOR_STATUSES]);

/**
 * Canonical code for any stored `tutor_status` value, or null when the value
 * is unknown/empty. Legacy `uni_student` resolves to `uni_undergrad`; the
 * bundled legacy value does NOT resolve (it has no single canonical code).
 */
export function canonicalTutorStatus(stored: string | null | undefined): TutorStatusCode | null {
  const value = (stored ?? "").trim();
  if (!value) return null;
  if (CANONICAL_SET.has(value)) return value as TutorStatusCode;
  return LEGACY_ALIASES[value] ?? null;
}

/** True while the profile still carries the bundled Full/Part-Time value (1-tap banner condition). */
export function isLegacyBundledStatus(stored: string | null | undefined): boolean {
  return (stored ?? "").trim() === LEGACY_BUNDLED_STATUS;
}

/**
 * The status-filter vocabulary a parent URL may carry: the canonical codes
 * plus the legacy stored codes (old shared links keep working; legacy codes
 * filter by equivalence/backfill, never as new writes).
 */
export const TUTOR_STATUS_FILTER_CODES: readonly string[] = STORED_TUTOR_STATUSES;

/** Total check for one parsed filter value (unknown values are dropped, never 500). */
export function isKnownStatusFilterCode(value: string): boolean {
  return TUTOR_STATUS_FILTER_CODES.includes(value);
}

/** Codes the backfill rule expands to (empty when the selection needs no backfill). */
function backfillTargetsFor(selected: readonly string[]): Set<string> {
  const targets = new Set<string>();
  for (const code of selected) {
    targets.add(code);
    // Equivalence both ways: a legacy URL code still matches canonical rows.
    const canonical = canonicalTutorStatus(code);
    if (canonical !== null) targets.add(canonical);
    if (code === "full_time" || code === "part_time") {
      targets.add(LEGACY_BUNDLED_STATUS);
    }
  }
  return targets;
}

/**
 * Multi-select OR match for one tutor's stored status. `selected` carries the
 * parsed filter codes (canonical and/or legacy). Unknown stored values never
 * match; selecting FT or PT also matches legacy bundled profiles (backfill).
 */
export function tutorMatchesStatusFilter(
  stored: string | null | undefined,
  selected: readonly string[],
): boolean {
  const value = (stored ?? "").trim();
  if (value === "" || selected.length === 0) return false;
  const targets = backfillTargetsFor(selected);
  if (targets.has(value)) return true;
  const canonical = canonicalTutorStatus(value);
  return canonical !== null && targets.has(canonical);
}

/**
 * Search rank for the backfill rule (issue §2.2): 0 = exact match, 1 =
 * legacy bundled profile pulled in by the FT/PT backfill (sorts AFTER exact
 * matches), -1 = no match.
 */
export function tutorStatusFilterRank(
  stored: string | null | undefined,
  selected: readonly string[],
): number {
  if (!tutorMatchesStatusFilter(stored, selected)) return -1;
  const value = (stored ?? "").trim();
  if (value === LEGACY_BUNDLED_STATUS && selected.includes(LEGACY_BUNDLED_STATUS)) {
    // The parent explicitly filtered for the bundled value: exact, not backfill.
    return 0;
  }
  return value === LEGACY_BUNDLED_STATUS ? 1 : 0;
}

/**
 * The multi-select draft is carried as `status` (first pick, legacy single
 * links keep working) + `statuses_extra` ("||"-joined rest), mirroring the
 * subject/subjects_extra pattern.
 */
export function parseSelectedStatuses(
  status: string | null | undefined,
  statusesExtra: string | null | undefined,
): string[] {
  const values = [
    (status ?? "").trim(),
    ...(statusesExtra ?? "").split("||").map((value) => value.trim()),
  ]
    .filter((value) => value !== "" && isKnownStatusFilterCode(value))
    .map((value) => canonicalTutorStatus(value) ?? value);
  // Legacy `uni_student` normalizes to its canonical rename so the matching
  // chip highlights (an un-normalized alias stays invisible in the UI); the
  // bundled legacy value stays as-is — it has no single canonical target and
  // keeps its exact-match rank.
  return [...new Set(values)];
}

/** URL patch for a full multi-select pick (first pick leads, rest join with "||"). */
export function buildStatusParamPatch(selected: readonly string[]): {
  status: string | undefined;
  statuses_extra: string | undefined;
} {
  const values = [...new Set(selected.filter((value) => isKnownStatusFilterCode(value)))];
  const [first, ...rest] = values;
  return {
    status: first,
    statuses_extra: rest.length > 0 ? rest.join("||") : undefined,
  };
}

/**
 * TanStack JSON-decodes search params: ?status=1 arrives as the NUMBER 1 and
 * an absent param as null. This preprocessor is total — strings pass, finite
 * numbers stringify, everything else (booleans, null, arrays, objects) drops
 * to undefined instead of throwing on a cold load.
 */
export function parseStatusParam(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

/** "||"-joined status list param, total against every JSON-decoded shape. */
export function parseStatusListParam(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}
