// Issue #423 (sections 2+3) — ONE chip system for case cards.
//
// Merges the #149 requirement pills and the #311 stored tags into a single
// descriptor list (the dual-render / grey-# row is gone). Chips are built
// pure so both the list card and the detail page (and vitest) share them.
//
// Hard vs soft: gender "Female Only"/"Male Only" is a HARD preference — the
// detail page dims Apply + shows ⚠️ on a mismatching tutor. Everything else
// (background, coursework components, tags) is soft and never dims anything.

import { normalizeProfileTag, MAX_CASE_TAGS } from "@/features/tutors/profile-tags";
import type { PublicCaseBoardItem } from "@/lib/cases.functions";

export type CaseChip = {
  key: string;
  label: string;
  /** Hard preferences gate Apply (gender only, today). */
  hard: boolean;
  /** When set, the chip links to the board's ?tag= filter. */
  tag?: string;
  /** Otherwise a chip may link to the board's ?q= text filter. */
  query?: string;
};

/** CasePill tones are all soft (hard pills today are SEN/tests — still soft
 * preferences for Apply gating; only gender is a hard gate per #423). */
export function caseChips(item: PublicCaseBoardItem): CaseChip[] {
  const chips: CaseChip[] = [];
  const seen = new Set<string>();
  const push = (chip: CaseChip) => {
    const norm = normalizeProfileTag(chip.label);
    if (!norm || seen.has(norm)) return;
    seen.add(norm);
    chips.push(chip);
  };

  // Gender is the single HARD preference.
  if (item.preferredGender === "female") {
    chips.push({ key: "gender", label: "Female Only", hard: true });
  } else if (item.preferredGender === "male") {
    chips.push({ key: "gender", label: "Male Only", hard: true });
  }

  // Issue #199: SEN support is always surfaced (soft chip).
  if (item.senRequired) push({ key: "sen", label: "SEN Friendly", hard: false });

  // #149 requirement pills surface as query chips.
  for (const pill of casePillLabels(item)) {
    push({ key: `pill:${pill}`, label: pill, hard: false, query: pill });
  }

  // #311 stored tags surface as tag chips (?tag= filter, same normalization).
  for (const tag of item.tags ?? []) {
    const norm = normalizeProfileTag(tag);
    if (!norm) continue;
    push({ key: `tag:${norm}`, label: norm, hard: false, tag: norm });
  }

  return chips.slice(0, MAX_CASE_TAGS);
}

function casePillLabels(item: PublicCaseBoardItem): string[] {
  const labels: string[] = [];
  if (item.examSystem && item.examSystem !== "Not sure yet") labels.push(item.examSystem);
  if (item.specificComponent) labels.push(item.specificComponent);
  if (item.targetSchool) labels.push(item.targetSchool);
  if (item.uniName) labels.push(item.uniName);
  if (item.uniField) labels.push(item.uniField);
  if (item.tutorBackground && item.tutorBackground !== "any") {
    labels.push(
      item.tutorBackground === "uni_student"
        ? "University student"
        : item.tutorBackground === "official_examiner"
          ? "Official examiner"
          : "",
    );
  }
  return labels.filter(Boolean);
}
