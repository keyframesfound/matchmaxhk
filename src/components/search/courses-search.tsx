import { BookOpen, ClipboardList, GraduationCap } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

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
import { MobileSearchTrigger } from "./mobile-search-trigger";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { COURSE_LEVEL_OPTIONS, COURSE_MODE_OPTIONS } from "@/features/courses/queries";
import { HK_DISTRICTS } from "@/features/tutors/queries";

export type CoursesSearchState = {
  subject?: string;
  level?: string;
  mode?: string;
  district?: string;
  q?: string;
};

type CoursesSearchProps = {
  draft: CoursesSearchState;
  onDraftChange: (patch: Partial<CoursesSearchState>) => void;
  onApply: (override?: Partial<CoursesSearchState>) => void;
  onClear: () => void;
  subjectOptions: string[];
  className?: string;
};

export function CoursesSearch({
  draft,
  onDraftChange,
  onApply,
  onClear,
  subjectOptions,
  className,
}: CoursesSearchProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);

  const levelOptions: OptionRow[] = COURSE_LEVEL_OPTIONS.map((level) => ({
    value: level,
    label: level,
  }));
  const districtOptions: OptionRow[] = HK_DISTRICTS.map((district) => ({
    value: district,
    label: district,
  }));
  const subjectRows: OptionRow[] = subjectOptions.map((subject) => ({
    value: subject,
    label: subject,
  }));

  const modeSegmentOptions = COURSE_MODE_OPTIONS.map((option) => ({
    value: option.value,
    label:
      option.value === ""
        ? t("search_ui.mode_any")
        : option.value === "online"
          ? t("search_ui.mode_online")
          : option.value === "in_person"
            ? t("search_ui.mode_in_person")
            : t("search_ui.mode_open"),
  }));

  const modeDisplay = (() => {
    const option = COURSE_MODE_OPTIONS.find((candidate) => candidate.value === (draft.mode ?? ""));
    if (!draft.mode || !option) return t("search_ui.any_value");
    return option.label;
  })();

  const quickPicks = COURSE_LEVEL_OPTIONS.map((level) => ({
    id: level,
    label: level,
    icon: BookOpen,
    active: draft.level === level,
    onToggle: () => onDraftChange({ level: draft.level === level ? undefined : level }),
  }));

  const segments: PillSegment[] = [
    {
      id: "keyword",
      label: t("search_ui.segment_keyword"),
      title: t("search_ui.panel_keyword_title"),
      display: draft.q?.trim() ? draft.q : "Search course title, subject, keyword…",
      filled: Boolean(draft.q?.trim()),
      grow: "flex-[1.3]",
      content: (
        <KeywordPanelContent
          value={draft.q ?? ""}
          onValueChange={(q) => onDraftChange({ q: q || undefined })}
          placeholder="Search course title, subject, keyword…"
          ariaLabel="Search courses"
        />
      ),
    },
    {
      id: "level",
      label: t("search_ui.segment_level"),
      display: draft.level ?? t("search_ui.any_value"),
      filled: Boolean(draft.level),
      options: levelOptions,
      currentValue: draft.level,
      searchPlaceholder: t("search_panel.search_category"),
      emptyText: t("search_panel.no_matches"),
      onSelect: (value) => onDraftChange({ level: value || undefined }),
    },
    {
      id: "subject",
      label: t("search_ui.segment_subject"),
      display: draft.subject ?? t("search_ui.any_value"),
      filled: Boolean(draft.subject),
      options: subjectRows,
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
      panelClassName: "w-[min(24rem,calc(100vw-2rem))]",
      content: (
        <div className="space-y-3">
          <p className="text-sm font-bold text-[color:var(--ink)]">{t("search_ui.segment_mode")}</p>
          <Segmented
            aria-label={t("search_ui.segment_mode")}
            value={draft.mode ?? ""}
            onChange={(mode) => onDraftChange({ mode: mode || undefined })}
            options={modeSegmentOptions}
          />
        </div>
      ),
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
          search: { q: draft.q, subject: draft.subject, mode: draft.mode },
        });
      },
    },
    {
      id: "courses",
      label: t("search_ui.tab_courses"),
      icon: <BookOpen className="h-5 w-5" aria-hidden="true" />,
      active: true,
      onSelect: () => {},
    },
    {
      id: "cases",
      label: t("search_ui.tab_cases"),
      icon: <ClipboardList className="h-5 w-5" aria-hidden="true" />,
      active: false,
      onSelect: () => {
        setOverlayOpen(false);
        void navigate({ to: "/tutor-requests", search: { q: draft.q } });
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
          count={draft.district ? 1 : undefined}
          onClick={() => setFiltersOpen(true)}
        />
      </div>

      <FiltersDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        clearLabel={t("search_ui.clear_all")}
        applyLabel={t("search_ui.show_courses_plain")}
        onClear={onClear}
        onApply={() => onApply()}
      >
        <FiltersSection id="recommended" title={t("search_ui.quick_title")}>
          <FilterQuickPicks options={quickPicks} />
        </FiltersSection>
        <FiltersSection id="district" title={t("search_ui.segment_district")}>
          <SearchableSelect
            value={draft.district ?? ""}
            onChange={(value) => onDraftChange({ district: value || undefined })}
            options={[{ value: "", label: t("search_ui.any_district") }, ...districtOptions]}
            placeholder={t("search_ui.any_district")}
            searchPlaceholder={t("search_panel.search_subject")}
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
        submitLabel={t("search_ui.show_courses_plain")}
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
              placeholder="Search course title, subject, keyword…"
              ariaLabel="Search courses"
            />
          </div>

          <div className="space-y-1.5">
            <PanelLabel>{t("search_ui.segment_level")}</PanelLabel>
            <SearchableSelect
              value={draft.level ?? ""}
              onChange={(value) => onDraftChange({ level: value || undefined })}
              options={levelOptions}
              placeholder="Any level"
              searchPlaceholder={t("search_panel.search_category")}
              className="h-12 rounded-2xl"
            />
          </div>

          {subjectRows.length > 0 ? (
            <div className="space-y-1">
              <PanelLabel>{t("search_ui.suggested_subjects")}</PanelLabel>
              <div className="-mx-2">
                {subjectRows.slice(0, 5).map((option) => (
                  <SuggestedRow
                    key={option.value}
                    title={option.label}
                    hint={t("search_ui.suggested_hint")}
                    onClick={() => {
                      onApply({ subject: option.value });
                      setOverlayOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <PanelLabel>{t("search_ui.segment_mode")}</PanelLabel>
            <Segmented
              aria-label={t("search_ui.segment_mode")}
              value={draft.mode ?? ""}
              onChange={(mode) => onDraftChange({ mode: mode || undefined })}
              options={modeSegmentOptions}
            />
          </div>

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
