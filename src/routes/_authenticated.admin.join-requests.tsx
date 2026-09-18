import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Download,
  FileText,
  Image as ImageIcon,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchTutorApplications,
  formatDate,
  formatFileSize,
  getDaysUntilPurge,
  type TutorApplicationRecord,
  type TutorApplicationStatus,
} from "@/features/tutor-application/admin/queries";
import { buildAnswerRows, type TutorApplication } from "@/lib/tutor-application.schema";

export const Route = createFileRoute("/_authenticated/admin/join-requests")({
  validateSearch: (search: Record<string, unknown>) => ({
    application:
      typeof search.application === "string" && search.application.trim()
        ? search.application.trim()
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Tutor Join Requests — MatchMax Admin" },
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
            This join request no longer exists — it may have been permanently deleted after its
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

function AdminJoinRequests() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const [tab, setTab] = useState<TutorApplicationStatus>("pending");
  const [searchText, setSearchText] = useState("");
  const [detailId, setDetailId] = useState<string | null>(search.application ?? null);
  const [rejecting, setRejecting] = useState<TutorApplicationRecord | null>(null);

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

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      rejectedAt,
      purgeAfter,
    }: {
      id: string;
      status: TutorApplicationStatus;
      rejectedAt?: string | null;
      purgeAfter?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("tutor_applications")
        .update({
          status,
          rejected_at: rejectedAt ?? null,
          purge_after: purgeAfter ?? null,
        } as never)
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(
          "No changes were saved — your session may not have admin access to this application.",
        );
      }
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "join-requests"] });
    },
  });

  const clearDetailParam = () => {
    navigate({ to: "/admin/join-requests", search: { application: undefined } });
  };

  const openDetail = (id: string) => {
    setDetailId(id);
    navigate({ to: "/admin/join-requests", search: { application: id } });
  };

  const counts = useMemo(
    () => ({
      pending: applications.filter((a) => a.status === "pending").length,
      rejected: applications.filter((a) => a.status === "rejected").length,
      accepted: applications.filter((a) => a.status === "accepted").length,
    }),
    [applications],
  );

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return applications.filter((row) => {
      if (row.status !== tab) return false;
      if (!q) return true;
      return (
        row.data.name?.toLowerCase().includes(q) ||
        row.data.email?.toLowerCase().includes(q) ||
        row.id.toLowerCase().includes(q)
      );
    });
  }, [applications, tab, searchText]);

  const detailApplication = applications.find((row) => row.id === detailId) ?? null;

  const acceptApplication = (row: TutorApplicationRecord) => {
    if (row.status !== "pending") {
      updateStatus.mutate(
        { id: row.id, status: "pending", rejectedAt: null, purgeAfter: null },
        {
          onSuccess: () =>
            toast.success("Application moved back to pending", {
              description:
                "You can accept or reject it again. Any tutor card already created from it is unaffected.",
            }),
        },
      );
      return;
    }
    updateStatus.mutate(
      { id: row.id, status: "accepted" },
      {
        onSuccess: () => {
          toast.success("Application accepted", {
            description: "Create the tutor card from the Tutors page.",
          });
          navigate({
            to: "/admin/tutors",
            search: { create: true, applicationId: row.id },
          });
        },
      },
    );
  };

  const rejectApplication = (row: TutorApplicationRecord) => {
    const now = new Date();
    const purgeAfter = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    updateStatus.mutate(
      {
        id: row.id,
        status: "rejected",
        rejectedAt: now.toISOString(),
        purgeAfter: purgeAfter.toISOString(),
      },
      {
        onSuccess: () => {
          toast.success("Application rejected", {
            description: "Data is kept for 30 days, then auto-deleted.",
          });
          setRejecting(null);
        },
      },
    );
  };

  if (detailApplication) {
    return (
      <div className="space-y-6">
        <ApplicationDetail
          application={detailApplication}
          onBack={() => {
            setDetailId(null);
            clearDetailParam();
          }}
          isMutating={updateStatus.isPending}
          onAccept={() => acceptApplication(detailApplication)}
          onReject={() => setRejecting(detailApplication)}
        />
        <RejectDialog
          open={Boolean(rejecting)}
          application={rejecting}
          isPending={updateStatus.isPending}
          onConfirm={() => rejecting && rejectApplication(rejecting)}
          onCancel={() => setRejecting(null)}
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
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-[color:var(--ink)] sm:text-4xl">
              Tutor Join Requests
            </h1>
            {counts.pending > 0 ? (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                {counts.pending} pending
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Review join form submissions. Rejected applications stay recoverable for 30 days before
            automatic deletion.
          </p>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)]/60 p-1">
          {(["pending", "rejected", "accepted"] as const).map((value) => (
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
              {STATUS_LABELS[value]}
              {counts[value] > 0 ? (
                <span className="ml-1.5 tabular-nums opacity-70">{counts[value]}</span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or reference..."
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
            <ConsoleTh>Submitted</ConsoleTh>
            <ConsoleTh align="right">Actions</ConsoleTh>
          </tr>
        </ConsoleTableHead>
        <ConsoleTableBody>
          {isLoading && <ConsoleTableSkeletonRows columns={6} />}

          {isError && (
            <ConsoleTableEmpty
              colSpan={6}
              icon={X}
              title="Could not load applications"
              description={(error as Error)?.message || "Please try again."}
            />
          )}

          {!isLoading && !isError && filtered.length === 0 && (
            <ConsoleTableEmpty
              colSpan={6}
              icon={ShieldCheck}
              title={searchText ? "No matching applications" : "You're all caught up"}
              description={
                searchText
                  ? "Try adjusting your search."
                  : tab === "pending"
                    ? "New tutor join requests will appear here."
                    : `No ${STATUS_LABELS[tab].toLowerCase()} applications right now.`
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
              <ConsoleTd className="text-xs font-medium text-[color:var(--ink)]">
                {getApplicationPathLabel(row)}
              </ConsoleTd>
              <ConsoleTd className="text-xs font-semibold text-[color:var(--ink)]">
                {row.data.overallScore || "—"}
              </ConsoleTd>
              <ConsoleTd className="font-semibold text-[color:var(--ink)]">
                HK${row.data.hourlyRate}
                <span className="text-xs text-muted-foreground font-normal">/hr</span>
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
                  Review
                </Button>
              </ConsoleTd>
            </tr>
          ))}
        </ConsoleTableBody>
      </ConsoleTable>

      <RejectDialog
        open={Boolean(rejecting)}
        application={rejecting}
        isPending={updateStatus.isPending}
        onConfirm={() => rejecting && rejectApplication(rejecting)}
        onCancel={() => setRejecting(null)}
      />
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
    "High school and graduation year",
    "Primary curriculum",
    "Curricula completed",
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
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="whitespace-pre-wrap text-sm text-[color:var(--ink)]">{value}</span>
    </div>
  );
}

function ApplicationDetail({
  application,
  onBack,
  isMutating,
  onAccept,
  onReject,
}: {
  application: TutorApplicationRecord;
  onBack: () => void;
  isMutating: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const row = application;
  const rows = useMemo(() => {
    const all = buildAnswerRows(row.data as unknown as TutorApplication);
    return all.filter(
      (entry) => entry.label !== "Achievement evidence" && entry.label !== "Academic documents",
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
          {row.status === "rejected" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isMutating}
              onClick={onAccept}
              className="h-9 text-xs font-bold"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Re-accept (back to pending)
            </Button>
          ) : row.status === "accepted" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isMutating}
              onClick={onAccept}
              className="h-9 text-xs font-bold"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Move back to pending
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isMutating}
              onClick={onAccept}
              className="h-9 text-xs font-bold"
            >
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Accept &amp; Create Tutor
            </Button>
          )}
          {row.status !== "rejected" ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isMutating}
              onClick={onReject}
              className="h-9 text-xs font-bold"
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Reject
            </Button>
          ) : null}
        </div>
      </div>

      {row.status === "rejected" && purgeDays !== null ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-xs font-medium text-amber-800 dark:text-amber-300">
          This application was rejected on {formatDate(row.rejected_at)}. You can re-accept it for
          the next {purgeDays} day{purgeDays === 1 ? "" : "s"}; afterwards all submitted data is
          permanently deleted from our servers.
        </div>
      ) : null}
      {row.status === "accepted" ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-3 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          <p>
            Accepted. Use “AI Autofill → Load application data” in the tutor editor as a source
            while you create the tutor card manually.
          </p>
          <p className="mt-1">
            You can move it back to pending or reject it — any tutor card already created from it is
            unaffected.
          </p>
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
  const transcripts = application.data.academicDocuments ?? [];
  const achievements = application.data.achievements ?? [];
  if (transcripts.length === 0 && achievements.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {transcripts.length > 0 ? (
        <div className="rounded-xl border border-[color:var(--ink)]/10 p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Academic documents
          </p>
          <ul className="mt-2 space-y-1.5 text-xs">
            {transcripts.map((doc, index) => (
              <li key={`${doc.curriculum}-${index}`} className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="font-semibold text-[color:var(--ink)]">{doc.curriculum}</span>
                <span
                  className={cn(
                    "ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold",
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
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Achievement evidence
          </p>
          <ul className="mt-2 space-y-2 text-xs">
            {achievements.map((achievement, index) => (
              <li key={`${achievement.title}-${index}`} className="space-y-1">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-semibold text-[color:var(--ink)]">{achievement.title}</span>
                  <span
                    className={cn(
                      "ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold",
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

function RejectDialog({
  open,
  application,
  isPending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  application: TutorApplicationRecord | null;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject this application?</AlertDialogTitle>
          <AlertDialogDescription>
            {application?.data.name ?? "This applicant"} will move to the rejected list and stay
            recoverable for 30 days — you can re-accept within that window. After 30 days all
            submitted data is permanently deleted from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Reject application
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
