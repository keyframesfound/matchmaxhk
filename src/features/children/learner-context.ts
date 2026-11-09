import type { TFunction } from "i18next";
import { useSyncExternalStore } from "react";

import { CHILD_LEVELS, type ChildLevel, type ChildProfile } from "./children";
import { matchesCategoryFilter, matchesSubjectQuery } from "../tutors/subjects";
import type { AcademicTier } from "../tutors/verticals";
import { CURRICULUM_OPTIONS } from "../cases/case-options";

/**
 * #698 "Who is learning?": the learner the current search session is
 * tailored for. Either one of the parent's saved children or a temporary
 * guest persona (level + curriculum + subjects). Lives in sessionStorage so
 * it is shared by Tutors search, the Case Request form and the Marketplace
 * (#700) within a visit, and never silently persists into the next visit.
 * Soft only: it re-ranks, it never hides tutors.
 */

export type LearnerContext = {
  source: "child" | "guest";
  /** students.id when source = "child". */
  childId?: string;
  name?: string;
  level: ChildLevel | null;
  /** Curriculum code from the case vocabulary (IB, DSE, IGCSE, A-Level …). */
  curriculum: string | null;
  subjects: string[];
};

/** Case-form curriculum codes a learner can carry (CURRICULUM_OPTIONS). */
export const LEARNER_CURRICULA = [
  "IB",
  "DSE",
  "IGCSE",
  "A-Level",
  "Primary School",
  "Junior Secondary",
  "Kindergarten",
  "University",
] as const;

const STORAGE_KEY = "mm_learner_ctx_v1";
const EVENT = "mm-learner-ctx";

/** Map legacy free-text child curricula ("IBDP", "HKDSE", "local") to codes. */
export function normalizeLearnerCurriculum(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if ((LEARNER_CURRICULA as readonly string[]).includes(value)) return value;
  const lower = value.toLowerCase();
  if (/\bib|ibdp|myp|international baccalaureate/.test(lower)) return "IB";
  if (/dse|hkdse/.test(lower)) return "DSE";
  if (/igcse|gcse/.test(lower)) return "IGCSE";
  if (/a[\s-]?level|gce/.test(lower)) return "A-Level";
  if (/kinder|k[1-3]\b/.test(lower)) return "Kindergarten";
  if (/primary|local/.test(lower)) return "Primary School";
  if (/universit|college|degree/.test(lower)) return "University";
  return null;
}

export function learnerFromChild(child: ChildProfile): LearnerContext {
  return {
    source: "child",
    childId: child.id,
    name: child.nickname,
    level: child.level,
    curriculum: normalizeLearnerCurriculum(child.curriculum),
    subjects: child.subjects ?? [],
  };
}

/** Funnel level (case form) for a grade level. */
export function learnerFunnelLevel(
  level: ChildLevel | null,
): "Kindergarten" | "Primary" | "Secondary" | "University" | null {
  if (!level) return null;
  if (level === "kindergarten") return "Kindergarten";
  if (level === "university") return "University";
  if (level.startsWith("p")) return "Primary";
  return "Secondary";
}

/** Junior (S1–S3, Y7–Y9) vs senior (S4–S6, Y10–Y13) secondary. */
export function learnerSecondaryBand(
  level: ChildLevel | null,
): "Junior secondary" | "Senior secondary" | null {
  if (!level) return null;
  const match = /^(s|y)(\d+)$/.exec(level);
  if (!match) return null;
  const n = Number(match[2]);
  const senior = match[1] === "s" ? n >= 4 : n >= 10;
  return senior ? "Senior secondary" : "Junior secondary";
}

export function learnerTier(level: ChildLevel | null): AcademicTier | null {
  const funnel = learnerFunnelLevel(level);
  if (funnel === "Kindergarten") return "kindergarten";
  if (funnel === "University") return "university";
  return funnel ? "primary_secondary" : null;
}

export function isLearnerActive(ctx: LearnerContext | null): ctx is LearnerContext {
  return Boolean(ctx && (ctx.level || ctx.curriculum || ctx.subjects.length > 0));
}

type RankableTutor = {
  target_students: string[];
  subjects: string[];
  card_highlights?: string[] | null;
};

/**
 * Soft compatibility score (higher = better) across the three #698 tiers:
 * (1) teaching level, (2) curriculum, (3) subjects. Tutors without level data
 * score 0 on that tier (never penalised below a mismatch).
 */
export function scoreTutorForLearner(ctx: LearnerContext | null, tutor: RankableTutor): number {
  if (!isLearnerActive(ctx)) return 0;
  let score = 0;
  const funnel = learnerFunnelLevel(ctx.level);
  const targets = Array.isArray(tutor.target_students) ? tutor.target_students : [];
  if (funnel && targets.length > 0) {
    if (targets.includes(funnel)) score += 4;
    else score -= 2;
  }
  const curriculum = ctx.curriculum;
  if (
    curriculum &&
    !["Primary School", "Junior Secondary", "Kindergarten", "University"].includes(curriculum) &&
    matchesCategoryFilter(curriculum.toLowerCase(), tutor.subjects, [
      ...targets,
      ...(tutor.card_highlights ?? []),
    ])
  )
    score += 2;
  const hits = ctx.subjects.filter((wanted) =>
    tutor.subjects.some((s) => matchesSubjectQuery(s, wanted.toLowerCase())),
  ).length;
  score += Math.min(hits, 3);
  return score;
}

export function learnerLevelLabel(level: ChildLevel | null, t: TFunction): string {
  if (!level) return "";
  if (level === "kindergarten") return t("learner.level_kindergarten");
  if (level === "university") return t("learner.level_university");
  return level.toUpperCase();
}

export function learnerCurriculumLabel(curriculum: string | null): string {
  if (!curriculum) return "";
  return CURRICULUM_OPTIONS.find((option) => option.value === curriculum)?.label ?? curriculum;
}

/** "Y12 · IBDP" style summary for pills and banners. */
export function learnerSummary(ctx: LearnerContext, t: TFunction): string {
  return [learnerLevelLabel(ctx.level, t), learnerCurriculumLabel(ctx.curriculum)]
    .filter(Boolean)
    .join(" · ");
}

// --- session store ---

function read(): LearnerContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LearnerContext>;
    if (parsed.source !== "child" && parsed.source !== "guest") return null;
    return {
      source: parsed.source,
      childId: typeof parsed.childId === "string" ? parsed.childId : undefined,
      name: typeof parsed.name === "string" ? parsed.name.slice(0, 40) : undefined,
      level: (CHILD_LEVELS as readonly string[]).includes(parsed.level ?? "")
        ? (parsed.level as ChildLevel)
        : null,
      curriculum: normalizeLearnerCurriculum(parsed.curriculum ?? null),
      subjects: Array.isArray(parsed.subjects)
        ? parsed.subjects.filter((s): s is string => typeof s === "string").slice(0, 8)
        : [],
    };
  } catch {
    return null;
  }
}

let cached: LearnerContext | null | undefined;
let cachedRaw: string | null = null;

function snapshot(): LearnerContext | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (cached === undefined || raw !== cachedRaw) {
    cachedRaw = raw;
    cached = read();
  }
  return cached;
}

export function setLearnerContext(ctx: LearnerContext | null) {
  if (typeof window === "undefined") return;
  try {
    if (ctx) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage blocked: the pick simply lasts for this render tree
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useLearnerContext(): LearnerContext | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
