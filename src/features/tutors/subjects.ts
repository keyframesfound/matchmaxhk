import { EXAM_SYSTEMS } from "./examSystems";

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
