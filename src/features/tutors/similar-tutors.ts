// Issue #563: helpers around the get_similar_tutors RPC. Filters reach the
// profile through sessionStorage, keyed to the opened tutor, so a shared or
// later visit to the same URL never inherits someone else's search.

const CONTEXT_KEY = "mm-similar-tutor-context";
const RPC_CURRICULA = new Set(["A-Level", "AP", "GCSE", "HKDSE", "IBDP", "IGCSE", "MYP"]);
const RPC_MODES = new Set(["online", "in_person"]);

export type SimilarFilters = {
  subject?: string;
  curriculum?: string;
  max_rate_hkd?: number;
  mode?: string;
  strict_gender?: string;
  district?: string;
};

export type SimilarReason = "strict" | "value" | "subject";

export function similarFiltersFromSearch(search: {
  subject?: string;
  category?: string;
  max_price?: number;
  mode?: string;
  gender?: string;
  station?: string;
}): SimilarFilters {
  const { subject, category, max_price, mode, gender, station } = search;
  return {
    ...(subject ? { subject } : {}),
    ...(category && RPC_CURRICULA.has(category) ? { curriculum: category } : {}),
    ...(max_price ? { max_rate_hkd: max_price } : {}),
    ...(mode && RPC_MODES.has(mode) ? { mode } : {}),
    ...(gender ? { strict_gender: gender } : {}),
    ...(station ? { district: station } : {}),
  };
}

export function rememberSimilarContext(tutorCode: string, filters: SimilarFilters): void {
  try {
    window.sessionStorage.setItem(CONTEXT_KEY, JSON.stringify({ tutorCode, filters }));
  } catch {
    // Private mode or blocked storage: the rail falls back to the seed tutor.
  }
}

export function readSimilarContext(tutorCode: string): SimilarFilters {
  try {
    const raw = window.sessionStorage.getItem(CONTEXT_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as { tutorCode?: string; filters?: SimilarFilters })
      : null;
    return parsed?.tutorCode === tutorCode ? (parsed.filters ?? {}) : {};
  } catch {
    return {};
  }
}

/** The RPC decides the slots; the public read only fills in the card fields. */
export function orderBySimilarIds<T extends { id: string }>(
  tutors: T[],
  rows: { id: string; match_reason_key: string }[],
): { tutor: T; reason: SimilarReason }[] {
  const byId = new Map(tutors.map((tutor) => [tutor.id, tutor]));
  return rows.flatMap((row) => {
    const tutor = byId.get(row.id);
    return tutor ? [{ tutor, reason: row.match_reason_key as SimilarReason }] : [];
  });
}
