import type { Tutor } from "@/features/tutors/queries";
import { EXAM_SYSTEMS } from "@/features/tutors/examSystems";
import {
  ADMISSIONS_TEST_SUBJECTS,
  JUNIOR_SECONDARY_SUBJECTS,
  PRIMARY_SCHOOL_SUBJECTS,
  TEACHING_CURRICULA,
} from "@/features/tutors/subjects";

export type TutorPriceDisplay = {
  /** Lowest hourly rate — the "$X" shown on cards, filters and sorts. */
  baseRate: number;
  /** True when other curricula cost more than the base rate ("$X up"). */
  isRange: boolean;
};

/**
 * Card price model derived from the per-curriculum pricing tiers; tutors
 * without tiers fall back to the flat hourly_rate.
 */
export function getTutorPriceDisplay(
  tutor: Pick<Tutor, "hourly_rate" | "pricing_tiers">,
): TutorPriceDisplay {
  const rates = (tutor.pricing_tiers ?? [])
    .map((tier) => tier.rate)
    .filter((rate) => Number.isFinite(rate));
  if (rates.length === 0) return { baseRate: tutor.hourly_rate, isRange: false };
  const baseRate = Math.min(...rates);
  return { baseRate, isRange: rates.some((rate) => rate > baseRate) };
}

/** Lowest base hourly rate — shared by price filters, sorting and the histogram. */
export function getTutorBaseRate(tutor: Pick<Tutor, "hourly_rate" | "pricing_tiers">): number {
  return getTutorPriceDisplay(tutor).baseRate;
}

/** Pricing tiers sorted cheapest-first for the profile pricing breakdown. */
export function getSortedPricingTiers<T extends { rate: number }>(tiers: T[]): T[] {
  return [...tiers].sort((a, b) => a.rate - b.rate);
}

/** Display label for a stored pricing-tier curriculum ("DSE" -> "HKDSE"). */
export function getCurriculumPricingLabel(curriculum: string): string {
  const normalized = curriculum.trim().toLowerCase();
  const match = TEACHING_CURRICULA.find((entry) => entry.value.toLowerCase() === normalized);
  return match?.label ?? curriculum;
}

export type TutorSubjectChip = {
  subject: string;
  grade: string | null;
};

export function formatTutorCode(code?: string | null) {
  const normalized = (code ?? "").trim().toUpperCase();
  if (!normalized) return "MM-XXXX";
  if (/^MM-\d{4}$/.test(normalized)) return normalized;
  if (/^\d{4}$/.test(normalized)) return `MM-${normalized}`;
  if (/^MM-/.test(normalized)) return normalized;
  return normalized;
}

export function buildTutorWhatsAppUrl(whatsappNumber: string | undefined, tutorCode: string) {
  const digits = (whatsappNumber ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";

  const message = `Hi MatchMax! I'd like to request tutor ${formatTutorCode(tutorCode)}.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export type TutorAvailabilityReadiness = "immediate" | "pre_booking" | "future_scheduled";

/** Whole UTC calendar days since the epoch — date-only math without timezones. */
function utcDay(date: Date): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000,
  );
}

/**
 * Derived availability status (issue #106): immediate covers tutors starting
 * now or within 7 days, pre_booking is 8–30 days out (badge + pre-book CTA),
 * future_scheduled is more than 30 days out (hidden from public browse).
 * Missing or malformed availability data always reads as immediate, matching
 * the DB default start_immediately = true.
 */
export function getTutorAvailabilityReadiness(
  tutor: Pick<Tutor, "start_immediately" | "earliest_start_date">,
  today: Date = new Date(),
): TutorAvailabilityReadiness {
  if (tutor.start_immediately !== false || !tutor.earliest_start_date) return "immediate";
  const start = Date.parse(`${tutor.earliest_start_date}T00:00:00Z`);
  if (Number.isNaN(start)) return "immediate";
  const daysUntilStart = Math.floor(start / 86_400_000) - utcDay(today);
  if (daysUntilStart > 30) return "future_scheduled";
  if (daysUntilStart >= 8) return "pre_booking";
  return "immediate";
}

/** True while the profile belongs in public browse feeds and category grids. */
export function isTutorPubliclyListed(
  tutor: Pick<Tutor, "start_immediately" | "earliest_start_date">,
  today: Date = new Date(),
): boolean {
  return getTutorAvailabilityReadiness(tutor, today) !== "future_scheduled";
}

/** "15 Oct" (English) / "10月15日" (Chinese) for badges and pre-book CTAs. */
export function formatAvailabilityDate(date: string, language: string): string {
  const parsed = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed)) return date;
  return new Intl.DateTimeFormat(language.toLowerCase().startsWith("zh") ? "zh-HK" : "en-HK", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(parsed));
}

/** WhatsApp deep link pre-filled for advance pre-bookings (issue #106). */
export function buildTutorPreBookingWhatsAppUrl(
  whatsappNumber: string | undefined,
  tutorCode: string,
  startDate: string,
  language: string,
) {
  const digits = (whatsappNumber ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";

  const message = `Hi MatchMax! I'd like to pre-book tutor ${formatTutorCode(tutorCode)} for their start date around ${formatAvailabilityDate(startDate, language)}.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export type TutorInquiryAction = {
  kind: "request" | "pre_book";
  href: string;
  label: string;
};

/**
 * Card CTA for reaching a tutor: the default inquiry, or the pre-book flavor
 * (label + date-stamped WhatsApp message) while the tutor is 8–30 days out.
 * Surfaces with i18n'd CTAs can key off `kind` for their own default label.
 */
export function getTutorInquiryAction(
  tutor: Pick<Tutor, "tutor_code" | "start_immediately" | "earliest_start_date">,
  whatsappNumber: string | undefined,
  language: string,
): TutorInquiryAction {
  if (getTutorAvailabilityReadiness(tutor) === "pre_booking" && tutor.earliest_start_date) {
    return {
      kind: "pre_book",
      href: buildTutorPreBookingWhatsAppUrl(
        whatsappNumber,
        tutor.tutor_code,
        tutor.earliest_start_date,
        language,
      ),
      label: `Pre-book for ${formatAvailabilityDate(tutor.earliest_start_date, language)}`,
    };
  }
  return {
    kind: "request",
    href: buildTutorWhatsAppUrl(whatsappNumber, tutor.tutor_code),
    label: "Request tutor",
  };
}

function normalizeSubjectKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function formatTutorGradeLabel(grade?: string | null): string | null {
  const trimmed = grade?.trim() ?? "";
  if (!trimmed) return null;
  if (/^band\s+/i.test(trimmed)) return trimmed;
  return /^grade\s+/i.test(trimmed) ? trimmed : `Grade ${trimmed}`;
}

function formatTutorGradeForSystem(system: string, grade: string): string {
  const trimmed = grade.trim();
  if (system === "ielts") {
    return /^band\s+/i.test(trimmed) ? trimmed : `Band ${trimmed}`;
  }
  if (system === "isat" || system === "ucat") {
    return /^score\s+/i.test(trimmed) ? trimmed : `Score ${trimmed}`;
  }
  return formatTutorGradeLabel(grade) ?? "";
}

export function getTutorSubjectChips(
  tutor: Pick<Tutor, "subjects" | "exam_results">,
): TutorSubjectChip[] {
  const gradeLookup = new Map<string, { grade: string; system: string }>();
  for (const result of tutor.exam_results ?? []) {
    const system = String(result.system ?? "")
      .trim()
      .toLowerCase();
    for (const entry of result.subjects ?? []) {
      const subject = (entry.subject ?? "").trim();
      const grade = (entry.grade ?? "").trim();
      if (!subject || !grade) continue;
      const key = normalizeSubjectKey(subject);
      if (!gradeLookup.has(key)) gradeLookup.set(key, { grade, system });
    }
  }

  return (tutor.subjects ?? [])
    .map((value) => value.trim())
    .filter(Boolean)
    .map((subject) => {
      const key = normalizeSubjectKey(subject);
      let matched = gradeLookup.get(key);

      if (!matched) {
        for (const [candidateKey, candidateMatch] of gradeLookup.entries()) {
          if (candidateKey.includes(key) || key.includes(candidateKey)) {
            matched = candidateMatch;
            break;
          }
        }
      }

      return {
        subject,
        grade: matched ? formatTutorGradeForSystem(matched.system, matched.grade) : null,
      };
    });
}

const SYSTEM_SHORT_LABELS: Record<string, string> = {
  ib: "IBDP",
  dse: "HKDSE",
  alevel: "A-Level",
  igcse: "IGCSE",
  ap: "AP",
  sat: "SAT",
  ielts: "IELTS",
  isat: "ISAT",
  ucat: "UCAT",
  primary: "Primary School",
  "junior secondary": "Junior Secondary",
  admissions: "University Admissions & Test Prep",
};

export function getExamSystemShortLabel(systemId: string): string {
  return SYSTEM_SHORT_LABELS[systemId] ?? "";
}

/** Display label for a subject-group id returned by getTutorSubjectGroups. */
export function getCurriculumGroupLabel(systemId: string): string {
  if (systemId === "other") return "Other";
  return SYSTEM_SHORT_LABELS[systemId] ?? "";
}

/**
 * Subject name -> curriculum group id, for subjects that belong to a
 * curriculum category rather than an exam-system subject list (Primary
 * School, Junior Secondary, University Admissions & Test Prep). Junior
 * secondary names shared with exam-system lists ("Mathematics", "Physics")
 * are omitted so those keep inferring from the tutor's exam results.
 */
const CURRICULUM_GROUP_IDS: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const subject of PRIMARY_SCHOOL_SUBJECTS) {
    map[normalizeSubjectKey(subject)] = "primary";
  }
  for (const subject of ADMISSIONS_TEST_SUBJECTS) {
    map[normalizeSubjectKey(subject)] = "admissions";
  }
  const examSubjectKeys = new Set<string>();
  for (const system of EXAM_SYSTEMS) {
    for (const subject of system.subjects) examSubjectKeys.add(normalizeSubjectKey(subject));
  }
  for (const subject of JUNIOR_SECONDARY_SUBJECTS) {
    const key = normalizeSubjectKey(subject);
    if (!examSubjectKeys.has(key)) map[key] = "junior secondary";
  }
  return map;
})();

type TaughtSubjectGroup = {
  base: string;
  systemId: string;
  levels: Set<string>;
};

function findExamSystemForSubject(subjectBase: string, examResults: Tutor["exam_results"]): string {
  const baseKey = normalizeSubjectKey(subjectBase);
  for (const result of examResults ?? []) {
    for (const entry of result.subjects ?? []) {
      const entryKey = normalizeSubjectKey((entry.subject ?? "").replace(/\b(HL|SL)\b\s*$/i, ""));
      if (!entryKey) continue;
      if (entryKey === baseKey || entryKey.includes(baseKey) || baseKey.includes(entryKey)) {
        return String(result.system);
      }
    }
  }
  return "";
}

function collectLevelsFromExamResults(
  subjectBase: string,
  examResults: Tutor["exam_results"],
): string[] {
  const baseKey = normalizeSubjectKey(subjectBase);
  const levels = new Set<string>();
  for (const result of examResults ?? []) {
    for (const entry of result.subjects ?? []) {
      const raw = (entry.subject ?? "").trim();
      const entryKey = normalizeSubjectKey(raw.replace(/\b(HL|SL)\b\s*$/i, ""));
      if (!entryKey) continue;
      if (entryKey === baseKey || entryKey.includes(baseKey) || baseKey.includes(entryKey)) {
        const match = raw.match(/\b(HL|SL)\b/i);
        if (match) levels.add(match[1].toUpperCase());
      }
    }
  }
  return [...levels].sort();
}

const SYSTEM_ALIAS_PATTERN =
  /^(IBDP|IB|HKDSE|DSE|A-?Level|IGCSE|AP|SAT|IELTS|ISAT|UCAT)\b[\s:–-]*/i;

const SYSTEM_ALIASES: Record<string, string> = {
  ibdp: "ib",
  ib: "ib",
  hkdse: "dse",
  dse: "dse",
  "a-level": "alevel",
  alevel: "alevel",
  igcse: "igcse",
  ap: "ap",
  sat: "sat",
  ielts: "ielts",
  isat: "isat",
  ucat: "ucat",
};

/**
 * Returns a single readable sentence for the subjects the tutor teaches,
 * grouped per exam system with the system prefix shown once per group,
 * e.g. "IBDP: Chem (HL / SL), Bio (HL / SL), IGCSE: Chem, Math".
 */
export function getTutorSubjectSentence(tutor: Pick<Tutor, "subjects" | "exam_results">): string {
  const groups: TaughtSubjectGroup[] = [];

  for (const raw of tutor.subjects ?? []) {
    let trimmed = raw.trim();
    if (!trimmed) continue;

    // Curriculum-category subjects ("IELTS", "Primary English") are
    // self-descriptive: print them without a system prefix. Checking before
    // the alias strip below keeps bare test names from being dropped.
    if (CURRICULUM_GROUP_IDS[normalizeSubjectKey(trimmed)]) {
      const baseKey = normalizeSubjectKey(trimmed);
      if (!groups.some((g) => normalizeSubjectKey(g.base) === baseKey)) {
        groups.push({ base: trimmed, systemId: "", levels: new Set<string>() });
      }
      continue;
    }

    // A subject string may itself carry a system prefix, e.g. "IGCSE Chem".
    // That explicit prefix wins over any exam-result inference.
    let explicitSystemId = "";
    const systemMatch = trimmed.match(SYSTEM_ALIAS_PATTERN);
    if (systemMatch) {
      explicitSystemId = SYSTEM_ALIASES[systemMatch[1].toLowerCase()] ?? "";
      trimmed = trimmed.slice(systemMatch[0].length).trim();
      if (!trimmed) continue;
    }

    const levelMatch = trimmed.match(/\b(HL|SL)\b\s*$/i);
    const level = levelMatch ? levelMatch[1].toUpperCase() : null;
    const base = levelMatch ? trimmed.slice(0, levelMatch.index).trim() : trimmed;
    const baseKey = normalizeSubjectKey(base);

    const systemId = explicitSystemId || findExamSystemForSubject(base, tutor.exam_results);

    let group = groups.find(
      (g) => normalizeSubjectKey(g.base) === baseKey && g.systemId === systemId,
    );
    if (!group) {
      group = { base, systemId, levels: new Set<string>() };
      groups.push(group);
    }
    if (level) group.levels.add(level);

    for (const examLevel of collectLevelsFromExamResults(base, tutor.exam_results)) {
      group.levels.add(examLevel);
    }
  }

  // Merge groups by system, preserving first-appearance order, so each
  // system prefix is printed once: "IBDP: A, B, IGCSE: C, D".
  const bySystem = new Map<string, TaughtSubjectGroup[]>();
  for (const group of groups) {
    const list = bySystem.get(group.systemId) ?? [];
    list.push(group);
    bySystem.set(group.systemId, list);
  }

  const parts: string[] = [];
  for (const [systemId, systemGroups] of bySystem) {
    const prefix = getExamSystemShortLabel(systemId);
    const items = systemGroups.map((g) => {
      const levels = [...g.levels].sort();
      let suffix = "";
      if (levels.length === 2) {
        suffix = " (HL / SL)";
      } else if (levels.length === 1) {
        suffix = ` (${levels[0]})`;
      }
      return `${g.base}${suffix}`;
    });
    // A taught subject may already be the system label itself (e.g. "IELTS");
    // print it once instead of "IELTS: IELTS".
    if (
      prefix &&
      items.length === 1 &&
      items[0]
        .replace(/\s*\(.*\)\s*$/, "")
        .trim()
        .toLowerCase() === prefix.toLowerCase()
    ) {
      parts.push(items[0]);
      continue;
    }
    parts.push(`${prefix ? `${prefix}: ` : ""}${items.join(", ")}`);
  }

  return parts.join(", ");
}

export type TutorSubjectGroup = {
  systemId: string;
  subjects: string[];
};

/**
 * Groups the subjects saved in the tutor editor by exam system so the profile
 * can render one row per system: "IBDP: Math AA HL, Math AA SL", "HKDSE: ...".
 * Subjects are categorized against the canonical exam-system lists; anything
 * unmatched lands in the "other" system.
 */
export function getTutorSubjectGroups(
  tutor: Pick<Tutor, "subjects" | "exam_results">,
): TutorSubjectGroup[] {
  // Canonical subject name -> system ids, in EXAM_SYSTEMS order. Names that
  // exist in several systems (e.g. "Biology") keep every candidate id so the
  // tutor's own exam results can disambiguate.
  const systemIdsBySubject = new Map<string, string[]>();
  for (const system of EXAM_SYSTEMS) {
    for (const subject of system.subjects) {
      const key = normalizeSubjectKey(subject);
      if (!key) continue;
      const ids = systemIdsBySubject.get(key) ?? [];
      if (!ids.includes(system.id)) ids.push(system.id);
      systemIdsBySubject.set(key, ids);
    }
  }

  const groups = new Map<string, string[]>();
  const addSubject = (systemId: string, subject: string) => {
    const id = systemId || "other";
    const list = groups.get(id) ?? [];
    list.push(subject);
    groups.set(id, list);
  };

  for (const raw of tutor.subjects ?? []) {
    const subject = raw.trim();
    if (!subject) continue;

    const matchingSystemIds = systemIdsBySubject.get(normalizeSubjectKey(subject)) ?? [];
    if (matchingSystemIds.length > 0) {
      const inferredSystemId = findExamSystemForSubject(subject, tutor.exam_results);
      const systemId = matchingSystemIds.includes(inferredSystemId)
        ? inferredSystemId
        : matchingSystemIds[0];
      addSubject(systemId, subject);
      continue;
    }

    // Curriculum-category subjects ("IELTS", "Primary English", "Personal
    // Statement") group under their curriculum instead of "other". This also
    // keeps bare test names from being consumed by the alias-prefix strip
    // below, which would silently drop them.
    const curriculumGroupId = CURRICULUM_GROUP_IDS[normalizeSubjectKey(subject)];
    if (curriculumGroupId) {
      addSubject(curriculumGroupId, subject);
      continue;
    }

    // Free-text tags may carry an explicit system prefix, e.g. "IB Biology".
    const systemMatch = subject.match(SYSTEM_ALIAS_PATTERN);
    if (systemMatch) {
      const explicitSystemId = SYSTEM_ALIASES[systemMatch[1].toLowerCase()] ?? "";
      const rest = subject.slice(systemMatch[0].length).trim();
      if (!rest) continue;
      addSubject(explicitSystemId, rest);
      continue;
    }

    addSubject(findExamSystemForSubject(subject, tutor.exam_results), subject);
  }

  return [...groups.entries()].map(([systemId, subjects]) => ({ systemId, subjects }));
}

/**
 * Legacy single-label formatter. Kept for hero chips and other call sites.
 */
export function formatTaughtSubjectLabel(
  subject: string,
  tutor: Pick<Tutor, "exam_results">,
): string {
  const raw = subject.trim();
  if (!raw) return "";

  const levelMatch = raw.match(/\b(HL|SL)\b\s*$/i);
  const level = levelMatch ? levelMatch[1].toUpperCase() : null;
  const base = levelMatch ? raw.slice(0, levelMatch.index).trim() : raw;
  const systemId = findExamSystemForSubject(base, tutor.exam_results);
  const prefix = getExamSystemShortLabel(systemId);
  const suffix = level ? ` (${level})` : "";
  // Skip the prefix when it duplicates the subject name (e.g. "IELTS: IELTS").
  if (prefix && prefix.toLowerCase() === base.toLowerCase()) return `${prefix}${suffix}`;
  return `${prefix ? `${prefix}: ` : ""}${base}${suffix}`;
}

// ---------------------------------------------------------------------------
// Education formatting (issue #107): tutors may list an undergraduate plus a
// postgraduate degree. Cards show abbreviated forms ("Edinburgh (MSc) •
// Durham (BSc)") on a single line; the profile spells everything out.
// ---------------------------------------------------------------------------

/** Spelled-out degree names -> acronyms, matched case-insensitively. */
const DEGREE_PHRASE_SHORT_LABELS: Record<string, string> = {
  "bachelor of science": "BSc",
  "bachelor of arts": "BA",
  "bachelor of business administration": "BBA",
  "bachelor of engineering": "BEng",
  "bachelor of education": "BEd",
  "bachelor of laws": "LLB",
  "bachelor of medicine and bachelor of surgery": "MBBS",
  "master of science": "MSc",
  "master of arts": "MA",
  "master of business administration": "MBA",
  "master of engineering": "MEng",
  "master of education": "MEd",
  "master of laws": "LLM",
  "master of philosophy": "MPhil",
  "master of research": "MRes",
  "master of public health": "MPH",
  "master of fine arts": "MFA",
  "doctor of philosophy": "PhD",
  "doctor of business administration": "DBA",
  "doctor of education": "EdD",
  "doctor of medicine": "MD",
};

/** Acronym tokens, longest first so \b alternation matches BBA before BA. */
const DEGREE_ACRONYMS = [
  "MBBS",
  "BBA",
  "BEng",
  "MEng",
  "BEd",
  "MEd",
  "BSc",
  "MSc",
  "BArch",
  "BMus",
  "LLB",
  "LLM",
  "MPhil",
  "MRes",
  "MPH",
  "MFA",
  "BFA",
  "MBA",
  "DBA",
  "EdD",
  "PhD",
  "DPhil",
  "PGDE",
  "PGCE",
  "JD",
  "MD",
  "BA",
  "MA",
];

const DEGREE_ACRONYM_PATTERN = new RegExp(`\\b(${DEGREE_ACRONYMS.join("|")})\\b`, "gi");

const DEGREE_ACRONYM_CASE: Record<string, string> = Object.fromEntries(
  DEGREE_ACRONYMS.map((acronym) => [acronym.toLowerCase(), acronym]),
);

/**
 * "MSc Theoretical Physics" -> "MSc"; "BBA Global Business & BSc Computer
 * Science" -> "BBA/BSc"; degrees without a recognisable qualification word
 * come back unchanged so nothing is invented.
 */
export function shortenDegree(degree: string | null | undefined): string | null {
  const trimmed = degree?.trim() ?? "";
  if (!trimmed) return null;

  let normalized = trimmed;
  for (const [phrase, acronym] of Object.entries(DEGREE_PHRASE_SHORT_LABELS)) {
    normalized = normalized.replace(new RegExp(`\\b${phrase}\\b`, "gi"), acronym);
  }

  const found: string[] = [];
  for (const match of normalized.matchAll(DEGREE_ACRONYM_PATTERN)) {
    const acronym = DEGREE_ACRONYM_CASE[match[1].toLowerCase()];
    if (acronym && !found.includes(acronym)) found.push(acronym);
  }

  if (found.length === 0) return trimmed;
  return found.slice(0, 2).join("/");
}

/**
 * Conservative university shortener for tight card rows:
 * "University of Edinburgh" -> "Edinburgh", "Durham University" -> "Durham".
 * Anything it cannot strip confidently (HKUST, Imperial College London,
 * King's College London) is returned unchanged.
 */
export function shortenUniversity(university: string | null | undefined): string | null {
  const trimmed = university?.trim() ?? "";
  if (!trimmed) return null;

  let shortened = trimmed.replace(/^the\s+/i, "").replace(/^university\s+of\s+/i, "");
  shortened = shortened.replace(/\s+university$/i, "").trim();
  return shortened || trimmed;
}

export type TutorEducationLine = {
  icon: "graduation" | "school";
  text: string;
};

/**
 * Education rows for compact surfaces (browse card, compare dialog).
 * With a postgraduate degree the two institutions share one abbreviated
 * line; otherwise the undergraduate row shows the full degree text. The
 * secondary school always gets its own line.
 */
export function getTutorEducationLines(
  tutor: Pick<
    Tutor,
    | "undergrad_university"
    | "undergrad_degree"
    | "has_postgrad"
    | "postgrad_university"
    | "postgrad_degree"
    | "secondary_school"
  >,
): TutorEducationLine[] {
  const lines: TutorEducationLine[] = [];
  const undergradUniversity = tutor.undergrad_university?.trim() || null;
  const undergradDegreeShort = shortenDegree(tutor.undergrad_degree);
  const postgradUniversity = tutor.postgrad_university?.trim() || null;
  const postgradDegreeShort = shortenDegree(tutor.postgrad_degree);

  if (tutor.has_postgrad && (postgradUniversity || postgradDegreeShort)) {
    const postgradPart = [postgradUniversity, postgradDegreeShort && `(${postgradDegreeShort})`]
      .filter(Boolean)
      .join(" ");
    const undergradPart = [undergradUniversity, undergradDegreeShort && `(${undergradDegreeShort})`]
      .filter(Boolean)
      .join(" ");
    const text = [postgradPart, undergradPart].filter(Boolean).join(" • ");
    if (text) lines.push({ icon: "graduation", text });
  } else if (undergradUniversity) {
    const degree = tutor.undergrad_degree?.trim();
    lines.push({
      icon: "graduation",
      text: degree ? `${undergradUniversity} - ${degree}` : undergradUniversity,
    });
  }

  const secondarySchool = tutor.secondary_school?.trim();
  if (secondarySchool) lines.push({ icon: "school", text: secondarySchool });

  return lines;
}
