// Issue #552: the Private / Centre / Activity case taxonomy, pure so the board
// filter, the card and detail badges, and vitest share one definition.
//
// A case linked to an organisation is always a centre case. Legacy rows and
// anything unrecognised read as private.

export const CASE_TYPES = ["private", "centre", "activity"] as const;
export type CaseType = (typeof CASE_TYPES)[number];

export function resolveCaseType(item: { caseType?: string | null; centre?: unknown }): CaseType {
  if (item.centre) return "centre";
  return item.caseType === "activity" ? "activity" : "private";
}

export function parseCaseTypeParam(raw: unknown): CaseType | undefined {
  return CASE_TYPES.find((type) => type === raw);
}

const CASE_TYPE_LABEL_KEY: Record<CaseType, string> = {
  private: "case_board.type_private",
  centre: "case_board.type_centre",
  activity: "case_board.type_activity",
};

export function caseTypeLabelKey(type: CaseType): string {
  return CASE_TYPE_LABEL_KEY[type];
}

/** Activity shares the private 1.5-lesson fee (CEO lock, #552 open question 1). */
export function caseFeeNoteKey(type: CaseType): string {
  return type === "centre" ? "case_board.fee_note_centre" : "case_board.fee_note_standard";
}
