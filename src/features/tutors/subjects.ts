import { EXAM_SYSTEMS, IB_SUBJECTS } from "./examSystems";

// Canonical subject list built from every exam system, deduped + generals.
export const DEFAULT_SUBJECT_OPTIONS: string[] = (() => {
  const set = new Set<string>();
  for (const sys of EXAM_SYSTEMS) for (const s of sys.subjects) set.add(s);
  for (const s of [
    "Mathematics",
    "English",
    "Chinese",
    "Physics",
    "Chemistry",
    "Biology",
    "Economics",
    "Geography",
    "History",
    "Computer Science",
    "Music",
    "Art",
    "Primary English",
    "Primary Mathematics",
    "Primary Chinese",
  ])
    set.add(s);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
})();

/**
 * Category -> exam-system id, so subject dropdowns can narrow to the
 * selected curriculum (e.g. picking "IB" only lists IB subjects).
 */
const CATEGORY_SYSTEM_IDS: Record<string, string> = {
  ib: "ib",
  dse: "dse",
  igcse: "igcse",
  ap: "ap",
  "a-level": "alevel",
  alevel: "alevel",
};

export function getSubjectOptionsForCategory(category: string | undefined): string[] {
  const systemId = CATEGORY_SYSTEM_IDS[(category ?? "").trim().toLowerCase()];
  if (!systemId) return DEFAULT_SUBJECT_OPTIONS;
  const system = EXAM_SYSTEMS.find((s) => s.id === systemId);
  if (!system) return DEFAULT_SUBJECT_OPTIONS;
  return [...system.subjects].sort((a, b) => a.localeCompare(b));
}

/**
 * True when the tutor plausibly teaches the selected curriculum category.
 * Curriculum categories match against the canonical subject lists (with a
 * prefix fallback for free-text tags like "IB Biology"); everything else
 * (Primary, Secondary, International, …) falls back to plain text matching.
 */
export function matchesCategoryFilter(
  category: string,
  subjects: string[],
  extraText: string[] = [],
): boolean {
  const normalized = category.trim().toLowerCase();
  if (!normalized) return true;
  const systemId = CATEGORY_SYSTEM_IDS[normalized];
  if (systemId) {
    const system = EXAM_SYSTEMS.find((s) => s.id === systemId);
    if (system) {
      const systemSubjects = new Set(system.subjects.map((s) => s.trim().toLowerCase()));
      return subjects.some((s) => {
        const key = s.trim().toLowerCase();
        if (systemSubjects.has(key)) return true;
        return system.subjects.some(
          (candidate) =>
            key.includes(candidate.toLowerCase()) || candidate.toLowerCase().includes(key),
        );
      });
    }
  }
  const source = [...subjects, ...extraText].join(" ").toLowerCase();
  return source.includes(normalized);
}

export function getSubjectMatchVariants(input: string): string[] {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return [];

  const variants = new Set<string>([normalized]);

  const levelMatch = normalized.match(/^(.*?)(?:\s+|\b)(hl|sl)\s*$/);
  if (levelMatch) {
    const base = levelMatch[1].trim();
    if (base) {
      variants.add(base);
      variants.add(`${base} hl`);
      variants.add(`${base} sl`);
    }
  } else if (normalized === "sl" || normalized === "hl") {
    variants.add(normalized === "sl" ? "hl" : "sl");
  }

  return Array.from(variants);
}

export function matchesSubjectQuery(subject: string, query: string): boolean {
  const normalizedSubject = subject.trim().toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return true;

  return getSubjectMatchVariants(normalizedQuery).some((variant) =>
    normalizedSubject.includes(variant),
  );
}
