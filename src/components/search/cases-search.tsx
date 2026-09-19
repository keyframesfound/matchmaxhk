import { ClipboardList, GraduationCap, BookOpen } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PanelLabel, SearchBigInput, SuggestedRow, type OptionRow } from "./search-controls";
import { KeywordPanelContent, SearchPillBar, type PillSegment } from "./search-pill-bar";
import { MobileSearchOverlay, type MobileSearchTab } from "./mobile-search-overlay";
import { MobileSearchTrigger } from "./mobile-search-trigger";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";
import { HK_DISTRICTS } from "@/features/tutors/queries";

export type CasesSearchState = {
  q?: string;
  category?: string;
  district?: string;
};

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

const caseCategoryLabel = (value: string, t: (key: string) => string) => {
  if (value === "Primary School") return t("search_panel.category_primary_school");
  if (value === "Junior Secondary") return t("search_panel.category_junior_secondary");
  if (value === "Admissions") return t("search_panel.category_admissions");
  if (value === "Other") return t("search_ui.case_other");
  return value;
};

type CasesSearchProps = {
  draft: CasesSearchState;
  onDraftChange: (patch: Partial<CasesSearchState>) => void;
  onApply: (override?: Partial<CasesSearchState>) => void;
  onClear: () => void;
  subjectOptions: string[];
  className?: string;
};

/** Same Airbnb-style search pattern as the tutors/courses directories, for the case board. */
export function CasesSearch({
  draft,
  onDraftChange,
  onApply,
  onClear,
  subjectOptions,
  className,
}: CasesSearchProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [overlayOpen, setOverlayOpen] = useState(false);

  const categoryOptions: OptionRow[] = CASE_CATEGORY_VALUES.map((value) => ({
    value,
    label: caseCategoryLabel(value, t),
  }));
  const districtOptions: OptionRow[] = HK_DISTRICTS.map((district) => ({
    value: district,
    label: district,
  }));

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
      options: categoryOptions,
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
      options: districtOptions,
      currentValue: draft.district,
      searchPlaceholder: t("search_panel.search_subject"),
      emptyText: t("search_panel.no_matches"),
      onSelect: (value) => onDraftChange({ district: value || undefined }),
    },
  ];

  const overlayTabs: MobileSearchTab[] = [
    {
      id: "tutors",
      label: t("search_ui.tab_tutors"),
      icon: <GraduationCap className="h-5 w-5" aria-hidden="true" />,
      active: false,
      onSelect: () => {
        setOverlayOpen(false);
        void navigate({
          to: "/tutors",
          search: { q: draft.q, mode: undefined, subject: undefined },
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
              setOverlayOpen(false);
              void navigate({
                to: "/courses",
                search: { q: draft.q, subject: undefined, mode: undefined },
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
      <div className="hidden items-stretch gap-2 lg:flex">
        <SearchPillBar
          segments={segments}
          submitLabel={t("search_panel.search")}
          submitColor="blue"
          onSubmit={() => onApply()}
          className="min-w-0 flex-1"
        />
      </div>

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
              options={[{ value: "", label: t("search_panel.any_category") }, ...categoryOptions]}
              placeholder={t("search_panel.any_category")}
              searchPlaceholder={t("search_panel.search_category")}
              className="h-12 rounded-2xl"
            />
          </div>

          {subjectOptions.length > 0 ? (
            <div className="space-y-1">
              <PanelLabel>{t("search_ui.suggested_subjects")}</PanelLabel>
              <div className="-mx-2">
                {subjectOptions.slice(0, 5).map((subject) => (
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
              options={[{ value: "", label: t("search_ui.any_district") }, ...districtOptions]}
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
