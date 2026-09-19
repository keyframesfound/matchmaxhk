import {
  BadgeCheck,
  BookOpen,
  Briefcase,
  ChevronDown,
  ClipboardList,
  Coins,
  GraduationCap,
  MapPin,
  Monitor,
  UserRound,
  Users,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { WhatsAppIcon } from "@/components/layout/WhatsAppFloatButton";
import {
  PanelLabel,
  SearchBigInput,
  Segmented,
  SuggestedRow,
  type OptionRow,
} from "./search-controls";
import {
  FilterQuickPicks,
  FiltersDialog,
  FiltersPillButton,
  FiltersSection,
} from "./filters-dialog";
import { KeywordPanelContent, SearchPillBar, type PillSegment } from "./search-pill-bar";
import { MobileSearchOverlay, type MobileSearchTab } from "./mobile-search-overlay";
import { setSearchSlideDirection } from "./slide-direction";
import { MobileSearchTrigger } from "./mobile-search-trigger";
import { MtrStationPickerContent } from "@/components/ui/mtr-station-select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";
import { DEFAULT_SUBJECT_OPTIONS, getSubjectOptionsForCategory } from "@/features/tutors/subjects";
import { cn } from "@/lib/utils";

export type TutorsSearchState = {
  category?: string;
  subject?: string;
  station?: string;
  mode?: string;
  gender?: string;
  status?: string;
  min_price?: number;
  max_price?: number;
  sort?: string;
  q?: string;
};

const PRICE_MIN = 100;
const PRICE_MAX = 1200;
const PRICE_STEP = 10;
const HISTOGRAM_BUCKETS = 28;

const CATEGORY_VALUES = ["IB", "DSE", "IGCSE", "AP", "A-Level"];

const formatPrice = (price: number) =>
  price === PRICE_MAX ? `HK$${price.toLocaleString()}+` : `HK$${price.toLocaleString()}`;

type TutorsSearchProps = {
  draft: TutorsSearchState;
  onDraftChange: (patch: Partial<TutorsSearchState>) => void;
  /** Apply the current draft (navigate). `override` merges values set in the same event. */
  onApply: (override?: Partial<TutorsSearchState>) => void;
  onClear: () => void;
  /** Live count for the "Show N tutors" button; omit for a plain "Search tutors" label. */
  resultCount?: number;
  /** All published tutors' hourly rates — powers the price histogram. */
  allPrices?: number[];
  /** Open the mobile overlay on mount (used when hopping between search tabs). */
  defaultOverlayOpen?: boolean;
  whatsappUrl?: string;
  className?: string;
};

export function TutorsSearch({
  draft,
  onDraftChange,
  onApply,
  onClear,
  resultCount,
  allPrices,
  defaultOverlayOpen,
  whatsappUrl,
  className,
}: TutorsSearchProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(Boolean(defaultOverlayOpen));
  const [moreOpen, setMoreOpen] = useState(false);

  const subjectOptions = getSubjectOptionsForCategory(draft.category);
  const suggestedSubjects = subjectOptions.length > 0 ? subjectOptions : DEFAULT_SUBJECT_OPTIONS;

  const handleCategorySelect = (category: string) => {
    const nextSubjects = getSubjectOptionsForCategory(category);
    onDraftChange({
      category: category || undefined,
      ...(draft.subject && !nextSubjects.includes(draft.subject) ? { subject: undefined } : {}),
    });
  };

  const handleModeChange = (next: { mode: string; station?: string }) => {
    onDraftChange({
      mode: next.mode || undefined,
      station: next.mode === "in_person" ? next.station : undefined,
    });
  };

  const priceValue = useMemo(
    () => [draft.min_price ?? PRICE_MIN, draft.max_price ?? PRICE_MAX] as [number, number],
    [draft.min_price, draft.max_price],
  );

  const priceHistogram = useMemo(() => {
    if (!allPrices || allPrices.length === 0) return null;
    const span = PRICE_MAX - PRICE_MIN;
    const buckets = new Array<number>(HISTOGRAM_BUCKETS).fill(0);
    for (const price of allPrices) {
      const clamped = Math.min(Math.max(price, PRICE_MIN), PRICE_MAX);
      const index = Math.min(
        HISTOGRAM_BUCKETS - 1,
        Math.floor(((clamped - PRICE_MIN) / span) * HISTOGRAM_BUCKETS),
      );
      buckets[index] += 1;
    }
    const peak = Math.max(...buckets, 1);
    return buckets.map((count, index) => ({
      level: count / peak,
      inRange:
        (index + 0.5) / HISTOGRAM_BUCKETS >= (priceValue[0] - PRICE_MIN) / span &&
        (index + 0.5) / HISTOGRAM_BUCKETS <= (priceValue[1] - PRICE_MIN) / span,
    }));
    // priceValue is derived from draft; histogram re-tints when the range moves.
  }, [allPrices, priceValue]);

  const filterCount = [
    draft.gender,
    draft.status,
    draft.min_price !== undefined ? "price" : "",
    draft.max_price !== undefined ? "price" : "",
    draft.sort,
  ].filter(Boolean).length;

  const categoryLabel = (value: string) => {
    if (value === "Primary") return t("search_panel.category_primary_school");
    if (value === "Junior Secondary") return t("search_panel.category_junior_secondary");
    if (value === "Admissions") return t("search_panel.category_admissions");
    return value;
  };

  const categoryOptions: OptionRow[] = [
    ...CATEGORY_VALUES.map((value) => ({ value, label: value })),
    { value: "Primary", label: t("search_panel.category_primary_school") },
    { value: "Junior Secondary", label: t("search_panel.category_junior_secondary") },
    { value: "Admissions", label: t("search_panel.category_admissions") },
  ];

  const statusOptions = [
    { value: "", label: t("search_panel.any_status") },
    { value: "uni_student", label: t("search_panel.status_uni_student") },
    { value: "full_part_time_tutor", label: t("search_panel.status_full_part_time") },
    { value: "examiner", label: t("search_panel.status_examiner") },
  ];

  const sortOptions = [
    { value: "", label: t("search_panel.sort_recommended") },
    { value: "price_asc", label: t("search_panel.sort_price_asc") },
    { value: "price_desc", label: t("search_panel.sort_price_desc") },
  ];

  const genderOptions = [
    { value: "", label: t("search_ui.gender_any") },
    { value: "female", label: t("search_panel.gender_female") },
    { value: "male", label: t("search_panel.gender_male") },
  ];

  const modeDisplay = (() => {
    if (draft.mode === "in_person") {
      return draft.station
        ? `${t("search_panel.mode_in_person")} · ${draft.station}`
        : t("search_panel.mode_in_person");
    }
    if (draft.mode === "online") return t("search_panel.mode_online");
    return t("search_ui.any_value");
  })();

  const applyLabel =
    resultCount === undefined
      ? t("search_ui.search_tutors")
      : t("search_ui.show_tutors", { count: resultCount });

  const quickPicks = [
    {
      id: "uni",
      label: t("search_ui.pick_uni"),
      icon: GraduationCap,
      active: draft.status === "uni_student",
      onToggle: () =>
        onDraftChange({ status: draft.status === "uni_student" ? undefined : "uni_student" }),
    },
    {
      id: "examiner",
      label: t("search_ui.pick_examiner"),
      icon: BadgeCheck,
      active: draft.status === "examiner",
      onToggle: () =>
        onDraftChange({ status: draft.status === "examiner" ? undefined : "examiner" }),
    },
    {
      id: "fullpart",
      label: t("search_ui.pick_full_part"),
      icon: Briefcase,
      active: draft.status === "full_part_time_tutor",
      onToggle: () =>
        onDraftChange({
          status: draft.status === "full_part_time_tutor" ? undefined : "full_part_time_tutor",
        }),
    },
    {
      id: "female",
      label: t("search_ui.pick_female"),
      icon: UserRound,
      active: draft.gender === "female",
      onToggle: () => onDraftChange({ gender: draft.gender === "female" ? undefined : "female" }),
    },
    {
      id: "male",
      label: t("search_ui.pick_male"),
      icon: Users,
      active: draft.gender === "male",
      onToggle: () => onDraftChange({ gender: draft.gender === "male" ? undefined : "male" }),
    },
    {
      id: "budget",
      label: t("search_ui.pick_budget"),
      icon: Coins,
      active: draft.max_price === 300,
      onToggle: () => onDraftChange({ max_price: draft.max_price === 300 ? undefined : 300 }),
    },
    {
      id: "online",
      label: t("search_ui.pick_online"),
      icon: Monitor,
      active: draft.mode === "online",
      onToggle: () => onDraftChange({ mode: draft.mode === "online" ? undefined : "online" }),
    },
    {
      id: "inperson",
      label: t("search_ui.pick_in_person"),
      icon: MapPin,
      active: draft.mode === "in_person",
      onToggle: () => onDraftChange({ mode: draft.mode === "in_person" ? undefined : "in_person" }),
    },
  ];

  const segments: PillSegment[] = [
    {
      id: "keyword",
      label: t("search_ui.segment_keyword"),
      title: t("search_ui.panel_keyword_title"),
      display: draft.q?.trim() ? draft.q : t("search_panel.keyword_placeholder"),
      filled: Boolean(draft.q?.trim()),
      grow: "flex-[1.3]",
      content: (
        <KeywordPanelContent
          value={draft.q ?? ""}
          onValueChange={(q) => onDraftChange({ q: q || undefined })}
          placeholder={t("search_panel.keyword_placeholder")}
          ariaLabel={t("search_panel.keyword_aria")}
        />
      ),
    },
    {
      id: "category",
      label: t("search_ui.segment_curriculum"),
      display: draft.category ? categoryLabel(draft.category) : t("search_ui.any_value"),
      filled: Boolean(draft.category),
      options: categoryOptions,
      currentValue: draft.category,
      searchPlaceholder: t("search_panel.search_category"),
      emptyText: t("search_panel.no_matches"),
      onSelect: handleCategorySelect,
    },
    {
      id: "subject",
      label: t("search_ui.segment_subject"),
      display: draft.subject ?? t("search_ui.any_value"),
      filled: Boolean(draft.subject),
      options: subjectOptions.map((subject) => ({ value: subject, label: subject })),
      currentValue: draft.subject,
      searchPlaceholder: t("search_panel.search_subject"),
      emptyText: t("search_panel.no_matches"),
      onSelect: (value) => onDraftChange({ subject: value || undefined }),
    },
    {
      id: "mode",
      label: t("search_ui.segment_mode"),
      display: modeDisplay,
      filled: Boolean(draft.mode),
      panelClassName: "w-[min(22rem,calc(100vw-2rem))]",
      content: (
        <ModePanelContent
          mode={draft.mode ?? ""}
          station={draft.station}
          onChange={handleModeChange}
        />
      ),
    },
  ];

  const overlayTabs: MobileSearchTab[] = [
    {
      id: "tutors",
      label: t("search_ui.tab_tutors"),
      icon: <GraduationCap className="h-5 w-5" aria-hidden="true" />,
      active: true,
      onSelect: () => {},
    },
    ...(CENTRE_MARKET_ENABLED
      ? [
          {
            id: "courses",
            label: t("search_ui.tab_courses"),
            icon: <BookOpen className="h-5 w-5" aria-hidden="true" />,
            active: false,
            onSelect: () => {
              setSearchSlideDirection("next");
              void navigate({
                to: "/courses",
                search: { q: draft.q, subject: draft.subject, mode: draft.mode, open: true },
              });
            },
          },
        ]
      : []),
    {
      id: "cases",
      label: t("search_ui.tab_cases"),
      icon: <ClipboardList className="h-5 w-5" aria-hidden="true" />,
      active: false,
      onSelect: () => {
        setSearchSlideDirection("next");
        void navigate({ to: "/tutor-requests", search: { q: draft.q, open: true } });
      },
    },
  ];

  return (
    <div className={className}>
      <div className="hidden items-stretch gap-2 lg:flex">
        <SearchPillBar
          segments={segments}
          submitLabel={t("search_panel.search")}
          submitColor="blue"
          onSubmit={() => onApply()}
          className="min-w-0 flex-1"
        />
        <FiltersPillButton
          label={t("search_ui.filters")}
          count={filterCount || undefined}
          onClick={() => setFiltersOpen(true)}
        />
      </div>

      <FiltersDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        clearLabel={t("search_ui.clear_all")}
        applyLabel={applyLabel}
        onClear={onClear}
        onApply={() => onApply()}
        footerExtra={
          whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[color:var(--brand-whatsapp)] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[color:var(--brand-whatsapp-hover)]"
            >
              <WhatsAppIcon className="h-4 w-4" aria-hidden="true" />
              {t("directory.empty_whatsapp")}
            </a>
          ) : undefined
        }
      >
        <FiltersSection id="recommended" title={t("search_ui.quick_title")}>
          <FilterQuickPicks options={quickPicks} />
        </FiltersSection>
        <FiltersSection
          id="price"
          title={t("search_panel.price_range")}
          hint={t("search_ui.price_hint")}
        >
          <PriceFields
            priceValue={priceValue}
            histogram={priceHistogram}
            onDraftChange={onDraftChange}
          />
        </FiltersSection>
        <FiltersSection id="gender" title={t("search_ui.gender_title")}>
          <Segmented
            aria-label={t("search_panel.any_gender")}
            value={draft.gender ?? ""}
            onChange={(gender) => onDraftChange({ gender: gender || undefined })}
            options={genderOptions}
            className="max-w-xs"
          />
        </FiltersSection>
        <FiltersSection id="status" title={t("search_ui.status_title")}>
          <SearchableSelect
            value={draft.status ?? ""}
            onChange={(value) => onDraftChange({ status: value || undefined })}
            options={statusOptions}
            placeholder={t("search_panel.any_status")}
            className="h-11 rounded-xl"
          />
        </FiltersSection>
        <FiltersSection id="sort" title={t("search_ui.sort_title")}>
          <SearchableSelect
            value={draft.sort ?? ""}
            onChange={(value) => onDraftChange({ sort: value || undefined })}
            options={sortOptions}
            placeholder={t("search_panel.sort_recommended")}
            searchPlaceholder={t("search_panel.search_sorting")}
            className="h-11 rounded-xl"
          />
        </FiltersSection>
      </FiltersDialog>

      <MobileSearchTrigger
        label={t("search_ui.start_search")}
        onClick={() => setOverlayOpen(true)}
      />

      <MobileSearchOverlay
        open={overlayOpen}
        onOpenChange={setOverlayOpen}
        tabs={overlayTabs}
        clearLabel={t("search_ui.clear_all")}
        submitLabel={applyLabel}
        onClear={onClear}
        onSubmit={() => {
          onApply();
          setOverlayOpen(false);
        }}
      >
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-xl font-bold tracking-tight text-[color:var(--ink)]">
              {t("search_ui.panel_keyword_title")}
            </p>
            <SearchBigInput
              value={draft.q ?? ""}
              onValueChange={(q) => onDraftChange({ q: q || undefined })}
              onEnter={() => onApply()}
              placeholder={t("search_panel.keyword_placeholder")}
              ariaLabel={t("search_panel.keyword_aria")}
            />
          </div>

          <div className="space-y-1.5">
            <PanelLabel>{t("search_ui.segment_curriculum")}</PanelLabel>
            <SearchableSelect
              value={draft.category ?? ""}
              onChange={handleCategorySelect}
              options={[{ value: "", label: t("search_panel.any_category") }, ...categoryOptions]}
              placeholder={t("search_panel.any_category")}
              searchPlaceholder={t("search_panel.search_category")}
              className="h-12 rounded-2xl"
            />
          </div>

          <div className="space-y-1">
            <PanelLabel>{t("search_ui.suggested_subjects")}</PanelLabel>
            <div className="-mx-2">
              {suggestedSubjects.slice(0, 5).map((subject) => (
                <SuggestedRow
                  key={subject}
                  title={subject}
                  hint={t("search_ui.suggested_hint")}
                  onClick={() => {
                    onApply({ q: subject });
                    setOverlayOpen(false);
                  }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <PanelLabel>{t("search_ui.segment_mode")}</PanelLabel>
            <ModePanelContent
              mode={draft.mode ?? ""}
              station={draft.station}
              onChange={handleModeChange}
            />
          </div>

          <div className="space-y-2">
            <PanelLabel>{t("search_ui.gender_title")}</PanelLabel>
            <Segmented
              aria-label={t("search_panel.any_gender")}
              value={draft.gender ?? ""}
              onChange={(gender) => onDraftChange({ gender: gender || undefined })}
              options={genderOptions}
            />
          </div>

          <div>
            <button
              type="button"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-2 rounded-xl px-1 py-2 text-[15px] font-semibold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--foreground)]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <span className="flex items-center gap-2">
                {t("search_ui.more_filters")}
                {filterCount > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--brand-link)] px-1.5 text-[11px] font-bold text-white">
                    {filterCount}
                  </span>
                ) : null}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  moreOpen && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>
            {moreOpen ? (
              <div className="mt-2 space-y-5 border-t border-border pt-4">
                <div className="space-y-2">
                  <PanelLabel>{t("search_ui.status_title")}</PanelLabel>
                  <SearchableSelect
                    value={draft.status ?? ""}
                    onChange={(value) => onDraftChange({ status: value || undefined })}
                    options={statusOptions}
                    placeholder={t("search_panel.any_status")}
                    className="h-12 rounded-2xl"
                  />
                </div>
                <div className="space-y-2.5">
                  <Label className="text-sm tabular-nums text-[color:var(--ink)]">
                    {t("search_panel.price_from")} {formatPrice(priceValue[0])}{" "}
                    {t("search_panel.price_to")} {formatPrice(priceValue[1])}
                  </Label>
                  <PriceFields priceValue={priceValue} onDraftChange={onDraftChange} />
                </div>
                <div className="space-y-2">
                  <PanelLabel>{t("search_ui.sort_title")}</PanelLabel>
                  <SearchableSelect
                    value={draft.sort ?? ""}
                    onChange={(value) => onDraftChange({ sort: value || undefined })}
                    options={sortOptions}
                    placeholder={t("search_panel.sort_recommended")}
                    searchPlaceholder={t("search_panel.search_sorting")}
                    className="h-12 rounded-2xl"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </MobileSearchOverlay>
    </div>
  );
}

/** Airbnb-style price range: histogram (optional) + slider + min/max pills. */
function PriceFields({
  priceValue,
  onDraftChange,
  histogram,
}: {
  priceValue: [number, number];
  onDraftChange: (patch: Partial<TutorsSearchState>) => void;
  histogram?: Array<{ level: number; inRange: boolean }> | null;
}) {
  const { t } = useTranslation();
  const span = PRICE_MAX - PRICE_MIN;
  return (
    <div className="space-y-3">
      {histogram ? (
        <div className="flex h-10 items-end gap-px" aria-hidden="true">
          {histogram.map((bucket, index) => (
            <span
              key={index}
              className={cn(
                "w-full min-w-px",
                bucket.inRange
                  ? "bg-[color:var(--brand-royal)]"
                  : "bg-[color:var(--foreground)]/[0.18]",
              )}
              style={{ height: `${Math.max(10, Math.round(bucket.level * 100))}%` }}
            />
          ))}
        </div>
      ) : null}
      <Slider
        value={priceValue}
        onValueChange={([lo, hi]) =>
          onDraftChange({
            min_price: lo > PRICE_MIN ? lo : undefined,
            max_price: hi < PRICE_MAX ? hi : undefined,
          })
        }
        min={PRICE_MIN}
        max={PRICE_MAX}
        step={PRICE_STEP}
        minStepsBetweenThumbs={1}
        showTooltip
        tooltipContent={formatPrice}
        aria-label={t("search_panel.price_range")}
      />
      <div className="flex items-end justify-between gap-3">
        <div className="w-28 space-y-1.5">
          <span className="text-xs font-semibold text-[color:var(--ink)]/70">
            {t("search_ui.price_min")}
          </span>
          <Input
            type="number"
            inputMode="numeric"
            min={PRICE_MIN}
            max={priceValue[1] - PRICE_STEP}
            step={PRICE_STEP}
            value={priceValue[0]}
            onChange={(event) => {
              const raw = Number(event.target.value);
              if (!Number.isFinite(raw)) return;
              const clamped = Math.min(Math.max(raw, PRICE_MIN), priceValue[1] - PRICE_STEP);
              onDraftChange({ min_price: clamped > PRICE_MIN ? clamped : undefined });
            }}
            aria-label={t("search_ui.price_min")}
            className="h-11 rounded-full border-[color:var(--ink)]/15 bg-card text-center font-semibold tabular-nums"
          />
        </div>
        <div className="w-28 space-y-1.5">
          <span className="text-xs font-semibold text-[color:var(--ink)]/70">
            {t("search_ui.price_max")}
          </span>
          <Input
            type="number"
            inputMode="numeric"
            min={priceValue[0] + PRICE_STEP}
            max={PRICE_MAX}
            step={PRICE_STEP}
            value={priceValue[1]}
            onChange={(event) => {
              const raw = Number(event.target.value);
              if (!Number.isFinite(raw)) return;
              const clamped = Math.min(Math.max(raw, priceValue[0] + PRICE_STEP), PRICE_MAX);
              onDraftChange({ max_price: clamped < PRICE_MAX ? clamped : undefined });
            }}
            aria-label={t("search_ui.price_max")}
            className="h-11 rounded-full border-[color:var(--ink)]/15 bg-card text-center font-semibold tabular-nums"
          />
        </div>
      </div>
    </div>
  );
}

function ModePanelContent({
  mode,
  station,
  onChange,
}: {
  mode: string;
  station?: string;
  onChange: (next: { mode: string; station?: string }) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <Segmented
        aria-label={t("search_panel.any_mode")}
        value={mode}
        onChange={(nextMode) =>
          onChange({
            mode: nextMode,
            station: nextMode === "in_person" ? station : undefined,
          })
        }
        options={[
          { value: "", label: t("search_ui.mode_any") },
          { value: "online", label: t("search_ui.mode_online") },
          { value: "in_person", label: t("search_ui.mode_in_person") },
        ]}
      />
      {mode === "in_person" ? (
        <div className="max-h-72 overflow-hidden rounded-2xl border border-border">
          <MtrStationPickerContent
            value={station}
            showAnyOption={false}
            onSelect={(nextStation) => onChange({ mode: "in_person", station: nextStation })}
            listClassName="max-h-56"
          />
        </div>
      ) : null}
    </div>
  );
}
