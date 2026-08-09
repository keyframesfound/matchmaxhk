import { EXAM_SYSTEMS } from "./examSystems";

// Canonical subject list built from every exam system, deduped + generals.
export const DEFAULT_SUBJECT_OPTIONS: string[] = (() => {
  const set = new Set<string>();
  for (const sys of EXAM_SYSTEMS) for (const s of sys.subjects) set.add(s);
  for (const s of [
    "Mathematics", "English", "Chinese", "Physics", "Chemistry", "Biology",
    "Economics", "Geography", "History", "Computer Science", "Music", "Art",
    "Primary English", "Primary Mathematics", "Primary Chinese",
  ]) set.add(s);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
})();

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

  return getSubjectMatchVariants(normalizedQuery).some((variant) => normalizedSubject.includes(variant));
}
