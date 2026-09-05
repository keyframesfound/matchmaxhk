import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { ListChecks, Search, SearchX } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { WhatsAppIcon } from "@/components/layout/WhatsAppFloatButton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { LessonModeSelect } from "@/components/ui/lesson-mode-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PublicTutorCard } from "@/features/tutors/public-tutor-card";
import { TutorSaveButton } from "@/features/tutors/saved-tutors";
import {
  buildTutorWhatsAppUrl,
  formatTutorCode,
  getTutorSubjectGroups,
} from "@/features/tutors/tutor-display";
import {
  fetchPublishedTutors,
  getTutorCardHighlights,
  getTutorGenderLabel,
  getTutorLessonModeLabel,
  HK_DISTRICTS,
  matchesDistrictFilter,
  matchesLessonModeFilter,
  type Tutor,
} from "@/features/tutors/queries";
import {
  getSubjectOptionsForCategory,
  matchesCategoryFilter,
  matchesSubjectQuery,
} from "@/features/tutors/subjects";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  category: z.string().optional(),
  subject: z.string().optional(),
  district: z.string().optional(),
  mode: z.string().optional(), // online | in_person | either
  gender: z.string().optional(), // male | female | other
  min_price: z.coerce.number().int().min(0).optional(),
  max_price: z.coerce.number().int().min(0).optional(),
  sort: z.string().optional(), // "" | price_asc | price_desc
  q: z.string().optional(),
});
type SearchState = z.infer<typeof searchSchema>;

const PRICE_MIN = 100;
const PRICE_MAX = 1200;
const PRICE_STEP = 10;

function formatHKD(amount: number) {
  return `HK$${amount.toLocaleString("en-HK")}`;
}

const MAX_COMPARE = 4;

export const Route = createFileRoute("/tutors/")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Find Verified Tutors in Hong Kong | MatchMax" },
      {
        name: "description",
        content:
          "Browse verified tutors in Hong Kong by subject, district, lesson mode and price. Search for IB, DSE, IGCSE, AP, A-Level, Mathematics, English and more.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Find Verified Tutors in Hong Kong | MatchMax" },
      {
        property: "og:description",
        content:
          "Browse verified tutors in Hong Kong by subject, district, lesson mode and price. Search for IB, DSE, IGCSE, AP, A-Level, Mathematics, English and more.",
      },
      { property: "og:url", content: "https://matchmax.hk/tutors" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/tutors" }],
  }),
  component: TutorsDirectory,
});

const GENDER_OPTIONS = [
  { value: "", label: "Any gender" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "Any category" },
  { value: "IB", label: "IB" },
  { value: "DSE", label: "DSE" },
  { value: "IGCSE", label: "IGCSE" },
  { value: "AP", label: "AP" },
  { value: "A-Level", label: "A-Level" },
  { value: "Primary", label: "Primary" },
  { value: "Secondary", label: "Secondary" },
  { value: "International", label: "International" },
];

const SORT_OPTIONS = [
  { value: "", label: "Sort: Recommended" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

function PriceRangeSlider({
  value,
  onChange,
}: {
  value: { min?: number; max?: number };
  onChange: (min: number, max: number) => void;
}) {
  const lo = value.min ?? PRICE_MIN;
  const hi = value.max ?? PRICE_MAX;
  return (
    <div className="grid w-full max-w-[16rem] gap-1.5">
      <div className="flex items-center justify-between text-xs font-bold text-[color:var(--ink)]">
        <span>{formatHKD(lo)}</span>
        <span>{hi >= PRICE_MAX ? `${formatHKD(PRICE_MAX)}+` : formatHKD(hi)}</span>
      </div>
      <SliderPrimitive.Root
        value={[lo, hi]}
        min={PRICE_MIN}
        max={PRICE_MAX}
        step={PRICE_STEP}
        minStepsBetweenThumbs={1}
        onValueChange={(next) => onChange(next[0] ?? PRICE_MIN, next[1] ?? PRICE_MAX)}
        className="relative flex h-5 w-full touch-none select-none items-center"
        aria-label="Price range"
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-[color:var(--ink)]/15">
          <SliderPrimitive.Range className="absolute h-full bg-[color:var(--brand-teal)]" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label="Minimum hourly price"
          className="block h-4 w-4 rounded-full border-2 border-[color:var(--brand-teal)] bg-white shadow transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#77E8EE]/40"
        />
        <SliderPrimitive.Thumb
          aria-label="Maximum hourly price"
          className="block h-4 w-4 rounded-full border-2 border-[color:var(--brand-teal)] bg-white shadow transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#77E8EE]/40"
        />
      </SliderPrimitive.Root>
    </div>
  );
}

function CompareBar({
  selectedTutors,
  onOpenCompare,
  onClear,
}: {
  selectedTutors: Tutor[];
  onOpenCompare: () => void;
  onClear: () => void;
}) {
  const count = selectedTutors.length;
  return (
    <div className="fixed bottom-20 left-1/2 z-40 w-[min(92vw,30rem)] -translate-x-1/2 sm:bottom-6">
      <div className="flex items-center justify-between gap-3 rounded-full border border-[color:var(--brand-teal)]/30 bg-[color:var(--surface)] px-4 py-2.5 shadow-[0_16px_40px_rgba(4,19,68,0.18)]">
        <div className="flex min-w-0 items-center gap-2">
          <ListChecks
            className="h-4 w-4 shrink-0 text-[color:var(--brand-teal)]"
            aria-hidden="true"
          />
          <p className="truncate text-sm font-bold text-[color:var(--ink)]">
            {count} of {MAX_COMPARE} selected
            {count === 1 ? " — pick at least 2" : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            className="h-9 rounded-full bg-[color:var(--surface-invert)] px-4 text-[13px] font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
            disabled={count < 2}
            onClick={onOpenCompare}
          >
            Compare
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-9 rounded-full px-3 text-[13px] font-bold text-[color:var(--ink)] hover:bg-[color:var(--surface-subtle)]"
            onClick={onClear}
          >
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatSubjectGroups(tutor: Tutor): string[] {
  return getTutorSubjectGroups(tutor).map((group) => {
    const systemLabel =
      { ib: "IBDP", dse: "HKDSE", alevel: "A-Level", igcse: "IGCSE", ap: "AP", sat: "SAT" }[
        group.systemId
      ] ?? "Other";
    return `${systemLabel}: ${group.subjects.join(", ")}`;
  });
}

function CompareDialog({
  open,
  onOpenChange,
  tutors,
  whatsappNumber,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tutors: Tutor[];
  whatsappNumber: string;
}) {
  const columns = `minmax(7.5rem, 0.9fr) repeat(${tutors.length}, minmax(10.5rem, 1.4fr))`;
  const rows: { label: string; render: (t: Tutor) => React.ReactNode }[] = [
    {
      label: "Rate",
      render: (t) => (
        <p className="text-lg font-black text-[color:var(--ink)]">
          HK${t.hourly_rate}
          <span className="ml-1 text-xs font-semibold text-muted-foreground">/hr</span>
        </p>
      ),
    },
    {
      label: "Academic background",
      render: (t) => (
        <div className="space-y-0.5">
          {[t.academic_headline, t.university, t.secondary_school]
            .filter(Boolean)
            .slice(0, 2)
            .map((line, index) => (
              <p
                key={index}
                className="text-[13px] font-semibold leading-snug text-[color:var(--ink)]"
              >
                {line}
              </p>
            ))}
          {!t.academic_headline && !t.university && !t.secondary_school ? (
            <span className="text-sm text-muted-foreground">—</span>
          ) : null}
        </div>
      ),
    },
    {
      label: "Subjects",
      render: (t) => {
        const groups = formatSubjectGroups(t);
        if (groups.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <div className="space-y-1">
            {groups.map((line) => (
              <p
                key={line}
                className="text-[13px] font-semibold leading-snug text-[color:var(--ink)]"
              >
                {line}
              </p>
            ))}
          </div>
        );
      },
    },
    {
      label: "Lesson mode",
      render: (t) => (
        <p className="text-[13px] font-semibold text-[color:var(--ink)]">
          {(getTutorLessonModeLabel(t.lesson_mode) ?? "—").replace(/ tutoring$/, "")}
        </p>
      ),
    },
    {
      label: "District",
      render: (t) => (
        <p className="text-[13px] font-semibold text-[color:var(--ink)]">{t.district ?? "—"}</p>
      ),
    },
    {
      label: "Gender",
      render: (t) => {
        const label = getTutorGenderLabel(t.gender);
        return <p className="text-[13px] font-semibold text-[color:var(--ink)]">{label || "—"}</p>;
      },
    },
    {
      label: "Languages",
      render: (t) => (
        <p className="text-[13px] font-semibold text-[color:var(--ink)]">
          {t.languages.length > 0 ? t.languages.join(", ") : "—"}
        </p>
      ),
    },
    {
      label: "Experience",
      render: (t) => (
        <p className="text-[13px] font-semibold text-[color:var(--ink)]">
          {t.experience_years != null ? `${t.experience_years} yrs` : "—"}
        </p>
      ),
    },
    {
      label: "Achievements",
      render: (t) =>
        t.achievements.length > 0 ? (
          <ul className="space-y-1">
            {t.achievements.slice(0, 2).map((a, index) => (
              <li key={index} className="text-[13px] leading-snug text-muted-foreground">
                • {a.short_text}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      label: "",
      render: (t) => (
        <Button
          asChild
          size="sm"
          className="h-9 rounded-sm bg-[color:var(--surface-invert)] px-4 text-[13px] font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
        >
          <a
            href={buildTutorWhatsAppUrl(whatsappNumber, t.tutor_code)}
            target="_blank"
            rel="noreferrer"
          >
            Request tutor
          </a>
        </Button>
      ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-6xl overflow-y-auto rounded-sm p-0 sm:rounded-sm">
        <DialogHeader className="border-b border-border px-5 py-4 text-left sm:px-6">
          <DialogTitle className="text-lg font-black tracking-tight text-[color:var(--ink)]">
            Compare tutors
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Side-by-side comparison of your shortlisted profiles.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto px-5 pb-6 sm:px-6">
          <div className="min-w-[36rem]" style={{ display: "grid", gridTemplateColumns: columns }}>
            <div />
            {tutors.map((t) => (
              <div key={t.id} className="px-3 py-3 text-center">
                {t.photo_url ? (
                  <img
                    src={t.photo_url}
                    alt={formatTutorCode(t.tutor_code)}
                    className="mx-auto h-12 w-12 rounded-full border border-border object-cover"
                  />
                ) : (
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted text-sm font-bold text-[color:var(--ink)]">
                    {formatTutorCode(t.tutor_code).slice(0, 2)}
                  </div>
                )}
                <p className="mt-1.5 text-sm font-black text-[color:var(--ink)]">
                  {formatTutorCode(t.tutor_code)}
                </p>
              </div>
            ))}
            {rows.map(({ label, render }) => (
              <div key={label || "actions"} className="contents">
                <div className="border-t border-border/70 px-2 py-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  {label}
                </div>
                {tutors.map((t) => (
                  <div
                    key={t.id}
                    className="border-t border-border/70 px-3 py-3 align-top text-left"
                  >
                    {render(t)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TutorsDirectory() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/tutors/" });
  const [draft, setDraft] = useState<SearchState>(search);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    setDraft(search);
  }, [search]);

  const setDraftParam = (patch: Partial<SearchState>) => {
    setDraft((prev) => {
      const next: SearchState = { ...prev, ...patch };
      (Object.keys(next) as (keyof SearchState)[]).forEach((k) => {
        const v = next[k];
        if (v === "" || v === undefined || (typeof v === "number" && Number.isNaN(v)))
          delete next[k];
      });
      return next;
    });
  };

  const { data: tutors = [], isLoading } = useQuery({
    queryKey: ["tutors", "published"],
    queryFn: fetchPublishedTutors,
  });

  const { data: whatsappNumber = "" } = useQuery({
    queryKey: ["settings", "whatsapp_number"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "whatsapp_number")
        .maybeSingle();
      if (error) throw error;
      const value = data?.value;
      return typeof value === "string" ? value : "";
    },
  });

  const categoryFilter = (draft.category ?? "").toLowerCase();
  const subjectOptions = useMemo(
    () => getSubjectOptionsForCategory(draft.category),
    [draft.category],
  );

  const handleCategoryChange = (category: string) => {
    const nextSubjectOptions = getSubjectOptionsForCategory(category);
    setDraftParam({
      category: category || undefined,
      ...(draft.subject && !nextSubjectOptions.includes(draft.subject)
        ? { subject: undefined }
        : {}),
    });
  };

  const subjectFilter = (draft.subject ?? "").toLowerCase();
  const districtFilter = draft.district ?? "";
  const modeFilter = draft.mode ?? "";
  const genderFilter = draft.gender ?? "";
  const effectiveDistrictFilter = modeFilter === "in_person" ? districtFilter : "";

  const filtered = useMemo(() => {
    const query = (draft.q ?? "").trim().toLowerCase();
    const sort = draft.sort ?? "";

    const list = tutors.filter((tut) => {
      if (
        categoryFilter &&
        !matchesCategoryFilter(categoryFilter, tut.subjects, [
          ...tut.target_students,
          ...getTutorCardHighlights(tut),
        ])
      )
        return false;
      if (subjectFilter && !tut.subjects.some((s) => matchesSubjectQuery(s, subjectFilter)))
        return false;
      if (draft.min_price !== undefined && tut.hourly_rate < draft.min_price) return false;
      if (draft.max_price !== undefined && tut.hourly_rate > draft.max_price) return false;
      if (!matchesLessonModeFilter(modeFilter, tut.lesson_mode)) return false;
      if (!matchesDistrictFilter(effectiveDistrictFilter, tut.district)) return false;
      if (genderFilter) {
        const g = (tut as unknown as { gender?: string | null }).gender ?? "";
        if (g !== genderFilter) return false;
      }
      if (
        query &&
        !(
          tut.tutor_code.toLowerCase().includes(query) ||
          tut.subjects.some((s) => matchesSubjectQuery(s, query)) ||
          getTutorCardHighlights(tut).some((highlight) => highlight.toLowerCase().includes(query))
        )
      )
        return false;
      return true;
    });

    return [...list].sort((a, b) => {
      if (sort === "price_asc")
        return a.hourly_rate - b.hourly_rate || a.tutor_code.localeCompare(b.tutor_code);
      if (sort === "price_desc")
        return b.hourly_rate - a.hourly_rate || a.tutor_code.localeCompare(b.tutor_code);
      return (
        (b.experience_years ?? 0) - (a.experience_years ?? 0) ||
        a.hourly_rate - b.hourly_rate ||
        a.tutor_code.localeCompare(b.tutor_code)
      );
    });
  }, [
    tutors,
    categoryFilter,
    subjectFilter,
    effectiveDistrictFilter,
    modeFilter,
    genderFilter,
    draft.q,
    draft.min_price,
    draft.max_price,
    draft.sort,
  ]);

  const compareTutors = useMemo(
    () =>
      compareIds
        .map((id) => tutors.find((tut) => tut.id === id))
        .filter((tut): tut is Tutor => Boolean(tut)),
    [compareIds, tutors],
  );

  const toggleCompare = (tutor: Tutor) => {
    setCompareIds((prev) => {
      if (prev.includes(tutor.id)) return prev.filter((id) => id !== tutor.id);
      if (prev.length >= MAX_COMPARE) {
        toast.error(`You can compare up to ${MAX_COMPARE} tutors.`);
        return prev;
      }
      return [...prev, tutor.id];
    });
  };

  const clearAll = () => {
    setDraft({});
    navigate({ search: {} as SearchState });
  };

  const openTutorDetail = (tutorCode: string) => {
    navigate({ to: "/tutors/$tutorCode", params: { tutorCode } });
  };

  const hotlineUrl = buildTutorWhatsAppUrl(whatsappNumber, "");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="hero-startup-bg border-b border-border py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h1 className="text-4xl font-black tracking-tight text-[color:var(--ink)] sm:text-5xl">
              Find verified tutors
            </h1>
            <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-muted-foreground md:text-base">
              {t("directory.subtitle")}
            </p>

            <div className="relative mt-8 rounded-sm border border-border bg-card p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-2 border-b border-border pb-4">
                <p className="text-sm font-black uppercase tracking-wide text-[color:var(--ink)]">
                  Find tutor
                </p>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-11 rounded-sm pl-9"
                    placeholder="Search tutor code, subject, keyword…"
                    value={draft.q ?? ""}
                    onChange={(e) => setDraftParam({ q: e.target.value })}
                  />
                </div>
                <SearchableSelect
                  value={draft.category ?? ""}
                  onChange={handleCategoryChange}
                  options={CATEGORY_OPTIONS}
                  placeholder="Any category"
                  searchPlaceholder="Search category..."
                  className="h-11 rounded-sm"
                />
                <SearchableSelect
                  value={draft.subject ?? ""}
                  onChange={(v) => setDraftParam({ subject: v || undefined })}
                  options={[
                    { value: "", label: "Any subject" },
                    ...subjectOptions.map((s) => ({ value: s, label: s })),
                  ]}
                  placeholder="Any subject"
                  searchPlaceholder="Search subject..."
                  className="h-11 rounded-sm"
                />
                <LessonModeSelect
                  mode={(draft.mode as "" | "online" | "in_person" | "either" | undefined) ?? ""}
                  district={draft.district}
                  districts={HK_DISTRICTS}
                  onChange={({ mode, district }) =>
                    setDraftParam({
                      mode: mode || undefined,
                      district: mode === "in_person" ? district : undefined,
                    })
                  }
                  placeholder="Any lesson mode"
                  className="h-11 rounded-sm"
                />
                <SearchableSelect
                  value={draft.gender ?? ""}
                  onChange={(v) => setDraftParam({ gender: v || undefined })}
                  options={GENDER_OPTIONS}
                  placeholder="Any gender"
                  className="h-11 rounded-sm"
                />
                <Button
                  className="h-11 rounded-sm bg-[color:var(--surface-invert)] px-6 font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
                  onClick={() =>
                    navigate({
                      search: {
                        ...draft,
                        district: draft.mode === "in_person" ? draft.district : undefined,
                      },
                    })
                  }
                >
                  Search
                </Button>
              </div>

              <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-6">
                <div className="shrink-0">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Hourly price range
                  </p>
                  <PriceRangeSlider
                    value={{ min: draft.min_price, max: draft.max_price }}
                    onChange={(min, max) =>
                      setDraftParam({
                        min_price: min > PRICE_MIN ? min : undefined,
                        max_price: max < PRICE_MAX ? max : undefined,
                      })
                    }
                  />
                </div>
                <SearchableSelect
                  value={draft.sort ?? ""}
                  onChange={(v) =>
                    navigate({
                      search: (prev) => ({ ...prev, sort: v || undefined }) as SearchState,
                    })
                  }
                  options={SORT_OPTIONS}
                  placeholder="Sort: Recommended"
                  searchPlaceholder="Search sorting..."
                  className="h-11 w-full rounded-sm sm:w-56 sm:shrink-0"
                />
                <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
                  {hotlineUrl ? (
                    <a
                      href={hotlineUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center gap-2 rounded-full bg-[#25D366] px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#1ebe57]"
                    >
                      <WhatsAppIcon className="h-4 w-4" aria-hidden="true" />
                      WhatsApp
                    </a>
                  ) : null}
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    Skip the manual filters — tell us what you need and we&rsquo;ll{" "}
                    <span className="font-bold text-[color:var(--ink)]">
                      source a match for free
                    </span>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-6 flex items-baseline justify-between">
              {isLoading ? (
                <Skeleton className="h-4 w-28" />
              ) : (
                <p className="text-sm text-muted-foreground">
                  <span className="font-bold text-foreground">{filtered.length}</span>{" "}
                  {filtered.length === 1 ? "tutor" : "tutors"} found
                </p>
              )}
            </div>

            {isLoading && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-[23rem] rounded-sm border border-border" />
                ))}
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <div className="rounded-sm border border-border bg-card p-8 text-center sm:p-12">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--brand-teal)]/30 bg-[color:var(--brand-teal)]/8">
                  <SearchX className="h-5 w-5 text-[color:var(--brand-teal)]" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-xl font-black tracking-tight text-[color:var(--ink)] sm:text-2xl">
                  {t("directory.empty_title")}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  {t("directory.empty_desc")}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button variant="outline" onClick={clearAll}>
                    {t("directory.empty_clear")}
                  </Button>
                  {hotlineUrl ? (
                    <Button asChild variant="ghost">
                      <a href={hotlineUrl} target="_blank" rel="noreferrer">
                        <WhatsAppIcon
                          className="mr-2 h-4 w-4 text-[color:var(--brand-teal)]"
                          aria-hidden="true"
                        />
                        {t("directory.empty_whatsapp")}
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    asChild
                    className="bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
                  >
                    <Link to="/case-request">{t("directory.empty_case")}</Link>
                  </Button>
                </div>
              </div>
            )}

            {!isLoading && filtered.length > 0 && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map((tut: Tutor) => (
                  <PublicTutorCard
                    key={tut.id}
                    tutor={tut}
                    priceSuffix={t("featured.per_hour")}
                    onOpen={openTutorDetail}
                    onCompareToggle={() => toggleCompare(tut)}
                    compareSelected={compareIds.includes(tut.id)}
                    footerAction={
                      <>
                        <TutorSaveButton tutorId={tut.id} compact />
                        <Button
                          asChild
                          className="h-9 rounded-sm bg-[color:var(--surface-invert)] px-4 text-[13px] font-bold text-white hover:bg-[color:var(--surface-invert)]"
                        >
                          <a
                            href={buildTutorWhatsAppUrl(whatsappNumber, tut.tutor_code)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            Request tutor
                          </a>
                        </Button>
                      </>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
      {compareTutors.length > 0 && !compareOpen ? (
        <CompareBar
          selectedTutors={compareTutors}
          onOpenCompare={() => setCompareOpen(true)}
          onClear={() => setCompareIds([])}
        />
      ) : null}
      <CompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        tutors={compareTutors}
        whatsappNumber={whatsappNumber}
      />
    </div>
  );
}
