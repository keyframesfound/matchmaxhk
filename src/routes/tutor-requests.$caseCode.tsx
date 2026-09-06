import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Clock,
  GraduationCap,
  MapPin,
  Wallet,
} from "lucide-react";
import { PublicPage } from "@/components/layout/PublicPage";
import { WhatsAppIcon } from "@/components/layout/WhatsAppFloatButton";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CASE_GENDER_LABEL,
  CASE_MODE_LABEL,
  CASE_START_LABEL,
  buildCaseApplyWhatsAppUrl,
  formatCaseBudget,
  formatCaseSchedule,
  formatCaseTitle,
  formatStudentLevel,
} from "@/features/cases/display";
import { getPublicCaseByCode, type PublicCaseBoardItem } from "@/lib/cases.functions";

type CaseDetailData = { item: PublicCaseBoardItem; whatsappNumber: string };

export const Route = createFileRoute("/tutor-requests/$caseCode")({
  loader: async ({ params }) => {
    const data = await getPublicCaseByCode({ data: { caseCode: params.caseCode } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ match }) => {
    const data = (match.loaderData ?? null) as CaseDetailData | null;
    const title = data
      ? `${formatCaseTitle(data.item.studentLevel, data.item.subjects) || data.item.title} — Case ${data.item.caseCode} | MatchMax`
      : "Tutor request | MatchMax";
    const description = (
      data?.item.description ??
      "Open tutoring request from a Hong Kong parent on MatchMax. Apply via WhatsApp — free for tutors."
    ).slice(0, 200);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: CaseDetailPage,
});

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <Check
        className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--muted-foreground)]"
        aria-hidden="true"
      />
      <span>{children}</span>
    </li>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold tracking-tight text-[color:var(--ink)]">{children}</h2>;
}

function CaseDetailPage() {
  const { item, whatsappNumber } = Route.useLoaderData() as CaseDetailData;
  const applyUrl = buildCaseApplyWhatsAppUrl(whatsappNumber, item.caseCode);
  const title = formatCaseTitle(item.studentLevel, item.subjects) || item.title;

  const meta = [
    {
      icon: GraduationCap,
      label: formatStudentLevel(item.studentLevel) || item.studentLevel,
    },
    {
      icon: MapPin,
      label: item.district ?? CASE_MODE_LABEL[item.mode] ?? "Location flexible",
    },
    {
      icon: Clock,
      label: formatCaseSchedule(item.sessionsPerWeek, item.sessionLengthMinutes),
    },
    {
      icon: Wallet,
      label: formatCaseBudget(item.budgetMin, item.budgetMax),
    },
  ];

  const lessons = [
    `Subjects: ${item.subjects.filter(Boolean).join(", ") || "Not specified"}`,
    `${item.sessionsPerWeek} lesson${item.sessionsPerWeek === 1 ? "" : "s"} per week, ${item.sessionLengthMinutes} minutes each`,
    `${CASE_MODE_LABEL[item.mode] ?? item.mode} lessons${item.district ? ` · ${item.district}` : ""}`,
  ];

  const curriculum =
    item.examSystem && item.examSystem !== "Not sure yet" ? item.examSystem : "flexible";
  const preferences = [
    `Curriculum: ${curriculum}`,
    `Tutor gender: ${CASE_GENDER_LABEL[item.preferredGender] ?? "No preference"}`,
    `Start: ${CASE_START_LABEL[item.startTiming ?? ""] ?? "flexible"}`,
  ];

  return (
    <PublicPage>
      <section className="flex w-full justify-center px-4 py-10 sm:px-6 sm:py-14">
        <article className="w-full max-w-2xl">
          <Link
            to="/tutor-requests"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All open requests
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-3">
              <span className="w-fit rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
                {item.caseCode}
              </span>
              <h1 className="text-2xl font-black tracking-tight text-[color:var(--ink)] sm:text-3xl">
                {title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                {meta.map(({ icon: Icon, label }) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {label}
                  </span>
                ))}
                {item.startTiming === "asap" ? (
                  <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                    <CalendarClock className="h-4 w-4" aria-hidden="true" />
                    Starts ASAP
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Posted {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
              </p>
            </div>
            <Button asChild size="lg" variant="solid" color="blue" className="shrink-0">
              <a href={applyUrl} target="_blank" rel="noreferrer">
                <WhatsAppIcon aria-hidden="true" />
                Apply now
              </a>
            </Button>
          </div>

          <Separator className="my-8" />

          <div className="flex flex-col gap-8 text-[15px] leading-relaxed text-foreground/80">
            <div className="flex flex-col gap-3">
              <SectionHeading>About this request</SectionHeading>
              <p>
                {item.description ||
                  "The parent didn't add extra notes for this request. Apply via WhatsApp and the MatchMax team will share the full details."}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <SectionHeading>What the lessons look like</SectionHeading>
              <ul className="flex flex-col gap-2.5">
                {lessons.map((lesson) => (
                  <CheckItem key={lesson}>{lesson}</CheckItem>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <SectionHeading>Tutor preferences</SectionHeading>
              <ul className="flex flex-col gap-2.5">
                {preferences.map((preference) => (
                  <CheckItem key={preference}>{preference}</CheckItem>
                ))}
              </ul>
            </div>
          </div>

          <Separator className="my-8" />

          <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-bold text-[color:var(--ink)]">Ready to apply?</p>
              <p className="text-sm text-muted-foreground">
                Apply via WhatsApp and the MatchMax team will connect you with the parent — free for
                tutors, and we reply within one business day.
              </p>
            </div>
            <Button asChild variant="solid" color="blue" className="shrink-0">
              <a href={applyUrl} target="_blank" rel="noreferrer">
                <WhatsAppIcon aria-hidden="true" />
                Apply now
              </a>
            </Button>
          </div>
        </article>
      </section>
    </PublicPage>
  );
}
