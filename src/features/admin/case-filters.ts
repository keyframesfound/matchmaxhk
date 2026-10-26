/**
 * Issue #71, structured filters for the staff case queue (/admin/cases).
 *
 * Pure parse/serialize/match helpers only; the route owns the URL wiring
 * (validateSearch + navigate) and the select UI. All matching is
 * CLIENT-SIDE over the already-fetched rows (the route loads every case
 * today), there is deliberately no server-side filter fn.
 *
 * TanStack gotcha this parse layer is built around: URL search params are
 * JSON-decoded, so a hand-typed ?status=1 arrives as NUMBER 1 and
 * ?status=true as boolean true. Every param goes through asString()
 * first; closed-vocabulary params are then validated against their enum
 * and unknown values drop to the default, so hand-typed or shared URLs
 * behave exactly like in-app toggles.
 */

import {
  CASE_STATUSES,
  caseBudgetHkdBounds,
  type CaseRow,
  type CaseStatus,
} from "@/features/cases/admin/shared";
import { deskBucketForTier, type DeskBucket } from "@/features/cases/priority-tier";
import {
  ADMISSIONS_CURRICULUM,
  EXAM_SYSTEM_OPTIONS,
  LEVEL_OPTIONS,
} from "@/features/cases/case-options";

/** Lesson-mode values as stored on tutoring_cases.mode. */
export type CaseModeValue = CaseRow["mode"];

/**
 * HKD hourly-rate bands over the case budget. IDs double as the URL
 * value (?rate=100-200). Edges follow the plain labels (see
 * caseRateBandId): under 100, 100–200 incl., up to 300 incl., 300+.
 */
export type CaseRateBandId = "lt100" | "100-200" | "200-300" | "gte300";

/** Created-date presets, no date pickers, this is a staff tool. */
export type CaseCreatedPreset = "7d" | "30d";

/** Full in-memory filter model; every field is always populated. */
export type CaseFilters = {
  /** Free-text search over code/title/contact/subjects/tags. */
  q: string;
  status: CaseStatus | "all";
  /**
   * Issue #438 desk view: Active Desk = UNASSIGNED + P1 + P2 (the default),
   * Hold/Review = P3 + P4. Orthogonal to the compliance_hold STATUS above.
   */
  desk: DeskBucket;
  /** Row tag; "all" = unfiltered. */
  tag: string;
  /** tutoring_cases.exam_system (curriculum); "all" = unfiltered. */
  curriculum: string;
  /** Multi-select; a row matches when it includes ANY chosen subject. */
  subjects: string[];
  /** tutoring_cases.student_level; "all" = unfiltered. */
  level: string;
  mode: CaseModeValue | "all";
  /** MTR station / area as stored on tutoring_cases.district. */
  district: string;
  rateBand: CaseRateBandId | "all";
  created: CaseCreatedPreset | "all";
};

export const DEFAULT_CASE_FILTERS: CaseFilters = {
  q: "",
  status: "all",
  desk: "active",
  tag: "all",
  curriculum: "all",
  subjects: [],
  level: "all",
  mode: "all",
  district: "all",
  rateBand: "all",
  created: "all",
};

/** The Clear-all target: a filter model with every filter reset. */
export const CLEAR_ALL: CaseFilters = { ...DEFAULT_CASE_FILTERS, subjects: [] };

/** URL-shaped search state, what validateSearch stores and navigate accepts. */
export type CaseFiltersSearch = {
  q?: string;
  status?: string;
  /** Issue #438 desk view; "active" is the default and never serialized. */
  desk?: string;
  tag?: string;
  curriculum?: string;
  /** Comma-joined multi-select (?subjects=Math,Physics). */
  subjects?: string;
  level?: string;
  mode?: string;
  district?: string;
  rate?: string;
  created?: string;
};

/** Lesson-mode values, in the order the route renders them. */
export const CASE_MODE_VALUES: CaseModeValue[] = ["online", "in_person", "either"];

/** Rate-band ids in render order, "all" sentinel first. */
export const CASE_RATE_BANDS: {
  id: CaseRateBandId | "all";
  min: number | null;
  max: number | null;
}[] = [
  { id: "all", min: null, max: null },
  { id: "lt100", min: null, max: 100 },
  { id: "100-200", min: 100, max: 200 },
  { id: "200-300", min: 200, max: 300 },
  { id: "gte300", min: 300, max: null },
];

/** Created presets in render order, "all" sentinel first. */
export const CASE_CREATED_PRESETS: (CaseCreatedPreset | "all")[] = ["all", "7d", "30d"];

/** Accepted aliases for the created preset, incl. the bare-number form a
 * hand-typed ?created=7 arrives as (JSON-decoded to number 7). */
const CREATED_ALIASES: Record<string, CaseCreatedPreset> = {
  "7d": "7d",
  "7": "7d",
  "30d": "30d",
  "30": "30d",
};

/** Issue #438 desk view values (?desk=hold). */
const DESK_BUCKETS: DeskBucket[] = ["active", "hold"];

const RATE_BAND_IDS: CaseRateBandId[] = ["lt100", "100-200", "200-300", "gte300"];

/** Cap on selected subjects kept in one URL, junk guard, not a UX limit. */
const MAX_SELECTED_SUBJECTS = 8;

/**
 * TanStack JSON-decodes search params (?x=1 → number, ?x=true → boolean).
 * Coerce every param to string first; validation downstream rejects junk.
 */
function asString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  return null;
}

function oneOf<T extends string>(value: string, allowed: readonly T[]): T | null {
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/**
 * Subjects accept the comma-joined form (?subjects=Math,Physics), the
 * repeated-param form (?subjects=Math&subjects=Physics, JSON-decoded to
 * an array), or a single value. A bare number/boolean scalar (?subjects=1
 * / ?subjects=true) is a flag, not a subject list, dropped.
 */
function parseSubjects(raw: unknown): string[] {
  // A bare number/boolean scalar (?subjects=1 / ?subjects=true) is a
  // flag, not a subject list, only a string or an array carries values.
  const list: unknown[] = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  const rawList = list.map((item) => asString(item));
  const picked: string[] = [];
  for (const entry of rawList) {
    if (!entry) continue;
    for (const piece of entry.split(",")) {
      const subject = piece.trim();
      if (!subject || picked.includes(subject)) continue;
      picked.push(subject);
      if (picked.length >= MAX_SELECTED_SUBJECTS) return picked;
    }
  }
  return picked;
}

/**
 * Parse raw URL search params into the full filter model (defaults
 * filled). Tolerant of string | number | boolean param values; unknown
 * values drop to their default instead of throwing.
 */
export function parseCaseFilters(raw: Record<string, unknown>): CaseFilters {
  const filters: CaseFilters = { ...DEFAULT_CASE_FILTERS, subjects: [] };

  const q = asString(raw.q);
  if (q !== null && q.trim()) filters.q = q.trim();

  const status = asString(raw.status);
  const statusHit = status ? oneOf(status, CASE_STATUSES) : null;
  if (statusHit) filters.status = statusHit;

  // Issue #438 desk view: unknown/junk values drop to the Active default so
  // a hand-typed ?desk=yesterday behaves like the in-app default.
  const desk = asString(raw.desk);
  const deskHit = desk ? oneOf(desk, DESK_BUCKETS) : null;
  if (deskHit) filters.desk = deskHit;

  const tag = asString(raw.tag);
  if (tag !== null && tag.trim()) filters.tag = tag.trim();

  // Open vocabulary: legacy rows carry values beyond EXAM_SYSTEM_OPTIONS
  // ("Admissions", "Local Primary"), so pass any non-empty string through.
  const curriculum = asString(raw.curriculum);
  if (curriculum !== null && curriculum.trim()) filters.curriculum = curriculum.trim();

  filters.subjects = parseSubjects(raw.subjects);

  const level = asString(raw.level);
  if (level !== null && level.trim()) filters.level = level.trim();

  const mode = asString(raw.mode);
  if (mode) {
    // Accept the hyphenated spelling a hand-typed URL would use.
    const normalized = oneOf(mode.replace(/-/g, "_"), CASE_MODE_VALUES);
    if (normalized) filters.mode = normalized;
  }

  const district = asString(raw.district);
  if (district !== null && district.trim()) filters.district = district.trim();

  const rate = asString(raw.rate);
  const rateHit = rate ? oneOf(rate, RATE_BAND_IDS) : null;
  if (rateHit) filters.rateBand = rateHit;

  const created = asString(raw.created);
  if (created) {
    const preset = CREATED_ALIASES[created];
    if (preset) filters.created = preset;
  }

  return filters;
}

/**
 * Serialize filters for the URL: stable key order, defaults omitted so
 * in-app URLs stay clean. Output is exactly what validateSearch stores,
 * so navigate({ search: caseFiltersToSearch(...) }) round-trips.
 */
export function caseFiltersToSearch(filters: CaseFilters): CaseFiltersSearch {
  const out: CaseFiltersSearch = {};
  if (filters.q.trim()) out.q = filters.q.trim();
  if (filters.status !== "all") out.status = filters.status;
  if (filters.desk !== "active") out.desk = filters.desk;
  if (filters.tag !== "all") out.tag = filters.tag;
  if (filters.curriculum !== "all") out.curriculum = filters.curriculum;
  if (filters.subjects.length > 0) out.subjects = filters.subjects.join(",");
  if (filters.level !== "all") out.level = filters.level;
  if (filters.mode !== "all") out.mode = filters.mode;
  if (filters.district !== "all") out.district = filters.district;
  if (filters.rateBand !== "all") out.rate = filters.rateBand;
  if (filters.created !== "all") out.created = filters.created;
  return out;
}

/**
 * Which rate band a case's HKD budget falls in, or null when no budget
 * is set (a budgetless case matches no band, only "any" shows it).
 * The representative rate is the most the parent will pay
 * (max ?? min, the same value the admin table's Budget column leads
 * with, HKD-normalized like the rest of the admin surface). Edges follow
 * the plain labels: under 100, 100 up to and including 200, over 200 up
 * to and including 300, over 300, so a parent paying 150–200 shows
 * under "HK$100–200", not "HK$200–300".
 */
export function caseRateBandId(bounds: {
  min: number | null;
  max: number | null;
}): CaseRateBandId | null {
  const rate = bounds.max ?? bounds.min;
  if (rate === null) return null;
  if (rate < 100) return "lt100";
  if (rate <= 200) return "100-200";
  if (rate <= 300) return "200-300";
  return "gte300";
}

export type CaseFilterOptions = {
  curricula: string[];
  subjects: string[];
  levels: string[];
  districts: string[];
  tags: string[];
};

/**
 * Dropdown vocabularies: the form's known constants first (stable
 * declared order), then any legacy/free-text values found in the queue.
 * Subjects/districts/tags are row-derived, the full form subject pool
 * is huge and staff only filter what is actually in the queue.
 */
export function caseFilterOptions(rows: CaseRow[]): CaseFilterOptions {
  const uniq = (values: (string | null | undefined)[]): string[] => {
    const set = new Set<string>();
    for (const value of values) {
      const trimmed = (value ?? "").trim();
      if (trimmed) set.add(trimmed);
    }
    return [...set];
  };
  const sorted = (values: string[]): string[] => [...values].sort((a, b) => a.localeCompare(b));

  return {
    curricula: uniq([
      ...EXAM_SYSTEM_OPTIONS.map((option) => option.value),
      ADMISSIONS_CURRICULUM,
      ...rows.map((row) => row.exam_system),
    ]),
    subjects: sorted(uniq(rows.flatMap((row) => row.subjects ?? []))),
    levels: uniq([
      ...LEVEL_OPTIONS.map((option) => option.value),
      ...rows.map((row) => row.student_level),
    ]),
    districts: sorted(uniq(rows.map((row) => row.district))),
    tags: sorted(uniq(rows.flatMap((row) => row.tags ?? []))),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function createdCutoffMs(preset: CaseFilters["created"], now: Date): number | null {
  if (preset === "7d") return now.getTime() - 7 * DAY_MS;
  if (preset === "30d") return now.getTime() - 30 * DAY_MS;
  return null;
}

/**
 * Filter rows client-side, the same predicate shape the route's useMemo
 * used before #71 (status / tag / free-text search), extended with the
 * structured filters. `now` is injectable so the date presets are
 * testable deterministically; the cutoff is inclusive (a case received
 * exactly 7 days ago still counts as last-7-days).
 */
export function applyCaseFilters(
  rows: CaseRow[],
  filters: CaseFilters,
  now: Date = new Date(),
): CaseRow[] {
  const q = filters.q.trim().toLowerCase();
  const cutoffMs = createdCutoffMs(filters.created, now);

  return rows.filter((row) => {
    // Issue #438 desk split runs FIRST: Active Desk (default) hides P3/P4,
    // Hold/Review shows only P3/P4. Pre-migration rows carry no tier and
    // bucket as UNASSIGNED → Active, so nothing disappears post-migration.
    if (deskBucketForTier(row.priority_tier) !== filters.desk) return false;
    if (filters.status !== "all" && row.status !== filters.status) return false;
    if (filters.tag !== "all" && !(row.tags ?? []).includes(filters.tag)) return false;
    if (filters.curriculum !== "all" && (row.exam_system ?? "").trim() !== filters.curriculum) {
      return false;
    }
    if (
      filters.subjects.length > 0 &&
      !filters.subjects.some((subject) => (row.subjects ?? []).includes(subject))
    ) {
      return false;
    }
    if (filters.level !== "all" && (row.student_level ?? "").trim() !== filters.level) {
      return false;
    }
    if (filters.mode !== "all" && row.mode !== filters.mode) return false;
    if (filters.district !== "all" && (row.district ?? "").trim() !== filters.district) {
      return false;
    }
    if (
      filters.rateBand !== "all" &&
      caseRateBandId(caseBudgetHkdBounds(row)) !== filters.rateBand
    ) {
      return false;
    }
    if (cutoffMs !== null && new Date(row.created_at).getTime() < cutoffMs) return false;
    if (q) {
      const matches =
        (row.case_code ?? "").toLowerCase().includes(q) ||
        (row.title ?? "").toLowerCase().includes(q) ||
        (row.contact_name ?? "").toLowerCase().includes(q) ||
        (row.contact_phone ?? "").toLowerCase().includes(q) ||
        (row.subjects ?? []).some((s) => (s ?? "").toLowerCase().includes(q)) ||
        (row.tags ?? []).some((t) => (t ?? "").toLowerCase().includes(q));
      if (!matches) return false;
    }
    return true;
  });
}

/** True when nothing is filtered, drives the Clear-all visibility. */
export function isDefaultFilters(filters: CaseFilters): boolean {
  return (
    filters.q.trim() === "" &&
    filters.status === "all" &&
    filters.desk === "active" &&
    filters.tag === "all" &&
    filters.curriculum === "all" &&
    filters.subjects.length === 0 &&
    filters.level === "all" &&
    filters.mode === "all" &&
    filters.district === "all" &&
    filters.rateBand === "all" &&
    filters.created === "all"
  );
}
