import { GRID_DAYS } from "./availability-grid-model";
import { AVAIL_BANDS, parseAvailBands, parseAvailDays } from "./availability-filter";
import { parseSelectedStatuses } from "./status-taxonomy";

/**
 * #605 §3.3 step 9 / AC8: the Active Filter Ribbon above tutor results.
 * One dismissible chip per applied constraint, built from the APPLIED URL
 * search (not the sheet draft). Each chip carries the URL patch that removes
 * just that constraint. `tag` is left out: the results row already shows the
 * #tag chip (#217).
 */

export type AppliedTutorSearch = {
  q?: string;
  category?: string;
  subject?: string;
  subjects_extra?: string;
  subject_match?: "and" | "or";
  status?: string;
  statuses_extra?: string;
  mode?: string;
  station?: string;
  gender?: string;
  verified?: boolean;
  sen?: boolean;
  university?: string;
  high_school?: string;
  major?: string;
  field?: string;
  min_price?: number;
  max_price?: number;
  avail_days?: string;
  avail_bands?: string;
};

export type ActiveFilterChip = {
  key: string;
  label: string;
  patch: Partial<Record<keyof AppliedTutorSearch, undefined | string>>;
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

function splitList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split("||")
    .map((value) => value.trim())
    .filter(Boolean);
}

function joinOrUndefined(values: string[]): string | undefined {
  return values.length > 0 ? values.join("||") : undefined;
}

export function buildActiveFilterChips(
  search: AppliedTutorSearch,
  t: Translate,
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  const q = search.q?.trim();
  if (q) chips.push({ key: "q", label: `“${q}”`, patch: { q: undefined } });

  const category = search.category?.trim();
  if (category) chips.push({ key: "category", label: category, patch: { category: undefined } });
  if (search.field?.trim())
    chips.push({ key: "field", label: search.field.trim(), patch: { field: undefined } });

  const subjects = [
    ...new Set([
      ...(search.subject?.trim() ? [search.subject.trim()] : []),
      ...splitList(search.subjects_extra),
    ]),
  ];
  for (const subject of subjects) {
    const rest = subjects.filter((value) => value !== subject);
    chips.push({
      key: `subject:${subject}`,
      label: category ? `${category}: ${subject}` : subject,
      patch: { subject: rest[0], subjects_extra: joinOrUndefined(rest.slice(1)) },
    });
  }
  if (search.subject_match === "and" && subjects.length > 1)
    chips.push({
      key: "subject_match",
      label: t("explore_search.subject_match_all"),
      patch: { subject_match: undefined },
    });

  const statuses = parseSelectedStatuses(search.status, search.statuses_extra);
  for (const code of statuses) {
    const rest = statuses.filter((value) => value !== code);
    chips.push({
      key: `status:${code}`,
      label: t(`tutor_status.${code}`),
      patch: { status: rest[0], statuses_extra: joinOrUndefined(rest.slice(1)) },
    });
  }

  if (search.mode === "online")
    chips.push({ key: "mode", label: t("search_ui.mode_online"), patch: { mode: undefined } });
  if (search.mode === "in_person")
    chips.push({
      key: "mode",
      label: search.station
        ? `${t("search_ui.mode_in_person")}: ${search.station}`
        : t("search_ui.mode_in_person"),
      patch: { mode: undefined, station: undefined },
    });

  if (search.gender === "female" || search.gender === "male")
    chips.push({
      key: "gender",
      label: t(`search_panel.gender_${search.gender}`),
      patch: { gender: undefined },
    });
  if (search.verified === true)
    chips.push({
      key: "verified",
      label: t("search_ui.verified_only"),
      patch: { verified: undefined },
    });
  if (search.sen === true)
    chips.push({ key: "sen", label: t("sen.filter_title"), patch: { sen: undefined } });
  for (const key of ["university", "high_school", "major"] as const) {
    const value = search[key]?.trim();
    if (value) chips.push({ key, label: value, patch: { [key]: undefined } });
  }

  if (search.min_price !== undefined || search.max_price !== undefined) {
    const label =
      search.min_price !== undefined && search.max_price !== undefined
        ? `$${search.min_price}–$${search.max_price}`
        : search.min_price !== undefined
          ? `≥ $${search.min_price}`
          : `≤ $${search.max_price}`;
    chips.push({ key: "price", label, patch: { min_price: undefined, max_price: undefined } });
  }

  const days = parseAvailDays(search.avail_days);
  const bands = parseAvailBands(search.avail_bands);
  if (days.length > 0 || bands.length > 0) {
    const parts = [
      GRID_DAYS.filter((d) => days.includes(d))
        .map((d) => t(`explore_search.day_${d}`))
        .join(t("explore_search.list_sep")),
      AVAIL_BANDS.filter((b) => bands.includes(b))
        .map((b) => t(`explore_search.band_${b}`))
        .join(t("explore_search.list_sep")),
    ].filter(Boolean);
    chips.push({
      key: "availability",
      label: t("explore_search.avail_chip", { value: parts.join(" · ") }),
      patch: { avail_days: undefined, avail_bands: undefined },
    });
  }

  return chips;
}
