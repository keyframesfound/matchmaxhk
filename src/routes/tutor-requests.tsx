import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarClock, Clock, Inbox, MapPin, Wallet } from "lucide-react";
import { PublicPage } from "@/components/layout/PublicPage";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CaseRequestForm } from "@/features/cases/CaseRequestForm";
import { CASE_MODE_LABEL, formatCaseBudget, formatCaseSchedule } from "@/features/cases/display";
import { getPublicCaseBoard, type PublicCaseBoardItem } from "@/lib/cases.functions";

export const Route = createFileRoute("/tutor-requests")({
  validateSearch: (search: Record<string, unknown>): { post?: true } => ({
    post: search.post === "1" || search.post === true ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Tutor Request Board — Post a Request or Apply for Cases | MatchMax" },
      {
        name: "description",
        content:
          "Browse open tutoring cases posted by parents and students, or submit your requirements free and let qualified tutors apply for your case.",
      },
      { name: "robots", content: "index, follow" },
      {
        property: "og:title",
        content: "Tutor Request Board — Post a Request or Apply for Cases | MatchMax",
      },
      {
        property: "og:description",
        content:
          "Real tutoring requests from Hong Kong parents. Apply for a case that fits you, or post your own — free for parents.",
      },
      { property: "og:url", content: "https://matchmax.hk/tutor-requests" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/tutor-requests" }],
  }),
  component: TutorRequestsPage,
});

function rowTitle(item: PublicCaseBoardItem): string {
  return item.subjects.filter(Boolean).slice(0, 2).join(", ") || item.title;
}

const CASE_SECTION_ORDER = ["IB", "DSE", "IGCSE", "AP", "A-Level", "Not sure yet", "Other"];

function caseSectionLabel(examSystem: string | null): string {
  const value = examSystem?.trim();
  if (!value || value === "Other") return "Other";
  return value === "IB" ? "IBDP" : value;
}

function CaseListRow({ item }: { item: PublicCaseBoardItem }) {
  return (
    <li>
      <Link
        to="/tutor-requests/$caseCode"
        params={{ caseCode: item.caseCode }}
        className="group flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40"
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="flex items-center gap-2 text-sm font-bold text-[color:var(--ink)]">
            <span className="min-w-0 truncate">{rowTitle(item)}</span>
            {item.startTiming === "asap" ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                <CalendarClock className="h-3 w-3" aria-hidden="true" />
                ASAP
              </span>
            ) : null}
          </span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {item.district ?? CASE_MODE_LABEL[item.mode] ?? "Location flexible"}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {formatCaseSchedule(item.sessionsPerWeek, item.sessionLengthMinutes)}
            </span>
            <span className="flex items-center gap-1">
              <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
              {formatCaseBudget(item.budgetMin, item.budgetMax)}
            </span>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-[color:var(--ink)]">
          View details
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </Link>
    </li>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-3 w-28" />
      <div>
        <div className="flex flex-col divide-y divide-border">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-4 py-4">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TutorRequestsPage() {
  const initialPost = Route.useSearch().post;
  const [formOpen, setFormOpen] = useState(Boolean(initialPost));
  const formSectionRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["cases", "board"],
    queryFn: () => getPublicCaseBoard(),
  });
  const cases = useMemo(() => data?.items ?? [], [data]);
  const isLoading = !data;

  const openForm = () => {
    setFormOpen(true);
    window.requestAnimationFrame(() => {
      formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const toggleForm = () => {
    if (formOpen) {
      setFormOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      openForm();
    }
  };

  useEffect(() => {
    if (initialPost) {
      window.requestAnimationFrame(() => {
        formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [initialPost]);

  // Group the board by exam system, keeping the most common curricula first.
  const groups = useMemo(() => {
    const byExamSystem = new Map<string, PublicCaseBoardItem[]>();
    for (const item of cases) {
      const section = item.examSystem?.trim() || "Other";
      const list = byExamSystem.get(section) ?? [];
      list.push(item);
      byExamSystem.set(section, list);
    }
    const known = CASE_SECTION_ORDER.filter((section) => byExamSystem.has(section));
    const extra = [...byExamSystem.keys()]
      .filter((section) => !known.includes(section))
      .sort((a, b) => a.localeCompare(b));
    return [...known, ...extra].map((section) => ({
      section,
      items: byExamSystem.get(section)!,
    }));
  }, [cases]);

  return (
    <PublicPage mainClassName="bg-[color:var(--surface-subtle)]">
      {/* Request banner */}
      <section>
        <PageContainer
          width="wide"
          className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between sm:py-6"
        >
          <p className="max-w-3xl text-sm leading-relaxed text-[color:var(--ink)] sm:text-[15px]">
            Requesting a tutor that meets your requirements?{" "}
            <span className="font-bold">
              Fill in this form and tutors who&rsquo;re qualified and interested can apply for your
              case!
            </span>
          </p>
          <Button
            onClick={toggleForm}
            className="h-11 shrink-0 rounded-sm bg-[color:var(--surface-invert)] px-6 font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
          >
            {formOpen ? "Hide form" : "Post your request"}
          </Button>
        </PageContainer>
      </section>

      {/* Collapsible request form */}
      {formOpen ? (
        <div
          ref={formSectionRef}
          className="scroll-mt-24"
        >
          <PageContainer width="default" className="py-10 sm:py-12">
            <div className="mb-6">
              <h2 className="text-2xl font-black tracking-tight text-[color:var(--ink)] sm:text-3xl">
                Post your request
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Tell us what you need and our team will review it — approved requests appear on this
                board so qualified tutors can apply directly.
              </p>
            </div>
            <CaseRequestForm idPrefix="tr" />
          </PageContainer>
        </div>
      ) : null}

      {/* Board */}
      <section className="py-10 sm:py-12">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <div className="mb-10">
            <Badge variant="outline" className="mb-4">
              Tutor requests
            </Badge>
            <h2 className="text-2xl font-black tracking-tight text-[color:var(--ink)] sm:text-3xl">
              Open requests
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Real tutoring requests from Hong Kong parents. Open a case for the full details and
              apply for the ones that fit your schedule.
            </p>
          </div>

          <div className="p-0 sm:p-2">
            {isLoading ? (
              <div className="flex flex-col gap-8">
                <ListSkeleton rows={3} />
                <ListSkeleton rows={2} />
              </div>
            ) : cases.length === 0 ? (
              <div className="p-8 text-center sm:p-12">
                <div className="mx-auto flex h-12 w-12 items-center justify-center">
                  <Inbox className="h-5 w-5 text-[color:var(--brand-teal)]" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-xl font-black tracking-tight text-[color:var(--ink)] sm:text-2xl">
                  No open requests right now
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Approved parent requests appear here for tutors to apply. Be the first — post your
                  requirements and let tutors come to you.
                </p>
                <div className="mt-6 flex justify-center">
                  <Button
                    onClick={openForm}
                    className="h-11 rounded-sm bg-[color:var(--surface-invert)] px-6 font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
                  >
                    Post your request
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {groups.map((group) => (
                  <div key={group.section} className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {caseSectionLabel(group.section)}
                      </h3>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {group.items.length}
                      </span>
                    </div>
                    <ul className="flex flex-col">
                      {group.items.map((item) => (
                        <CaseListRow key={item.id} item={item} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-8 text-center text-xs text-muted-foreground sm:text-sm">
              Interested in a case? Apply via WhatsApp and the MatchMax team will connect you with
              the parent. Free for parents, our team replies within one business day.
            </p>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
