import {
  BadgeCheck,
  BookOpen,
  ClipboardList,
  Gift,
  GraduationCap,
  HeartHandshake,
  MapPin,
  Monitor,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PanelLabel, SearchBigInput, Segmented } from "./search-controls";
import { KeywordPanelContent, SearchPillBar, type PillSegment } from "./search-pill-bar";
import { MobileSearchOverlay, type MobileSearchTab } from "./mobile-search-overlay";
import { setSearchSlideDirection } from "./slide-direction";
import { MobileSearchTrigger } from "./mobile-search-trigger";
import {
  FilterQuickPicks,
  FiltersDialog,
  FiltersPillButton,
  FiltersSection,
} from "./filters-dialog";
import { SubjectMultiSelect } from "./subject-multi-select";
import type { CompactSegment } from "./sticky-search-group";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";
import { HK_DISTRICTS } from "@/features/tutors/queries";
import { PRESET_PROFILE_TAGS } from "@/features/tutors/profile-tags";
import {
  countCaseAdvancedFilters,
  getSelectedCaseTags,
  type CaseBoardFilters,
} from "@/features/cases/case-filters";
import { caseFeePillKey, type CasePackageType } from "@/features/cases/case-card";
// Board subject options share the tutor vocabulary (the case form narrows
// through case-options' curriculum wrapper; the board's category values map
// 1:1, and an unset category falls back to the default pool).
import { getSubjectOptionsForCategory } from "@/features/tutors/subjects";

export type CasesSearchState = CaseBoardFilters & {
  q?: string;
  category?: string;
  district?: string;
  /** Issue #311: active single-tag chip filter. Lives on the route, not the
   * search bar draft, applySearch preserves it, clearSearch clears it.
   * Multi-tag picks (advanced filters) live in `tags`. */
  tag?: string;
};

type CasesSearchProps = {
  draft: CasesSearchState;
  onDraftChange: (patch: Partial<CasesSearchState>) => void;
  /** Apply the current draft (navigate). `override` merges values set in the same event. */
  onApply: (override?: Partial<CasesSearchState>) => void;
  onClear: () => void;
  /** Open the mobile overlay on mount (used when hopping between search tabs). */
  defaultOverlayOpen?: boolean;
  className?: string;
};

const caseCategoryLabel = (value: string, t: (key: string) => string) => {
  if (value === "Primary School") return t("search_panel.category_primary_school");
  if (value === "Junior Secondary") return t("search_panel.category_junior_secondary");
  if (value === "Admissions") return t("search_panel.category_admissions");
  if (value === "Other") return t("search_ui.case_other");
  return value;
};

const TIER_FILTER_OPTIONS = ["kindergarten", "primary_secondary", "university"] as const;

const tierFilterLabel = (tier: string, t: (key: string) => string) => {
  if (tier === "kindergarten") return t("tutors.tier_kindergarten");
  if (tier === "university") return t("tutors.tier_university");
  return t("tutors.tier_primary_secondary");
};

const PACKAGE_TYPES: CasePackageType[] = ["ongoing_1_5", "short_20", "pro_bono"];

const caseModeDisplay = (draft: CasesSearchState, t: (key: string) => string) => {
  if (draft.mode === "online") return t("search_ui.mode_online");
  if (draft.mode === "in_person") return t("search_ui.mode_in_person");
  return t("search_ui.any_value");
};

/** Segments for the compact nav pill, Airbnb "Anywhere | Anytime" style. */
export function useCasesCompactSegments(draft: CasesSearchState): CompactSegment[] {
  const { t } = useTranslation();
  return [
    {
      id: "keyword",
      text: draft.q?.trim() || t("search_ui.compact_any_keyword"),
    },
    {
      id: "category",
      text: draft.category
        ? caseCategoryLabel(draft.category, t)
        : t("search_ui.compact_any_curriculum"),
    },
    {
      id: "subject",
      text: draft.subject || t("search_ui.compact_any_subject"),
    },
    {
      id: "mode",
      text: draft.mode ? caseModeDisplay(draft, t) : t("search_ui.compact_any_mode"),
    },
    {
      id: "district",
      text: draft.district || t("search_ui.compact_anywhere"),
    },
  ];
}

// --- Shared advanced-filter field bodies (dialog + mobile overlay) ---

function CaseTierContent({
  draft,
  onDraftChange,
}: {
  draft: CasesSearchState;
  onDraftChange: (patch: Partial<CasesSearchState>) => void;
}) {
  const { t } = useTranslation();
  return (
    <Segmented
      ariaLabel={t("tutors.tier_aria")}
      value={draft.tier ?? ""}
      onChange={(tier) => onDraftChange({ tier: tier || undefined })}
      options={[
        { value: "", label: t("search_ui.any_value") },
        ...TIER_FILTER_OPTIONS.map((tier) => ({ value: tier, label: tierFilterLabel(tier, t) })),
      ]}
    />
  );
}

function CaseFeeContent({
  draft,
  onDraftChange,
}: {
  draft: CasesSearchState;
  onDraftChange: (patch: Partial<CasesSearchState>) => void;
}) {
  const { t } = useTranslation();
  return (
    <Segmented
      ariaLabel={t("search_ui.case_fee_title")}
      value={draft.fee ?? ""}
      onChange={(fee) => onDraftChange({ fee: fee || undefined })}
      options={[
        { value: "", label: t("search_ui.any_value") },
        ...PACKAGE_TYPES.map((type) => ({ value: type, label: t(caseFeePillKey(type)) })),
      ]}
    />
  );
}

function CaseBackgroundContent({
  draft,
  onDraftChange,
  className,
}: {
  draft: CasesSearchState;
  onDraftChange: (patch: Partial<CasesSearchState>) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <SearchableSelect
      value={draft.background ?? ""}
      onChange={(value) => onDraftChange({ background: value || undefined })}
      options={[
        { value: "", label: t("search_panel.any_status") },
        { value: "uni_student", label: t("search_panel.status_uni_student") },
        { value: "official_examiner", label: t("search_panel.status_examiner") },
      ]}
      placeholder={t("search_panel.any_status")}
      className={className}
    />
  );
}

function CaseGenderContent({
  draft,
  onDraftChange,
}: {
  draft: CasesSearchState;
  onDraftChange: (patch: Partial<CasesSearchState>) => void;
}) {
  const { t } = useTranslation();
  return (
    <Segmented
      ariaLabel={t("search_panel.any_gender")}
      value={draft.gender ?? ""}
      onChange={(gender) => onDraftChange({ gender: gender || undefined })}
      options={[
        { value: "", label: t("search_ui.gender_any") },
        { value: "female", label: t("search_panel.gender_female") },
        { value: "male", label: t("search_panel.gender_male") },
      ]}
    />
  );
}

function CaseLanguageContent({
  draft,
  onDraftChange,
}: {
  draft: CasesSearchState;
  onDraftChange: (patch: Partial<CasesSearchState>) => void;
}) {
  const { t } = useTranslation();
  return (
    <Segmented
      ariaLabel={t("search_ui.case_lang_title")}
      value={draft.language ?? ""}
      onChange={(language) => onDraftChange({ language: language || undefined })}
      options={[
        { value: "", label: t("search_ui.any_value") },
        { value: "english", label: t("search_ui.lang_english") },
        { value: "cantonese", label: t("search_ui.lang_cantonese") },
      ]}
    />
  );
}

function CaseSenContent({
  draft,
  onDraftChange,
}: {
  draft: CasesSearchState;
  onDraftChange: (patch: Partial<CasesSearchState>) => void;
}) {
  const { t } = useTranslation();
  return (
    <label className="flex w-fit cursor-pointer items-center gap-3 text-sm font-medium text-[color:var(--ink)]">
      <Checkbox
        checked={draft.sen === true}
        onCheckedChange={(checked) => onDraftChange({ sen: checked === true ? true : undefined })}
      />
      {t("case_board.chip_sen")}
    </label>
  );
}

/** HKD rate bounds, min/max inputs, no histogram (few cases vs tutors). */
function CaseRateFields({
  draft,
  onDraftChange,
}: {
  draft: CasesSearchState;
  onDraftChange: (patch: Partial<CasesSearchState>) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="w-28 space-y-1.5">
        <span className="text-xs font-medium text-[color:var(--ink)]/70">
          {t("search_ui.price_min")}
        </span>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          value={draft.rate_min ?? ""}
          onChange={(event) => {
            const raw = Number(event.target.value);
            onDraftChange({ rate_min: Number.isFinite(raw) && raw > 0 ? raw : undefined });
          }}
          aria-label={t("search_ui.price_min")}
          className="h-11 rounded-full border-[color:var(--ink)]/15 bg-card text-center font-medium tabular-nums"
        />
      </div>
      <div className="w-28 space-y-1.5">
        <span className="text-xs font-medium text-[color:var(--ink)]/70">
          {t("search_ui.price_max")}
        </span>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          value={draft.rate_max ?? ""}
          onChange={(event) => {
            const raw = Number(event.target.value);
            onDraftChange({ rate_max: Number.isFinite(raw) && raw > 0 ? raw : undefined });
          }}
          aria-label={t("search_ui.price_max")}
          className="h-11 rounded-full border-[color:var(--ink)]/15 bg-card text-center font-medium tabular-nums"
        />
      </div>
    </div>
  );
}

/** Issue #423 section 2B: the shared requirement-tag vocabulary (#217/#311
 * presets) as multi-select chips, ALL picks must match. */
function CaseTagsContent({
  draft,
  onDraftChange,
}: {
  draft: CasesSearchState;
  onDraftChange: (patch: Partial<CasesSearchState>) => void;
}) {
  const { t } = useTranslation();
  const selectedTags = getSelectedCaseTags(draft);
  return (
    <SubjectMultiSelect
      options={[...PRESET_PROFILE_TAGS]}
      selected={selectedTags}
      onToggle={(tag) => {
        const next = selectedTags.includes(tag)
          ? selectedTags.filter((value) => value !== tag)
          : [...selectedTags, tag];
        onDraftChange({ tags: next.length > 0 ? next.join("||") : undefined });
      }}
      onClear={() => onDraftChange({ tags: undefined })}
      clearLabel={t("search_ui.clear_tags")}
      searchPlaceholder={t("search_ui.search_tags")}
      emptyText={t("search_panel.no_matches")}
    />
  );
}

/** Mode radio row shared by the pill panel and the mobile overlay. */
function CaseModeContent({
  draft,
  onDraftChange,
}: {
  draft: CasesSearchState;
  onDraftChange: (patch: Partial<CasesSearchState>) => void;
}) {
  const { t } = useTranslation();
  return (
    <Segmented
      ariaLabel={t("search_ui.segment_mode")}
      value={draft.mode ?? ""}
      onChange={(mode) => onDraftChange({ mode: mode || undefined })}
      options={[
        { value: "", label: t("search_ui.mode_any") },
        { value: "online", label: t("search_ui.mode_online") },
        { value: "in_person", label: t("search_ui.mode_in_person") },
      ]}
    />
  );
}

/** Quick picks shared by the desktop filters dialog and the mobile overlay. */
function caseQuickPicks(
  draft: CasesSearchState,
  onDraftChange: (patch: Partial<CasesSearchState>) => void,
  t: (key: string) => string,
) {
  return [
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
    {
      id: "probono",
      label: t("case_board.fee_pill_pro_bono"),
      icon: Gift,
      active: draft.fee === "pro_bono",
      onToggle: () => onDraftChange({ fee: draft.fee === "pro_bono" ? undefined : "pro_bono" }),
    },
    {
      id: "sen",
      label: "SEN",
      icon: HeartHandshake,
      active: draft.sen === true,
      onToggle: () => onDraftChange({ sen: draft.sen === true ? undefined : true }),
    },
    {
      id: "examiner",
      label: t("search_ui.pick_examiner"),
      icon: BadgeCheck,
      active: draft.background === "official_examiner",
      onToggle: () =>
        onDraftChange({
          background: draft.background === "official_examiner" ? undefined : "official_examiner",
        }),
    },
  ];
}

/**
 * Desktop Airbnb-style pill row (segment bar + advanced filters) for the case
 * board, hosted by StickySearchBar so it pins under the nav and retracts on
 * scroll.
 */
export function CasesSearchBar({
  draft,
  onDraftChange,
  onApply,
  onClear,
  className,
}: Omit<CasesSearchProps, "defaultOverlayOpen">) {
  const { t } = useTranslation();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const subjectOptions = getSubjectOptionsForCategory(draft.category);

  const handleCategorySelect = (category: string) => {
    // Keep the subject pick only when the new curriculum still offers it.
    const nextSubjects = getSubjectOptionsForCategory(category);
    onDraftChange({
      category: category || undefined,
      subject: draft.subject && nextSubjects.includes(draft.subject) ? draft.subject : undefined,
    });
  };

  const segments: PillSegment[] = [
    {
      id: "keyword",
      label: t("search_ui.segment_keyword"),
      title: t("search_ui.panel_keyword_title"),
      display: draft.q?.trim() ? draft.q : t("search_ui.cases_placeholder"),
      filled: Boolean(draft.q?.trim()),
      grow: "flex-[1.3]",
      content: (
        <KeywordPanelContent
          value={draft.q ?? ""}
          onValueChange={(q) => onDraftChange({ q: q || undefined })}
          placeholder={t("search_ui.cases_placeholder")}
          ariaLabel={t("search_ui.cases_placeholder")}
        />
      ),
    },
    {
      id: "category",
      label: t("search_ui.segment_curriculum"),
      display: draft.category ? caseCategoryLabel(draft.category, t) : t("search_ui.any_value"),
      filled: Boolean(draft.category),
      options: CASE_CATEGORY_VALUES.map((value) => ({
        value,
        label: caseCategoryLabel(value, t),
      })),
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
      display: caseModeDisplay(draft, t),
      filled: Boolean(draft.mode),
      content: <CaseModeContent draft={draft} onDraftChange={onDraftChange} />,
    },
    {
      id: "district",
      label: t("search_ui.segment_district"),
      display: draft.district ?? t("search_ui.any_value"),
      filled: Boolean(draft.district),
      options: HK_DISTRICTS.map((district) => ({
        value: district,
        label: district,
      })),
      currentValue: draft.district,
      searchPlaceholder: t("search_panel.search_subject"),
      emptyText: t("search_panel.no_matches"),
      onSelect: (value) => onDraftChange({ district: value || undefined }),
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
        {/* Issue #423 ship-order 5: advanced filters, the dialog carries the
            secondary chips + the dropdowns that don't fit the pill bar. */}
        <FiltersPillButton
          label={t("search_ui.filters")}
          count={countCaseAdvancedFilters(draft) || undefined}
          onClick={() => setFiltersOpen(true)}
        />
      </div>

      <FiltersDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        clearLabel={t("search_ui.clear_all")}
        applyLabel={t("search_panel.search")}
        onClear={onClear}
        onApply={() => onApply()}
      >
        <FiltersSection id="quick" title={t("search_ui.quick_title")}>
          <FilterQuickPicks options={caseQuickPicks(draft, onDraftChange, t)} />
        </FiltersSection>
        <FiltersSection id="level" title={t("search_ui.case_tier_title")}>
          <CaseTierContent draft={draft} onDraftChange={onDraftChange} />
        </FiltersSection>
        <FiltersSection id="fee" title={t("search_ui.case_fee_title")}>
          <CaseFeeContent draft={draft} onDraftChange={onDraftChange} />
        </FiltersSection>
        <FiltersSection id="status" title={t("search_ui.status_title")}>
          <CaseBackgroundContent
            draft={draft}
            onDraftChange={onDraftChange}
            className="h-11 rounded-xl"
          />
        </FiltersSection>
        <FiltersSection id="gender" title={t("search_ui.gender_title")}>
          <CaseGenderContent draft={draft} onDraftChange={onDraftChange} />
        </FiltersSection>
        <FiltersSection id="language" title={t("search_ui.case_lang_title")}>
          <CaseLanguageContent draft={draft} onDraftChange={onDraftChange} />
        </FiltersSection>
        <FiltersSection id="sen" title={t("sen.filter_title")}>
          <CaseSenContent draft={draft} onDraftChange={onDraftChange} />
        </FiltersSection>
        <FiltersSection id="rate" title={t("search_ui.case_rate_title")}>
          <CaseRateFields draft={draft} onDraftChange={onDraftChange} />
        </FiltersSection>
        <FiltersSection id="tags" title={t("search_ui.case_tags_title")}>
          <CaseTagsContent draft={draft} onDraftChange={onDraftChange} />
        </FiltersSection>
      </FiltersDialog>
    </div>
  );
}

/** Mobile search entry for the case board, rendered inside the hero. */
export function CasesSearchMobile({
  draft,
  onDraftChange,
  onApply,
  onClear,
  defaultOverlayOpen,
  className,
}: CasesSearchProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [overlayOpen, setOverlayOpen] = useState(Boolean(defaultOverlayOpen));

  const subjectOptions = getSubjectOptionsForCategory(draft.category);

  const handleCategorySelect = (category: string) => {
    const nextSubjects = getSubjectOptionsForCategory(category);
    onDraftChange({
      category: category || undefined,
      subject: draft.subject && nextSubjects.includes(draft.subject) ? draft.subject : undefined,
    });
  };

  const overlayTabs: MobileSearchTab[] = [
    {
      id: "tutors",
      label: t("search_ui.tab_tutors"),
      icon: <GraduationCap className="h-5 w-5" aria-hidden="true" />,
      active: false,
      onSelect: () => {
        setSearchSlideDirection("prev");
        void navigate({
          to: "/tutors",
          search: { q: draft.q, mode: undefined, subject: undefined, open: true },
        });
      },
    },
    ...(CENTRE_MARKET_ENABLED
      ? [
          {
            id: "courses",
            label: t("search_ui.tab_courses"),
            icon: <BookOpen className="h-5 w-5" aria-hidden="true" />,
            active: false,
            onSelect: () => {
              setSearchSlideDirection("prev");
              void navigate({
                to: "/courses",
                search: { q: draft.q, subject: undefined, mode: undefined, open: true },
              });
            },
          },
        ]
      : []),
    {
      id: "cases",
      label: t("search_ui.tab_cases"),
      icon: <ClipboardList className="h-5 w-5" aria-hidden="true" />,
      active: true,
      onSelect: () => {},
    },
  ];

  return (
    <div className={className}>
      <MobileSearchTrigger
        label={t("search_ui.start_search")}
        onClick={() => setOverlayOpen(true)}
      />

      <MobileSearchOverlay
        open={overlayOpen}
        onOpenChange={setOverlayOpen}
        tabs={overlayTabs}
        clearLabel={t("search_ui.clear_all")}
        submitLabel={t("search_panel.search")}
        onClear={onClear}
        onSubmit={() => {
          onApply();
          setOverlayOpen(false);
        }}
      >
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-xl font-medium tracking-tight text-[color:var(--ink)]">
              {t("search_ui.panel_keyword_title")}
            </p>
            <SearchBigInput
              value={draft.q ?? ""}
              onValueChange={(q) => onDraftChange({ q: q || undefined })}
              onEnter={() => onApply()}
              placeholder={t("search_ui.cases_placeholder")}
              ariaLabel={t("search_ui.cases_placeholder")}
            />
          </div>

          <div className="space-y-2">
            <PanelLabel>{t("search_ui.quick_title")}</PanelLabel>
            <FilterQuickPicks options={caseQuickPicks(draft, onDraftChange, t)} />
          </div>

          <div className="space-y-1.5">
            <PanelLabel>{t("search_ui.segment_curriculum")}</PanelLabel>
            <SearchableSelect
              value={draft.category ?? ""}
              onChange={handleCategorySelect}
              options={[
                { value: "", label: t("search_panel.any_category") },
                ...CASE_CATEGORY_VALUES.map((value) => ({
                  value,
                  label: caseCategoryLabel(value, t),
                })),
              ]}
              placeholder={t("search_panel.any_category")}
              searchPlaceholder={t("search_panel.search_category")}
              className="h-12 rounded-2xl"
            />
          </div>

          <div className="space-y-1.5">
            <PanelLabel>{t("search_ui.segment_subject")}</PanelLabel>
            <SearchableSelect
              value={draft.subject ?? ""}
              onChange={(value) => onDraftChange({ subject: value || undefined })}
              options={[
                { value: "", label: t("search_ui.compact_any_subject") },
                ...subjectOptions.map((subject) => ({ value: subject, label: subject })),
              ]}
              placeholder={t("search_ui.compact_any_subject")}
              searchPlaceholder={t("search_panel.search_subject")}
              className="h-12 rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <PanelLabel>{t("search_ui.segment_mode")}</PanelLabel>
            <CaseModeContent draft={draft} onDraftChange={onDraftChange} />
          </div>

          <div className="space-y-1.5">
            <PanelLabel>{t("search_ui.segment_district")}</PanelLabel>
            <SearchableSelect
              value={draft.district ?? ""}
              onChange={(value) => onDraftChange({ district: value || undefined })}
              options={[
                { value: "", label: t("search_ui.any_district") },
                ...HK_DISTRICTS.map((district) => ({ value: district, label: district })),
              ]}
              placeholder={t("search_ui.any_district")}
              searchPlaceholder={t("search_panel.search_subject")}
              className="h-12 rounded-2xl"
            />
          </div>

          {/* Issue #423 ship-order 5: the advanced filter sections. */}
          <div className="space-y-2">
            <PanelLabel>{t("search_ui.case_tier_title")}</PanelLabel>
            <CaseTierContent draft={draft} onDraftChange={onDraftChange} />
          </div>

          <div className="space-y-2">
            <PanelLabel>{t("search_ui.case_fee_title")}</PanelLabel>
            <CaseFeeContent draft={draft} onDraftChange={onDraftChange} />
          </div>

          <div className="space-y-2">
            <PanelLabel>{t("search_ui.status_title")}</PanelLabel>
            <CaseBackgroundContent
              draft={draft}
              onDraftChange={onDraftChange}
              className="h-12 rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <PanelLabel>{t("search_ui.gender_title")}</PanelLabel>
            <CaseGenderContent draft={draft} onDraftChange={onDraftChange} />
          </div>

          <div className="space-y-2">
            <PanelLabel>{t("search_ui.case_lang_title")}</PanelLabel>
            <CaseLanguageContent draft={draft} onDraftChange={onDraftChange} />
          </div>

          <div className="space-y-2">
            <PanelLabel>{t("sen.filter_title")}</PanelLabel>
            <CaseSenContent draft={draft} onDraftChange={onDraftChange} />
          </div>

          <div className="space-y-2.5">
            <PanelLabel>{t("search_ui.case_rate_title")}</PanelLabel>
            <CaseRateFields draft={draft} onDraftChange={onDraftChange} />
          </div>

          <div className="space-y-2">
            <PanelLabel>{t("search_ui.case_tags_title")}</PanelLabel>
            <CaseTagsContent draft={draft} onDraftChange={onDraftChange} />
          </div>
        </div>
      </MobileSearchOverlay>
    </div>
  );
}

/** Combined composition (kept for parity with the tutors search). */
export function CasesSearch(props: CasesSearchProps) {
  const { className, ...rest } = props;
  return (
    <div className={className}>
      <CasesSearchBar {...rest} />
      <CasesSearchMobile {...rest} />
    </div>
  );
}

/* Preserved original lists from cases-search.tsx. */
const CASE_CATEGORY_VALUES = [
  "IB",
  "DSE",
  "IGCSE",
  "AP",
  "A-Level",
  "Primary School",
  "Junior Secondary",
  "Admissions",
  "Other",
];
