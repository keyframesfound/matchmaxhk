import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { PublicPage } from "@/components/layout/PublicPage";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CaseRequestForm } from "@/features/cases/CaseRequestForm";
import { PublicCaseCard } from "@/features/cases/public-case-card";
import { getPublicCaseBoard } from "@/lib/cases.functions";

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

function TutorRequestsPage() {
  const initialPost = Route.useSearch().post;
  const [formOpen, setFormOpen] = useState(Boolean(initialPost));
  const formSectionRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["cases", "board"],
    queryFn: () => getPublicCaseBoard(),
  });
  const cases = data?.items ?? [];
  const whatsappNumber = data?.whatsappNumber ?? "";
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

  return (
    <PublicPage>
      {/* Request banner */}
      <section className="border-b border-[color:var(--brand-teal)]/20 bg-[color:var(--brand-teal)]/8">
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
          className="scroll-mt-24 border-b border-[color:var(--brand-teal)]/20 bg-brand-gradient-soft"
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
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl font-black tracking-tight text-[color:var(--ink)] sm:text-3xl">
              Open tutor requests
            </h2>
            {!isLoading ? (
              <p className="text-sm text-muted-foreground">
                <span className="font-bold text-foreground">{cases.length}</span>{" "}
                {cases.length === 1 ? "case" : "cases"} accepting applications
              </p>
            ) : null}
          </div>

          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-[10px] border border-border" />
              ))}
            </div>
          ) : cases.length === 0 ? (
            <div className="rounded-[10px] border border-border bg-card p-8 text-center sm:p-12">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--brand-teal)]/30 bg-[color:var(--brand-teal)]/8">
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
            <div className="grid gap-6 md:grid-cols-2">
              {cases.map((item) => (
                <PublicCaseCard key={item.id} item={item} whatsappNumber={whatsappNumber} />
              ))}
            </div>
          )}

          <p className="mt-8 text-center text-xs text-muted-foreground sm:text-sm">
            Interested in a case? Apply via WhatsApp and the MatchMax team will connect you with the
            parent. Free for parents, our team replies within one business day.
          </p>
        </div>
      </section>
    </PublicPage>
  );
}
