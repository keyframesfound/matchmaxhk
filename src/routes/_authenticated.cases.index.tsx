import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { MapPin, Clock, Wallet } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listPublicCases } from "@/lib/cases.functions";
import { DEFAULT_SUBJECT_OPTIONS } from "@/features/tutors/subjects";
import { HK_DISTRICTS } from "@/features/tutors/queries";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/cases/")({
  head: () => ({
    meta: [
      { title: "Open tutoring cases — MatchMax" },
      { name: "description", content: "Browse open tutoring cases from Hong Kong parents." },
    ],
  }),
  component: CasesBoard,
});

type PublicCase = {
  id: string;
  title: string;
  subject: string;
  exam_system: string | null;
  student_level: string;
  student_grade_current: string | null;
  district: string | null;
  mode: string;
  sessions_per_week: number;
  budget_min: number | null;
  budget_max: number | null;
  urgency: string;
  language_of_instruction: string;
  description: string | null;
  created_at: string;
  status: string;
};

function CasesBoard() {
  const listFn = useServerFn(listPublicCases);
  const [subject, setSubject] = useState<string>("all");
  const [district, setDistrict] = useState<string>("all");
  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["public-cases", subject, district],
    queryFn: () =>
      listFn({
        data: {
          subject: subject === "all" ? null : subject,
          district: district === "all" ? null : district,
        },
      }) as Promise<PublicCase[]>,
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
              Open tutoring cases
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Reviewed by our team. Tap a case to express interest.
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="all">Any subject</SelectItem>
                {DEFAULT_SUBJECT_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={district} onValueChange={setDistrict}>
              <SelectTrigger>
                <SelectValue placeholder="District" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="all">Any district</SelectItem>
                {HK_DISTRICTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div
              aria-label="Loading cases"
              className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="rounded-3xl border border-border bg-card p-6">
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                  <Skeleton className="mt-5 h-5 w-4/5" />
                  <Skeleton className="mt-3 h-4 w-full" />
                  <Skeleton className="mt-2 h-4 w-3/4" />
                  <Skeleton className="mt-6 h-4 w-2/3" />
                </div>
              ))}
            </div>
          ) : cases.length === 0 ? (
            <div className="mt-10 rounded-3xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              No open cases match your filters yet.
            </div>
          ) : (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cases.map((c) => (
                <Link
                  key={c.id}
                  to="/cases/$caseId"
                  params={{ caseId: c.id }}
                  className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-6 transition hover:border-[color:var(--brand-teal)]/40 hover:shadow-brand"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[color:var(--brand-teal)]/10 px-3 py-1 text-xs font-bold text-[color:var(--brand-teal)]">
                      {c.subject}
                    </span>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                      {c.student_level}
                    </span>
                    {c.urgency === "high" && (
                      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                        Urgent
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-foreground">{c.title}</h3>
                  {c.description && (
                    <p className="line-clamp-3 text-sm text-muted-foreground">{c.description}</p>
                  )}
                  <div className="mt-auto flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {c.district ?? "Flexible"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {c.sessions_per_week}/wk · {c.mode}
                    </span>
                    {(c.budget_min || c.budget_max) && (
                      <span className="inline-flex items-center gap-1">
                        <Wallet className="h-3 w-3" />
                        HK${c.budget_min ?? 0}–{c.budget_max ?? "?"}/hr
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
