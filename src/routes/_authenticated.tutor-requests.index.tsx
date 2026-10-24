import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { formatPostedAgo } from "@/lib/relative-time";
import { currentSeoLocale, localizedMeta } from "@/features/i18n/seo";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Check,
  Hash,
  Inbox,
  SearchX,
  Share2,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CaseRequestForm } from "@/features/cases/CaseRequestForm";
import { CaseSaveButton } from "@/features/cases/saved-cases";
import {
  CasesSearchBar,
  CasesSearchMobile,
  useCasesCompactSegments,
} from "@/components/search/cases-search";
import {
  CompactSearchPill,
  SearchGroupProvider,
  StickySearchBar,
} from "@/components/search/sticky-search-group";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import {
  CaseCompareBar,
  CaseCompareDialog,
  CaseCompareToggle,
  useCaseCompare,
} from "@/features/cases/compare-cases";
import {
  CaseCap57Chip,
  CaseChipRow,
  CaseFeePill,
  CaseIdentityRow,
  CaseLogisticsLine,
  CaseStudentsRow,
  caseLogisticsParts,
  caseRateText,
  useCaseTitles,
} from "@/features/cases/case-card";
import { caseBudgetForTutor } from "@/features/cases/display";
import { useDisplayCurrency } from "@/features/currency/display-currency-context";
import { useTutorDisplayCurrency } from "@/features/currency/tutor-currency";
import { shareOrCopy } from "@/lib/share";
import { normalizeProfileTag } from "@/features/tutors/profile-tags";
import {
  matchesCaseFilters,
  getSelectedCaseTags,
  parseCaseBackgroundParam,
  parseCaseFeeParam,
  parseCaseGenderParam,
  parseCaseLanguageParam,
  parseCaseModeParam,
  parseCaseRateParam,
  parseCaseTagsParam,
} from "@/features/cases/case-filters";
import { parseTierParam } from "@/features/tutors/search-tiers";
import type { AcademicTier } from "@/features/tutors/verticals";
import { getPublicCaseBoard, type PublicCaseBoardItem } from "@/lib/cases.functions";
import { useAuth } from "@/features/auth/useAuth";
import {
  listMyAppliedCaseCodes,
  myAppliedCasesQueryKey,
} from "@/features/cases/applications.functions";

/** Issue #423 ship-order 5: every board filter lives on the URL so chip
 * links (?tag=/q=) and the advanced-filters dialog share one state. */
type CaseBoardSearch = {
  post?: true;
  q?: string;
  category?: string;
  district?: string;
  tag?: string;
  open?: true;
} & CaseBoardFiltersState;

type CaseBoardFiltersState = {
  tier?: AcademicTier;
  subject?: string;
  mode?: string;
  fee?: string;
  rate_min?: number;
  rate_max?: number;
  background?: string;
  gender?: string;
  language?: string;
  sen?: boolean;
  tags?: string;
};

export const Route = createFileRoute("/_authenticated/tutor-requests/")({
  validateSearch: (search: Record<string, unknown>): CaseBoardSearch => {
    const result: CaseBoardSearch = {};
    if (search.post === "1" || search.post === true || search.post === "true") result.post = true;
    if (typeof search.q === "string" && search.q.trim()) result.q = search.q;
    if (typeof search.category === "string" && search.category.trim())
      result.category = search.category;
    if (typeof search.district === "string" && search.district.trim())
      result.district = search.district;
    // Issue #311: tag filter shares the tutor-tag vocabulary and its
    // normalization, so ?tag=ia-review and ?tag=ia review hit the same cases.
    if (typeof search.tag === "string" && search.tag.trim())
      result.tag = normalizeProfileTag(search.tag);
    if (search.open === "1" || search.open === "true" || search.open === true) result.open = true;
    // Issue #423 ship-order 5: advanced filters. Absent params stay
    // undefined (never null/false) so cold URLs are never rewritten.
    const tier = parseTierParam(search.tier);
    if (tier) result.tier = tier;
    if (typeof search.subject === "string" && search.subject.trim())
      result.subject = search.subject;
    const mode = parseCaseModeParam(search.mode);
    if (mode) result.mode = mode;
    const fee = parseCaseFeeParam(search.fee);
    if (fee) result.fee = fee;
    const rateMin = parseCaseRateParam(search.rate_min);
    if (rateMin !== undefined) result.rate_min = rateMin;
    const rateMax = parseCaseRateParam(search.rate_max);
    if (rateMax !== undefined) result.rate_max = rateMax;
    const background = parseCaseBackgroundParam(search.background);
    if (background) result.background = background;
    const gender = parseCaseGenderParam(search.gender);
    if (gender) result.gender = gender;
    const language = parseCaseLanguageParam(search.language);
    if (language) result.language = language;
    if (search.sen === true || search.sen === "true") result.sen = true;
    const tags = parseCaseTagsParam(search.tags);
    if (tags) result.tags = tags;
    return result;
  },
  head: () => {
    const locale = currentSeoLocale();
    return {
      meta: [
        ...localizedMeta(locale, {
          title: {
            en: "Tutor Request Board, Post a Request or Apply for Cases | MatchMax",
            "zh-HK": "補習個案板, 家長免費出需求，導師申請個案 | MatchMax",
          },
          description: {
            en: "Browse open tutoring cases posted by parents and students, or submit your requirements free and let qualified tutors apply for your case.",
            "zh-HK":
              "瀏覽家長同學生張貼嘅開放補習個案，或者免費提交你嘅要求，等合資格導師申請你嘅個案。",
          },
        }),
        { name: "robots", content: "index, follow" },
        {
          property: "og:description",
          content:
            locale === "zh-HK"
              ? "真實香港家長補習需求。申請適合你嘅個案，或者自己出需求——家長完全免費。"
              : "Real tutoring requests from Hong Kong parents. Apply for a case that fits you, or post your own, free for parents.",
        },
        { property: "og:url", content: "https://matchmax.hk/tutor-requests" },
      ],
      links: [{ rel: "canonical", href: "https://matchmax.hk/tutor-requests" }],
    };
  },
  component: TutorRequestsPage,
});

/**
 * Issue #423 bug 2 + section 3: the board renders ONE chip system and a
 * unified card (identity row → bilingual auto-title → 1-line logistics →
 * students → chips → neutral CTAs → fee pill + posted ago). The grey `#`
 * tag row is gone; #149 pills and #311 tags merge in case-chips.ts.
 */

// Legacy `?category=` filter key for a case's exam system.
function caseSectionKey(examSystem: string | null): string {
  const value = examSystem?.trim();
  if (!value || value === "Other") return "Other";
  if (value === "Local Primary" || value === "Int'l Primary") return "Primary School";
  return value;
}

function CaseShareButton({ item }: { item: PublicCaseBoardItem }) {
  const { t } = useTranslation();
  const { primary } = useCaseTitles(item);
  const [isSharing, setIsSharing] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-10 w-8 shrink-0 rounded-sm border-0 bg-transparent p-0 text-[color:var(--ink)] hover:bg-[color:var(--foreground)]/[0.06] hover:text-[color:var(--ink)]"
      aria-label={t("case_board.share_case")}
      title={t("case_board.share_case")}
      disabled={isSharing}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsSharing(true);
        void shareOrCopy({
          title: `${primary}, Case ${item.caseCode} | MatchMax`,
          text: `Check out this tutoring request (Case ${item.caseCode}) on MatchMax.`,
          url: `${window.location.origin}/tutor-requests/${item.caseCode}`,
        }).finally(() => setIsSharing(false));
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Share2 className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
    </Button>
  );
}

/** #81: small "Applied" pill for board cards of cases the tutor already hit
 * 1-click Apply on. Only rendered with a true prop, additive, default off. */
function CaseAppliedPill() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
      <Check className="h-3 w-3" aria-hidden="true" />
      {t("caseApplications.applied", { defaultValue: "Applied" })}
    </span>
  );
}

function CaseCard({ item, applied = false }: { item: PublicCaseBoardItem; applied?: boolean }) {
  const { t, i18n } = useTranslation();
  const { primary, secondary } = useCaseTitles(item);
  // Issue #113/#423: tutors quoting in another currency see the converted
  // rate first; an empty string (both bounds blank) omits the rate entirely
  //, never "HK$?".
  const tutorCurrency = useTutorDisplayCurrency();
  const { rates: fxRates } = useDisplayCurrency();
  const budget = caseBudgetForTutor(item, tutorCurrency, fxRates, item.rateUnit);
  const rateHkd = caseRateText(item);
  const logisticsParts = caseLogisticsParts(item);
  const postedAgo = formatPostedAgo(item.boardPublishedAt ?? item.createdAt, i18n.language);
  return (
    <li className="relative flex flex-col rounded-xl border border-border bg-[color:var(--surface)] p-4 transition-colors hover:border-[color:var(--foreground)]/25">
      {/* Identity row, trust pills ONLY with real data; there is NO parent
          rating today, so nothing fabricated renders (precedent #151).
          Centre cases swap in the verified-org identity (#412/#423). */}
      <div className="flex items-center justify-between gap-2">
        <CaseIdentityRow item={item} />
        {item.startTiming === "asap" ? (
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-[color:var(--warning)]/15 px-1.5 py-0.5 text-xs font-medium text-[#a16207] dark:text-[color:var(--warning)]">
            <CalendarClock className="h-3 w-3" aria-hidden="true" />
            {t("case_board.badge_asap")}
          </span>
        ) : null}
      </div>

      {/* Bilingual structured auto-title (#411 pattern): locale-primary
          line + the parallel line; legacy title is the fallback only. */}
      <Link
        to="/tutor-requests/$caseCode"
        params={{ caseCode: item.caseCode }}
        className="mt-2 block min-w-0"
      >
        <h3 className="truncate text-base font-medium text-[color:var(--ink)]">{primary}</h3>
        {secondary ? <p className="truncate text-sm text-muted-foreground">{secondary}</p> : null}
      </Link>

      {/* 1-line logistics row. */}
      <CaseLogisticsLine parts={logisticsParts} className="mt-2 [&>span]:w-full [&>span]:min-w-0" />
      {/* Dedicated rate line (#113): converted figure bold + original HKD in
          parens for non-HKD tutors; plain HKD rate otherwise. GLM round-2
          blocker, the logistics line no longer carries the rate. */}
      {budget.primary ? (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          <span className="font-medium text-[color:var(--ink)]">{budget.primary}</span> (
          {budget.original})
        </p>
      ) : rateHkd ? (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{rateHkd}</p>
      ) : null}

      <div className="mt-1">
        <CaseStudentsRow item={item} />
      </div>

      {/* Permanent Cap.57 chip on centre cards (#412). */}
      {item.centre ? (
        <div className="mt-1.5 min-w-0">
          <CaseCap57Chip />
        </div>
      ) : null}

      <div className="mt-2 min-h-[1.75rem]">
        <CaseChipRow item={item} />
      </div>

      {/* Footer: neutral CTAs (tutor-card parity) + fee-rule pill + posted. */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex min-w-0 items-center gap-0.5">
          <CaseCompareToggle caseId={item.id} />
          <CaseShareButton item={item} />
          <CaseSaveButton caseId={item.id} compact />
          <Link
            to="/tutor-requests/$caseCode"
            params={{ caseCode: item.caseCode }}
            className="group ml-1 flex shrink-0 items-center gap-1 text-sm font-medium text-[color:var(--ink)] hover:underline"
          >
            {t("case_board.view_details")}
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <CaseFeePill packageType={item.packageType} />
          {/* Issue #81: 1-click Apply receipt on the card itself. */}
          {applied ? <CaseAppliedPill /> : null}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {t("case_board.posted_ago", { ago: postedAgo })}
        </span>
      </div>
    </li>
  );
}

function ListSkeleton({ cards }: { cards: number }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: cards }).map((_, i) => (
        <li key={i} className="flex flex-col gap-2 rounded-xl border border-border p-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-40 max-w-full" />
          <Skeleton className="h-3 w-56 max-w-full" />
          <Skeleton className="h-6 w-full" />
          <div className="flex items-center justify-between gap-2 pt-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
        </li>
      ))}
    </ul>
  );
}

const NOTICE_DISMISSED_KEY = "mm-case-request-notice-dismissed";

function TutorRequestsPage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/tutor-requests/" });
  const initialPost = search.post;
  const [draft, setDraft] = useState<CaseBoardSearch>({ ...search });
  const [formOpen, setFormOpen] = useState(Boolean(initialPost));
  const [noticeOpen, setNoticeOpen] = useState(false);
  const formSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft({ ...search });
  }, [search]);

  const setDraftParam = (patch: Partial<CaseBoardSearch>) => {
    setDraft((prev) => {
      const next: CaseBoardSearch = { ...prev, ...patch };
      (Object.keys(next) as (keyof CaseBoardSearch)[]).forEach((key) => {
        const value = next[key];
        if (
          value === "" ||
          value === undefined ||
          (typeof value === "number" && Number.isNaN(value))
        )
          delete next[key];
      });
      return next;
    });
  };

  const applySearch = (override?: Partial<CaseBoardSearch>) => {
    const next = { ...draft, ...override };
    navigate({
      search: {
        post: initialPost,
        q: next.q,
        category: next.category,
        district: next.district,
        // Issue #311: keep the active tag filter when the search bar is
        // applied, tag ANDs with the rest; multi-tag picks come from the
        // advanced draft.
        tag: search.tag,
        // Issue #423 ship-order 5: advanced filters ride the same draft.
        tier: next.tier,
        subject: next.subject,
        mode: next.mode,
        fee: next.fee,
        rate_min: next.rate_min,
        rate_max: next.rate_max,
        background: next.background,
        gender: next.gender,
        language: next.language,
        sen: next.sen,
        tags: next.tags,
      },
    });
  };

  const clearSearch = () => {
    setDraft({});
    navigate({ search: { post: initialPost } });
  };

  const { data } = useQuery({
    queryKey: ["cases", "board"],
    queryFn: () => getPublicCaseBoard(),
  });
  const cases = useMemo(() => data?.items ?? [], [data]);
  const isLoading = !data;

  // Issue #81: one fetch of the signed-in tutor's applied case codes, so the
  // board cards can show the small Applied pill. Guests / non-tutors: [].
  const { user } = useAuth();
  const { data: myAppliedCaseCodes } = useQuery({
    queryKey: myAppliedCasesQueryKey,
    queryFn: () => listMyAppliedCaseCodes(),
    enabled: Boolean(user),
  });
  const appliedCodes = useMemo(() => new Set(myAppliedCaseCodes ?? []), [myAppliedCaseCodes]);

  const filteredCases = useMemo(() => {
    const query = (search.q ?? "").trim().toLowerCase();
    // Issue #311: ?tag= is an exact-match filter on the case's stored tags,
    // mirroring the /tutors tag filter.
    const tagFilter = search.tag ? normalizeProfileTag(search.tag) : "";
    return cases.filter((item) => {
      if (search.category && caseSectionKey(item.examSystem) !== search.category) return false;
      if (search.district && item.district !== search.district) return false;
      if (tagFilter && !(item.tags ?? []).includes(tagFilter)) return false;
      // Issue #423 ship-order 5: the advanced filters (tier/subject/mode/
      // fee/rate/background/gender/language/SEN) plus the multi-tag AND.
      if (!matchesCaseFilters(item, search)) return false;
      if (query) {
        const haystack = [
          item.title,
          item.description ?? "",
          ...item.subjects,
          item.district ?? "",
          item.examSystem ?? "",
          ...item.tags,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [cases, search]);

  const { compareCases, compareOpen, setCompareOpen, clearCompare } = useCaseCompare(cases);

  // Auto-show the Klarna-style notice sheet on load unless permanently dismissed.
  useEffect(() => {
    if (!initialPost && window.localStorage.getItem(NOTICE_DISMISSED_KEY) !== "1") {
      setNoticeOpen(true);
    }
  }, [initialPost]);

  const openForm = () => {
    setFormOpen(true);
    window.requestAnimationFrame(() => {
      const el = formSectionRef.current;
      if (!el) return;
      // The form opens directly under the header CTA; only scroll when it
      // isn't already comfortably in view (notice sheet, empty-board CTA).
      const headerHeight =
        document.querySelector<HTMLElement>("[data-site-header]")?.offsetHeight ?? 72;
      const top = el.getBoundingClientRect().top;
      if (top >= headerHeight && top <= window.innerHeight - 240) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const toggleForm = () => {
    if (formOpen) {
      setFormOpen(false);
      if (initialPost) {
        void navigate({ to: "/tutor-requests", search: {}, replace: true });
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      openForm();
    }
  };

  const dismissNoticePermanently = () => {
    window.localStorage.setItem(NOTICE_DISMISSED_KEY, "1");
    setNoticeOpen(false);
  };

  // Issue #423: the board is one flat card grid (wireframe), the exam-system
  // sections are gone; `?category=` still filters by curriculum.
  const hasActiveFilters = Boolean(
    search.q ||
    search.category ||
    search.district ||
    search.tag ||
    search.tags ||
    search.tier ||
    search.subject ||
    search.mode ||
    search.fee ||
    search.rate_min !== undefined ||
    search.rate_max !== undefined ||
    search.background ||
    search.gender ||
    search.language ||
    search.sen,
  );

  // Issue #311/#423: every active requirement tag (single ?tag= + the
  // multi-tag advanced picks), one click to remove each.
  const activeTags = [
    ...(search.tag ? [search.tag] : []),
    ...getSelectedCaseTags({ tags: search.tags }).filter((tag) => tag !== search.tag),
  ];
  const removeTag = (tag: string) => {
    const remaining = getSelectedCaseTags({ tags: search.tags }).filter((value) => value !== tag);
    navigate({
      search: (prev) => ({
        ...prev,
        tag: prev.tag === tag ? undefined : prev.tag,
        tags: remaining.length > 0 ? remaining.join("||") : undefined,
      }),
    });
  };

  const compactSegments = useCasesCompactSegments(draft);

  return (
    <SearchGroupProvider>
      <div className="flex min-h-screen min-w-0 flex-col overflow-x-clip bg-[color:var(--surface-subtle)] text-foreground">
        <SiteHeader
          merged
          centerSlot={<CompactSearchPill segments={compactSegments} icon="/nav-case-board.png" />}
        />
        <main className="min-w-0 flex-1 bg-[color:var(--surface-subtle)]">
          {/* Page header with the post CTA */}
          <section className="border-b border-border bg-[color:var(--surface-header)] lg:border-b-0">
            <PageContainer width="default" className="py-10 sm:py-12">
              <Badge variant="outline" className="mb-4">
                Tutor requests
              </Badge>
              <h1 className="text-2xl font-medium tracking-tight text-[color:var(--ink)] sm:text-3xl">
                Requesting a tutor that meets your requirements?
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Fill in this form and tutors who&rsquo;re qualified and interested can apply for
                your case!
              </p>
              <div className="mt-6">
                <Button
                  onClick={toggleForm}
                  variant="solid"
                  color="neutral"
                  shape="pill"
                  className="h-11 px-6 font-medium"
                >
                  {formOpen ? "Hide form" : "Post your request"}
                </Button>
              </div>
              <CasesSearchMobile
                className="mt-7"
                draft={draft}
                onDraftChange={setDraftParam}
                onApply={applySearch}
                onClear={clearSearch}
                defaultOverlayOpen={search.open === true}
              />
            </PageContainer>
          </section>

          {/* Collapsible request form */}
          {formOpen ? (
            <div ref={formSectionRef} className="scroll-mt-24">
              <PageContainer width="default" className="py-10 sm:py-12">
                <div className="mb-6">
                  <h2 className="text-2xl font-medium tracking-tight text-[color:var(--ink)] sm:text-3xl">
                    Post your request
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Tell us what you need and our team will review it, approved requests appear on
                    this board so qualified tutors can apply directly.
                  </p>
                </div>
                <CaseRequestForm idPrefix="tr" />
              </PageContainer>
            </div>
          ) : null}

          <StickySearchBar>
            <PageContainer width="default" className="py-3">
              <CasesSearchBar
                draft={draft}
                onDraftChange={setDraftParam}
                onApply={applySearch}
                onClear={clearSearch}
              />
            </PageContainer>
          </StickySearchBar>

          {/* Klarna-style notice: bottom sheet on mobile, centered modal on desktop */}
          <Dialog open={noticeOpen} onOpenChange={setNoticeOpen}>
            <DialogContent className="max-h-[92dvh] w-full max-w-full gap-0 overflow-y-auto p-0 inset-x-0 top-auto bottom-0 translate-x-0 translate-y-0 rounded-none rounded-t-3xl border-x-0 border-b-0 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-lg sm:rounded-3xl sm:border-x sm:border-b sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0">
              <div className="flex flex-col items-stretch p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:p-8">
                <BadgeCheck
                  className="h-12 w-12 text-[color:var(--ink)]"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <DialogTitle className="mt-6 text-2xl font-medium tracking-tight text-[color:var(--ink)] sm:text-[28px]">
                  Requesting a tutor that meets your requirements?
                </DialogTitle>
                <DialogDescription className="mt-2 text-base leading-relaxed">
                  Fill in this form and tutors who&rsquo;re qualified and interested can apply for
                  your case!
                </DialogDescription>
                <div className="mt-8 flex flex-col gap-2">
                  <Button
                    onClick={() => {
                      setNoticeOpen(false);
                      openForm();
                    }}
                    variant="solid"
                    color="neutral"
                    shape="pill"
                    className="h-13 w-full text-base font-medium"
                  >
                    Post your request
                  </Button>
                  <Button
                    onClick={dismissNoticePermanently}
                    variant="ghost"
                    className="h-10 w-full text-sm text-muted-foreground"
                  >
                    Don&rsquo;t show again
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Board */}
          <section className="py-10 sm:py-12">
            <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
              <div className="mb-10">
                <Badge variant="outline" className="mb-4">
                  Tutor requests
                </Badge>
                <h2 className="text-2xl font-medium tracking-tight text-[color:var(--ink)] sm:text-3xl">
                  Open requests
                </h2>
                {hasActiveFilters ? (
                  <p className="mt-2 text-sm font-medium text-[color:var(--ink)]/70">
                    {filteredCases.length} {filteredCases.length === 1 ? "match" : "matches"}
                  </p>
                ) : null}
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Real tutoring requests from Hong Kong parents. Open a case for the full details
                  and apply for the ones that fit your schedule.
                </p>
                {/* Issue #311: the active tag filters, one click each to clear. */}
                {activeTags.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {activeTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--brand-link)] bg-[color:var(--brand-link)]/10 px-3 py-1 text-xs font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--brand-link)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/40"
                      >
                        <Hash className="h-3 w-3" aria-hidden="true" />
                        {tag}
                        <span aria-hidden="true" className="text-[color:var(--ink)]/50">
                          ×
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="p-0 sm:p-2">
                {isLoading ? (
                  <ListSkeleton cards={6} />
                ) : cases.length === 0 ? (
                  <div className="p-8 text-center sm:p-12">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center">
                      <Inbox
                        className="h-5 w-5 text-[color:var(--muted-foreground)]"
                        aria-hidden="true"
                      />
                    </div>
                    <h3 className="mt-4 text-xl font-medium tracking-tight text-[color:var(--ink)] sm:text-2xl">
                      No open requests right now
                    </h3>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                      Approved parent requests appear here for tutors to apply. Be the first, post
                      your requirements and let tutors come to you.
                    </p>
                    <div className="mt-6 flex justify-center">
                      <Button
                        onClick={openForm}
                        variant="solid"
                        color="neutral"
                        shape="pill"
                        className="h-11 px-6 font-medium"
                      >
                        Post your request
                      </Button>
                    </div>
                  </div>
                ) : filteredCases.length === 0 ? (
                  <div className="p-8 text-center sm:p-12">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--foreground)]/15 bg-[color:var(--foreground)]/[0.04]">
                      <SearchX
                        className="h-5 w-5 text-[color:var(--muted-foreground)]"
                        aria-hidden="true"
                      />
                    </div>
                    <h3 className="mt-4 text-xl font-medium tracking-tight text-[color:var(--ink)] sm:text-2xl">
                      {t("directory.empty_title")}
                    </h3>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                      {t("directory.empty_desc")}
                    </p>
                    <div className="mt-6 flex justify-center">
                      <Button onClick={clearSearch} variant="outline">
                        {t("search_ui.clear_all")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredCases.map((item) => (
                      <CaseCard
                        key={item.id}
                        item={item}
                        applied={appliedCodes.has(item.caseCode)}
                      />
                    ))}
                  </ul>
                )}

                <p className="mt-8 text-center text-xs text-muted-foreground sm:text-sm">
                  Interested in a case? Apply via WhatsApp and the MatchMax team will connect you
                  with the parent. Free for parents, our team replies within one business day.
                </p>
              </div>
            </div>
          </section>
          {compareCases.length > 0 && !compareOpen ? (
            <CaseCompareBar
              count={compareCases.length}
              onOpenCompare={() => setCompareOpen(true)}
              onClear={clearCompare}
            />
          ) : null}
          <CaseCompareDialog
            open={compareOpen}
            onOpenChange={setCompareOpen}
            cases={compareCases}
          />
        </main>
        <SiteFooter />
      </div>
    </SearchGroupProvider>
  );
}
