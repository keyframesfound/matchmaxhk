import { ClipboardList, GraduationCap, BookOpen } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PanelLabel, SearchBigInput, SuggestedRow, type OptionRow } from "./search-controls";
import { KeywordPanelContent, SearchPillBar, type PillSegment } from "./search-pill-bar";
import { MobileSearchOverlay, type MobileSearchTab } from "./mobile-search-overlay";
import { setSearchSlideDirection } from "./slide-direction";
import { MobileSearchTrigger } from "./mobile-search-trigger";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";
import { HK_DISTRICTS } from "@/features/tutors/queries";

export type CasesSearchState = {
  q?: string;
  category?: string;
  district?: string;
};

type CasesSearchProps = {
  draft: CasesSearchState;
  onDraftChange: (patch: Partial<CasesSearchState>) => void;
  /** Apply the current draft (navigate). `override` merges values set in the same event. */
  onApply: (override?: Partial<CasesSearchState>) => void;
  onClear: () => void;
  /** Subjects on the board — powers the suggested rows in the mobile overlay. */
  subjectOptions?: string[];
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

/** One-line summary for the compact nav pill while the full bar is retracted. */
export function useCasesCompactSummary(draft: CasesSearchState): string {
  const { t } = useTranslation();
  const parts = [
    draft.q?.trim() ?? "",
    draft.category ? caseCategoryLabel(draft.category, t) : "",
    draft.district ?? "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : t("search_ui.cases_placeholder");
}

/**
 * Desktop Airbnb-style pill row (segment bar) for the case board,
 * hosted by StickySearchBar so it pins under the nav and retracts on scroll.
 */
export function CasesSearchBar({
  draft,
  onDraftChange,
  onApply,
  onClear,
  className,
}: Omit<CasesSearchProps, "defaultOverlayOpen">) {
  const { t } = useTranslation();

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
      onSelect: (value) => onDraftChange({ category: value || undefined }),
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
      </div>
    </div>
  );
}

/** Mobile search entry for the case board, rendered inside the hero. */
export function CasesSearchMobile({
  draft,
  onDraftChange,
  onApply,
  onClear,
  subjectOptions,
  defaultOverlayOpen,
  className,
}: CasesSearchProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [overlayOpen, setOverlayOpen] = useState(Boolean(defaultOverlayOpen));

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
            <p className="mb-2 text-xl font-bold tracking-tight text-[color:var(--ink)]">
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

          <div className="space-y-1.5">
            <PanelLabel>{t("search_ui.segment_curriculum")}</PanelLabel>
            <SearchableSelect
              value={draft.category ?? ""}
              onChange={(value) => onDraftChange({ category: value || undefined })}
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

          {(subjectOptions?.length ?? 0) > 0 ? (
            <div className="space-y-1">
              <PanelLabel>{t("search_ui.suggested_subjects")}</PanelLabel>
              <div className="-mx-2">
                {subjectOptions!.slice(0, 5).map((subject) => (
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
          ) : null}

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
