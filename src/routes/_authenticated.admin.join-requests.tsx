import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Download,
  FileText,
  Image as ImageIcon,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ConsolePanel } from "@/components/ui/console-panel";
import {
  ConsoleTable,
  ConsoleTableBody,
  ConsoleTableEmpty,
  ConsoleTableHead,
  ConsoleTableSkeletonRows,
  ConsoleTd,
  ConsoleTh,
} from "@/components/ui/console-table";
import { cn } from "@/lib/utils";
import {
  fetchTutorApplications,
  formatDate,
  formatFileSize,
  getDaysUntilPurge,
  type TutorApplicationRecord,
  type TutorApplicationStatus,
} from "@/features/tutor-application/admin/queries";
import {
  buildAnswerRows,
  PROFESSIONAL_STATUS,
  type TutorApplication,
} from "@/lib/tutor-application.schema";

export const Route = createFileRoute("/_authenticated/admin/join-requests")({
  validateSearch: (search: Record<string, unknown>) => ({
    application:
      typeof search.application === "string" && search.application.trim()
        ? search.application.trim()
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Tutor Join Requests, MatchMax Admin" },
      { name: "description", content: "Review tutor join requests on MatchMax." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminJoinRequests,
});

const STATUS_LABELS: Record<TutorApplicationStatus, string> = {
  pending: "Pending",
  rejected: "Rejected",
  accepted: "Accepted",
};

function StatusPill({ status }: { status: TutorApplicationStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
        status === "pending" && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
        status === "rejected" && "bg-red-500/10 text-red-700 dark:text-red-400",
        status === "accepted" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function getApplicationPathLabel(row: TutorApplicationRecord): string {
  return row.data.status === "Professional Teacher/ Public Exam Examiner"
    ? "Professional / Examiner"
    : (row.data.curriculum ?? "—");
}

function ApplicationNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-[color:var(--ink)]/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[color:var(--ink)] sm:text-4xl">
            Application not found
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This join request no longer exists, it may have been permanently deleted after its
            30-day recovery window.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBack}
          className="h-9 text-xs font-bold"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Back to all applications
        </Button>
      </div>
    </div>
  );
}

// Issue #310: join-requests is now a READ-ONLY archive. Cards go live at
// submit (submitTutorApplication → publishTutorCardFromApplication), so the
// Accept/Reject queue is gone, staff manage the published cards from
// /admin/tutors (unpublish / suspend / ban).
type ArchiveTab = "all" | "linked";

const TAB_LABELS: Record<ArchiveTab, string> = {
  all: "All",
  linked: "Live-linked",
};

function AdminJoinRequests() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [tab, setTab] = useState<ArchiveTab>("all");
  const [searchText, setSearchText] = useState("");
  const [detailId, setDetailId] = useState<string | null>(search.application ?? null);

  const {
    data: applications = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["admin", "join-requests"],
    queryFn: fetchTutorApplications,
  });

  useEffect(() => {
    if (search.application) setDetailId(search.application);
  }, [search.application]);

  const clearDetailParam = () => {
    navigate({ to: "/admin/join-requests", search: { application: undefined } });
  };

  const openDetail = (id: string) => {
    setDetailId(id);
    navigate({ to: "/admin/join-requests", search: { application: id } });
  };

  const counts = useMemo(
    () => ({
      all: applications.length,
      linked: applications.filter((a) => a.linked_tutor_id).length,
    }),
    [applications],
  );

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return applications.filter((row) => {
      if (tab === "linked" && !row.linked_tutor_id) return false;
      if (!q) return true;
      return (
        row.data.name?.toLowerCase().includes(q) ||
        row.data.email?.toLowerCase().includes(q) ||
        row.id.toLowerCase().includes(q) ||
        (row.linked_tutor_code ?? "").toLowerCase().includes(q)
      );
    });
  }, [applications, tab, searchText]);

  const detailApplication = applications.find((row) => row.id === detailId) ?? null;

  if (detailApplication) {
    return (
      <div className="space-y-6">
        <ApplicationDetail
          application={detailApplication}
          onBack={() => {
            setDetailId(null);
            clearDetailParam();
          }}
        />
      </div>
    );
  }

  if (detailId && !isLoading && !isError) {
    return (
      <ApplicationNotFound
        onBack={() => {
          setDetailId(null);
          clearDetailParam();
        }}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[color:var(--ink)]/10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[color:var(--ink)] sm:text-4xl">
            Tutor Join Requests
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Read-only archive of join form submissions, every card went live at submit. Manage the
            published cards (unpublish / suspend / ban) from the Tutors page.
          </p>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)]/60 p-1">
          {(["all", "linked"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors",
                tab === value
                  ? "bg-[color:var(--ink)] text-[color:var(--surface)]"
                  : "text-muted-foreground hover:text-[color:var(--ink)]",
              )}
            >
              {TAB_LABELS[value]}
              {counts[value] > 0 ? (
                <span className="ml-1.5 tabular-nums opacity-70">{counts[value]}</span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, reference, or tutor code..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9 h-10 bg-[color:var(--surface)] border-[color:var(--ink)]/15"
          />
        </div>
      </div>

      <ConsoleTable tableClassName="text-left" minTableWidth="48rem">
        <ConsoleTableHead>
          <tr>
            <ConsoleTh>Applicant</ConsoleTh>
            <ConsoleTh>Path</ConsoleTh>
            <ConsoleTh>Overall Score</ConsoleTh>
            <ConsoleTh>Rate</ConsoleTh>
            <ConsoleTh>Live Card</ConsoleTh>
            <ConsoleTh>Submitted</ConsoleTh>
            <ConsoleTh align="right">Actions</ConsoleTh>
          </tr>
        </ConsoleTableHead>
        <ConsoleTableBody>
          {isLoading && <ConsoleTableSkeletonRows columns={7} />}

          {isError && (
            <ConsoleTableEmpty
              colSpan={7}
              icon={X}
              title="Could not load applications"
              description={(error as Error)?.message || "Please try again."}
            />
          )}

          {!isLoading && !isError && filtered.length === 0 && (
            <ConsoleTableEmpty
              colSpan={7}
              icon={ShieldCheck}
              title={searchText ? "No matching applications" : "You're all caught up"}
              description={
                searchText
                  ? "Try adjusting your search."
                  : tab === "linked"
                    ? "No applications have a linked live card yet."
                    : "New tutor join requests will appear here."
              }
            />
          )}

          {filtered.map((row) => (
            <tr
              key={row.id}
              className="cursor-pointer transition-colors hover:bg-[color:var(--surface-subtle)]/40"
              onClick={() => openDetail(row.id)}
            >
              <ConsoleTd>
                <div className="font-bold text-[color:var(--ink)]">{row.data.name || "—"}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{row.data.email}</div>
              </ConsoleTd>
              <ConsoleTd className="text-xs font-semibold text-[color:var(--ink)]">
                {getApplicationPathLabel(row)}
              </ConsoleTd>
              <ConsoleTd className="text-xs font-semibold text-[color:var(--ink)]">
                {row.data.overallScore || "—"}
              </ConsoleTd>
              <ConsoleTd className="font-semibold text-[color:var(--ink)]">
                HK${row.data.hourlyRate}
                <span className="text-xs text-muted-foreground font-normal">/hr</span>
              </ConsoleTd>
              <ConsoleTd>
                {row.linked_tutor_code ? (
                  <Link
                    to="/tutors/$tutorCode"
                    params={{ tutorCode: row.linked_tutor_code }}
                    target="_blank"
                    className="text-xs font-bold text-[color:var(--ink)] underline decoration-[color:var(--ink)]/30 underline-offset-2 hover:decoration-[color:var(--ink)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {row.linked_tutor_code}
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </ConsoleTd>
              <ConsoleTd className="text-xs text-muted-foreground">
                {formatDate(row.created_at)}
              </ConsoleTd>
              <ConsoleTd align="right">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    openDetail(row.id);
                  }}
                >
                  View
                </Button>
              </ConsoleTd>
            </tr>
          ))}
        </ConsoleTableBody>
      </ConsoleTable>
    </div>
  );
}

const SECTION_LABELS = {
  contact: [
    "Name",
    "Contact number / WhatsApp",
    "Email",
    "Country / region",
    "Graduation year",
    "Earliest start date",
  ],
  academic: [
    "Current status",
    "Professional roles",
    "Examining boards",
    "Teaching qualifications",
    "University / institution",
    "Degree / programme",
    "Postgraduate university",
    "Postgraduate degree / qualification",
    "High school and graduation year",
    "Primary curriculum",
    "Curricula completed",
    "Academic headline",
    "Overall achieved score",
    "Subjects and levels confident teaching",
    "Relevant subject results / academic strengths",
    "Awards / scholarships / achievements",
  ],
  teaching: [
    "Teaching / tutoring experience",
    "Normal hourly rate (HKD)",
    "Teaching materials available",
    "Preferred tutoring format",
    "Max number of students",
    "Preferred teaching location(s)",
    "Preferred medium of instruction",
    "Anything else / referral",
  ],
} as const;

function groupRows(rows: { label: string; value: string }[]) {
  const sections: { title: string; rows: { label: string; value: string }[] }[] = [
    { title: "Contact", rows: [] },
    { title: "Academic", rows: [] },
    { title: "Teaching terms", rows: [] },
    { title: "Other", rows: [] },
  ];
  for (const row of rows) {
    if ((SECTION_LABELS.contact as readonly string[]).includes(row.label)) {
      sections[0].rows.push(row);
    } else if ((SECTION_LABELS.academic as readonly string[]).includes(row.label)) {
      sections[1].rows.push(row);
    } else if ((SECTION_LABELS.teaching as readonly string[]).includes(row.label)) {
      sections[2].rows.push(row);
    } else {
      sections[3].rows.push(row);
    }
  }
  return sections.filter((section) => section.rows.length > 0);
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 border-b border-[color:var(--ink)]/[0.06] py-2.5 last:border-0 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-4">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className="whitespace-pre-wrap text-sm text-[color:var(--ink)]">{value}</span>
    </div>
  );
}

// Issue #323 Part 4: partial transcript verification.
//
// Applications carry structured scores/grades in the jsonb `data` blob. The
// join-form schema is evolving separately (overall score and per-subject
// grades are becoming optional), so these readers are deliberately tolerant:
// they read the raw record and return only data points that were explicitly
// provided, so legacy and future shapes both render without per-row code.
type SubjectGradeEntry = { subject: string; grade: string };

function readOverallScore(data: Record<string, unknown>): string | null {
  const raw = data.overallScore;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Professional-path applications store a placeholder, not a claim to verify.
  if (/^not applicable/i.test(trimmed)) return null;
  return trimmed;
}

function readSubjectGrades(data: Record<string, unknown>): SubjectGradeEntry[] {
  const raw = data.subjectGrades ?? data.subject_grades;
  if (Array.isArray(raw)) {
    const entries: SubjectGradeEntry[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const subject = typeof record.subject === "string" ? record.subject.trim() : "";
      if (!subject) continue;
      const gradeRaw = record.grade;
      const grade =
        typeof gradeRaw === "number"
          ? String(gradeRaw)
          : typeof gradeRaw === "string"
            ? gradeRaw.trim()
            : "";
      entries.push({ subject, grade });
    }
    return entries;
  }
  // Issue #323: the join form stores per-subject grades flattened into the
  // free-text "subjectResults" answer, one "Subject: Grade" line per result
  // (grouped under curriculum headers without colons). Parse the colon lines
  // so staff still get one checkbox per stated grade; anything that does not
  // match the pattern is bio-style prose and is not offered for verification.
  const text = typeof data.subjectResults === "string" ? data.subjectResults : "";
  const entries: SubjectGradeEntry[] = [];
  for (const line of text.split("\n")) {
    const match = line.match(/^([^:]{1,80}):\s+(.{1,60})$/);
    if (!match) continue;
    const subject = match[1].trim();
    const grade = match[2].trim();
    if (!subject || !grade) continue;
    entries.push({ subject, grade });
  }
  return entries;
}

/** "[Subject] - Grade [X]", or just "[Subject]" when the grade was omitted. */
function formatSubjectGradeLabel(entry: SubjectGradeEntry): string {
  if (!entry.grade) return entry.subject;
  return /^grade\b/i.test(entry.grade)
    ? `${entry.subject} - ${entry.grade}`
    : `${entry.subject} - Grade ${entry.grade}`;
}

function VerificationPanel({ application }: { application: TutorApplicationRecord }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const items = useMemo(() => {
    const data = (application.data ?? {}) as unknown as Record<string, unknown>;
    const overall = readOverallScore(data);
    const grades = readSubjectGrades(data);
    const list: { key: string; label: string }[] = [];
    if (overall) {
      const curriculum =
        typeof data.curriculum === "string" && data.curriculum.trim()
          ? data.curriculum.trim()
          : "Overall";
      list.push({ key: `overall:${overall}`, label: `${curriculum} overall score - ${overall}` });
    }
    for (const entry of grades) {
      list.push({
        key: `grade:${entry.subject}:${entry.grade}`,
        label: formatSubjectGradeLabel(entry),
      });
    }
    return list;
  }, [application.data]);

  return (
    <ConsolePanel padding="lg">
      <h2 className="text-base font-bold text-[color:var(--ink)]">Transcript verification</h2>
      {items.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Nothing submitted for verification, the applicant did not provide an overall score or
          per-subject grades.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            Tick each data point you matched against the uploaded transcript. Verify the stated
            grade and ignore the rest of the document.
          </p>
          <ul className="mt-3 space-y-1.5">
            {items.map((item) => (
              <li key={item.key}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[color:var(--ink)]/10 px-3 py-2 text-sm font-semibold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--surface-subtle)]/60">
                  <Checkbox
                    checked={checked[item.key] === true}
                    onCheckedChange={(value) =>
                      setChecked((prev) => ({ ...prev, [item.key]: value === true }))
                    }
                  />
                  <span>{item.label}</span>
                  {checked[item.key] === true ? (
                    <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                      Verified
                    </span>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </ConsolePanel>
  );
}

function ApplicationDetail({
  application,
  onBack,
}: {
  application: TutorApplicationRecord;
  onBack: () => void;
}) {
  const row = application;
  const rows = useMemo(() => {
    const all = buildAnswerRows(row.data as unknown as TutorApplication);
    return all.filter(
      (entry) =>
        entry.label !== "Achievement evidence" &&
        entry.label !== "Academic documents" &&
        entry.label !== "Student ID card",
    );
  }, [row.data]);
  const sections = useMemo(() => groupRows(rows), [rows]);
  const purgeDays = getDaysUntilPurge(row.purge_after);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-4 border-b border-[color:var(--ink)]/10">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="rounded-xl h-10 w-10 text-muted-foreground hover:text-[color:var(--ink)]"
            aria-label="Back to applications"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-[color:var(--ink)]">
                {row.data.name || "Application"}
              </h1>
              <StatusPill status={row.status} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {getApplicationPathLabel(row)} · Submitted {formatDate(row.created_at)}
              {row.status === "rejected" && purgeDays !== null
                ? ` · Auto-deletes in ${purgeDays} day${purgeDays === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {row.linked_tutor_code ? (
            <Link
              to="/tutors/$tutorCode"
              params={{ tutorCode: row.linked_tutor_code }}
              target="_blank"
              className="inline-flex h-9 items-center rounded-sm border border-[color:var(--ink)]/20 px-3 text-xs font-bold text-[color:var(--ink)] hover:bg-[color:var(--surface-subtle)]"
            >
              View live card · {row.linked_tutor_code}
            </Link>
          ) : null}
        </div>
      </div>

      {row.status === "rejected" && purgeDays !== null ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-xs font-medium text-amber-800 dark:text-amber-300">
          Legacy rejected application (no card was published). Auto-deletes in {purgeDays} day
          {purgeDays === 1 ? "" : "s"}.
        </div>
      ) : null}
      {row.linked_tutor_code ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-3 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          Published at submit, live card {row.linked_tutor_code}. Manage it (unpublish / suspend /
          ban) from the Tutors page.
        </div>
      ) : null}

      {/* Evidence files */}
      <ConsolePanel padding="lg">
        <h2 className="text-base font-bold text-[color:var(--ink)]">Evidence files</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Documents uploaded with this application and stored in R2.
        </p>
        <div className="mt-4 space-y-3">
          {row.attachment_files.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-[color:var(--surface-subtle)]/40 p-4 text-xs text-muted-foreground">
              No files were stored with this application.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {row.attachment_files.map((file) => (
                <a
                  key={file.key}
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center gap-3 rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)]/40 px-3.5 py-3 transition-colors hover:border-[color:var(--ink)]/25 hover:bg-[color:var(--surface-subtle)]"
                >
                  {file.contentType.startsWith("image/") ? (
                    <img
                      src={file.url}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-[color:var(--ink)]/10"
                    />
                  ) : (
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[color:var(--ink)]/[0.06] text-[color:var(--ink)]/70">
                      <FileText className="h-4.5 w-4.5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-[color:var(--ink)]">
                      {file.filename}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {file.source === "transcript"
                        ? "Transcript"
                        : file.source === "profile_photo"
                          ? "Profile photo"
                          : file.source === "student_card"
                            ? "Student ID card"
                            : "Achievement evidence"}
                      {file.label ? ` · ${file.label}` : ""} · {formatFileSize(file.size)}
                    </p>
                  </div>
                  <Download className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-[color:var(--ink)]" />
                </a>
              ))}
            </div>
          )}
          <DocumentStatusSummary application={row} />
        </div>
      </ConsolePanel>

      {/* Issue #323 Part 4: verify only the data points the applicant
          explicitly provided (keyed by id so ticks reset between apps). */}
      <VerificationPanel key={application.id} application={application} />

      {/* Submitted data */}
      {sections.map((section) => (
        <ConsolePanel key={section.title} padding="lg">
          <h2 className="text-base font-bold text-[color:var(--ink)]">{section.title}</h2>
          <div className="mt-2">
            {section.rows.map((infoRow) => (
              <InfoRow key={infoRow.label} label={infoRow.label} value={infoRow.value} />
            ))}
          </div>
        </ConsolePanel>
      ))}
    </div>
  );
}

function DocumentStatusSummary({ application }: { application: TutorApplicationRecord }) {
  // Issue #309: /join no longer collects evidence, grades now upload per-grade
  // from the tutor profile editor (tutor_grades + the staff queue). This
  // summary keeps rendering LEGACY applications, whose stored jsonb still
  // carries the old evidence fields; read them defensively off the raw row.
  const legacy = application.data as unknown as {
    academicDocuments?: { curriculum: string; status?: string; file?: unknown }[];
    achievements?: { title: string; description: string; proof?: unknown; proofStatus?: string }[];
    studentCard?: unknown;
  };
  const transcripts = Array.isArray(legacy.academicDocuments) ? legacy.academicDocuments : [];
  const achievements = Array.isArray(legacy.achievements) ? legacy.achievements : [];
  const studentCard = "studentCard" in legacy ? legacy.studentCard : undefined;
  const isProfessional = application.data.status === PROFESSIONAL_STATUS;
  if (transcripts.length === 0 && achievements.length === 0 && !studentCard) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {!isProfessional ? (
        <div className="rounded-xl border border-[color:var(--ink)]/10 p-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">Student ID card</p>
          <ul className="mt-2 space-y-1.5 text-xs">
            <li className="flex items-center gap-2">
              <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="font-semibold text-[color:var(--ink)]">
                Enrollment evidence for university / major (legacy)
              </span>
              <span
                className={cn(
                  "ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold",
                  studentCard
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                )}
              >
                {studentCard ? "Stored" : "Not provided"}
              </span>
            </li>
          </ul>
        </div>
      ) : null}
      {transcripts.length > 0 ? (
        <div className="rounded-xl border border-[color:var(--ink)]/10 p-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">
            Academic documents (legacy)
          </p>
          <ul className="mt-2 space-y-1.5 text-xs">
            {transcripts.map((doc, index) => (
              <li key={`${doc.curriculum}-${index}`} className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="font-semibold text-[color:var(--ink)]">{doc.curriculum}</span>
                <span
                  className={cn(
                    "ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold",
                    doc.file
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : doc.status === "provide_later"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {doc.file ? "Stored" : doc.status === "provide_later" ? "Provide later" : "N/A"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {achievements.length > 0 ? (
        <div className="rounded-xl border border-[color:var(--ink)]/10 p-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">
            Achievement evidence (legacy)
          </p>
          <ul className="mt-2 space-y-2 text-xs">
            {achievements.map((achievement, index) => (
              <li key={`${achievement.title}-${index}`} className="space-y-1">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-semibold text-[color:var(--ink)]">{achievement.title}</span>
                  <span
                    className={cn(
                      "ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold",
                      achievement.proof
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : achievement.proofStatus === "provide_later"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {achievement.proof
                      ? "Stored"
                      : achievement.proofStatus === "provide_later"
                        ? "Provide later"
                        : "N/A"}
                  </span>
                </div>
                <p className="whitespace-pre-wrap pl-5 text-[11px] leading-relaxed text-muted-foreground">
                  {achievement.description}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// Issue #310: the RejectDialog was removed with the Accept/Reject queue.
