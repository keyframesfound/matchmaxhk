/**
 * Issue #798 (AC-2): optional matching chips on the tutor join form.
 *
 * Three independent selections: how the tutor teaches, who they work best
 * with, and their specialty syllabus topics. Every one of them is optional —
 * an empty selection must save and publish exactly like a filled one — so the
 * caps are enforced here (and re-enforced server-side) instead of in the
 * submit gate.
 *
 * The tag vocabulary below is PROVISIONAL. There is no canonical `#tag` source
 * in the repo yet (`case_topic_flags.topic` is free text, 1-80 chars). When
 * the shared tag source from #796 / #744 ships, reconcile this list against it
 * and delete this note — never fork a second tag list.
 *
 * Pure module on purpose: the form, the zod schema and the server write all
 * import from here, and the tests run without a database.
 */

export type ChipOption = {
  /** Stable English identifier; this is what gets stored. */
  value: string;
  en: string;
  zhHK: string;
};

export const STYLE_OPTIONS: readonly ChipOption[] = [
  { value: "exam-focused", en: "Exam focused", zhHK: "應試導向" },
  { value: "concept-first", en: "Concept first", zhHK: "概念優先" },
  { value: "step-by-step", en: "Step by step", zhHK: "循序漸進" },
  { value: "conversational", en: "Conversational", zhHK: "對談互動" },
  { value: "homework-support", en: "Homework support", zhHK: "功課輔導" },
];

export const FIT_OPTIONS: readonly ChipOption[] = [
  { value: "primary", en: "Primary school", zhHK: "小學" },
  { value: "junior-secondary", en: "Junior secondary", zhHK: "初中" },
  { value: "senior-secondary", en: "Senior secondary", zhHK: "高中" },
  { value: "dse-candidates", en: "DSE candidates", zhHK: "DSE 考生" },
  { value: "international-school", en: "International school", zhHK: "國際學校" },
];

export const TAG_OPTIONS: readonly ChipOption[] = [
  { value: "dse", en: "DSE", zhHK: "DSE" },
  { value: "ib", en: "IB", zhHK: "IB" },
  { value: "igcse", en: "IGCSE", zhHK: "IGCSE" },
  { value: "a-level", en: "A-Level", zhHK: "A-Level" },
  { value: "sat", en: "SAT", zhHK: "SAT" },
  { value: "phonics", en: "Phonics", zhHK: "拼音" },
  { value: "writing", en: "Writing skills", zhHK: "寫作技巧" },
  { value: "interview-prep", en: "Interview prep", zhHK: "面試準備" },
];

export const MAX_STYLES = 3;
export const MAX_FIT = 3;
export const MAX_TAGS = 5;

/**
 * Toggle one chip. Removing always wins; adding stops quietly at the cap so a
 * stray click can never exceed the DB CHECK.
 */
export function toggleChip(list: string[], value: string, max: number): string[] {
  if (list.includes(value)) return list.filter((item) => item !== value);
  if (list.length >= max) return list;
  return [...list, value];
}

/**
 * Coerce anything (autosaved draft, older resume payload, hand-edited JSON)
 * into a clean selection: non-arrays become `[]`, unknown values and blanks
 * drop, duplicates collapse, and the cap applies. Never throws — a malformed
 * draft must not fail a save.
 */
export function sanitizeChips(
  input: unknown,
  allowed: ReadonlyArray<{ value: string }>,
  max: number,
): string[] {
  if (!Array.isArray(input)) return [];
  const allowedValues = new Set(allowed.map((option) => option.value));
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (!value || !allowedValues.has(value) || seen.has(value)) continue;
    seen.add(value);
    cleaned.push(value);
    if (cleaned.length >= max) break;
  }
  return cleaned;
}

/** Display label for a stored value; unknown values fall back to the value. */
export function chipLabel(
  language: "en" | "zh",
  options: readonly ChipOption[],
  value: string,
): string {
  const option = options.find((candidate) => candidate.value === value);
  if (!option) return value;
  return language === "zh" ? option.zhHK : option.en;
}
