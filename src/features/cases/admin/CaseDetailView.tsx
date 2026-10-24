import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  CalendarClock,
  Clock,
  ShieldAlert,
  ExternalLink,
  Loader2,
  MessageCircle,
  NotebookPen,
  Pencil,
  Phone,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/useAuth";
import { SorCasePanel } from "@/features/cases/admin/sor-desk";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/ui/tag-input";
import { CaseEditDialog } from "@/features/cases/admin/CaseEditDialog";
import { CaseApplicationsCard } from "@/features/cases/admin/CaseApplicationsCard";
import { MatchFeePanel } from "@/features/cases/admin/MatchFeePanel";
import { EngagementSummaryCard } from "@/features/cases/engagement-summary-card";
import { formatStudentLevel } from "@/features/cases/display";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConsolePanel } from "@/components/ui/console-panel";
import { InitialAvatar } from "@/components/ui/initial-avatar";
import { cn } from "@/lib/utils";
import {
  CASE_STATUSES,
  GENDER_LABEL,
  MODE_LABEL,
  START_LABEL,
  STATUS_LABEL,
  STATUS_PILL_CLASS,
  STUDENT_GENDER_LABEL,
  WHO_FOR_LABEL,
  caseBudgetHkdBounds,
  formatBudget,
  whatsappUrl,
  type CaseNoteRow,
  type CaseRow,
  type CaseStatus,
} from "./shared";

type SuggestedTutor = {
  id: string;
  tutor_code: string;
  display_name: string;
  headline: string | null;
  subjects: string[] | null;
  district: string | null;
  hourly_rate: number;
  badge: string | null;
  photo_url: string | null;
  experience_years: number | null;
  languages: string[] | null;
  score: number;
};

/** #412: readable labels for the stored triage answers (staff re-screen). */
const TRIAGE_LABELS: Record<string, string> = {
  scope: "Triage scope",
  engagementCategory: "Engagement category",
  contractingEntity: "Contracting entity",
  feeStructure: "Fee structure",
  feeAmount: "Fee amount",
  feeOpenToCounter: "Open to counter-proposal",
  premisesProvider: "Premises provider",
  scopeDescription: "Scope of services",
  adminDutiesRequired: "Admin/reception duties required",
  replacesVacancy: "Replaces a staff vacancy",
  methodologyOwner: "Teaching methodology owner",
  otherClientsAllowed: "Other clients allowed",
  substitutionAllowed: "Substitution / delegation",
  engager: "Who is engaging",
  nonTutoringDuties: "Non-tutoring duties required",
};

function TriageSummary({ triage }: { triage: Record<string, unknown> }) {
  const rows = Object.entries(triage).filter(([, v]) => v !== null && v !== undefined);
  if (rows.length === 0) return null;
  return (
    <dl className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
      {rows.map(([key, value]) => (
        <div key={key} className="min-w-0">
          <dt className="text-[11px] font-medium text-muted-foreground">
            {TRIAGE_LABELS[key] ?? key}
          </dt>
          <dd className="truncate text-sm font-medium text-[color:var(--ink)]">
            {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-[color:var(--ink)]">{value}</dd>
    </div>
  );
}

export function CaseDetailView({
  caseRow,
  allTags,
  onBack,
}: {
  caseRow: CaseRow;
  allTags: string[];
  onBack: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [noteBody, setNoteBody] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const invalidateCase = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "cases"] });
  };

  const { data: profile } = useQuery({
    queryKey: ["admin", "profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as { display_name: string | null; email: string | null } | null;
    },
  });

  const authorName =
    profile?.display_name || profile?.email?.split("@")[0] || user?.email || "Admin";

  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ["admin", "case-notes", caseRow.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_notes")
        .select("id, case_id, author_id, author_name, body, created_at")
        .eq("case_id", caseRow.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as CaseNoteRow[];
    },
  });

  const { data: suggestions = [], isLoading: suggestionsLoading } = useQuery({
    queryKey: ["admin", "case-matches", caseRow.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("match_tutors_for_case", {
        _case_id: caseRow.id,
        _limit: 5,
      });
      if (error) throw error;
      return (data ?? []) as unknown as SuggestedTutor[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (patch: Partial<CaseRow>) => {
      const { error } = await supabase
        .from("tutoring_cases")
        .update(patch as never)
        .eq("id", caseRow.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCase();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const noteMutation = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from("case_notes").insert({
        case_id: caseRow.id,
        author_id: user?.id ?? null,
        author_name: authorName,
        body,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setNoteBody("");
      queryClient.invalidateQueries({ queryKey: ["admin", "case-notes", caseRow.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tutoring_cases").delete().eq("id", caseRow.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Case ${caseRow.case_code} deleted`);
      invalidateCase();
      onBack();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Issue #412: a compliance-hold request is locked — no tutor recommend,
  // no circulate (board publish), no contact flow until staff re-screen.
  const complianceLocked = caseRow.status === "compliance_hold";
  // The only allowed exits from a hold are clearing it (new), closing, or
  // rejecting; escalate-to-contacted/matched must go through the unlock.
  const handleStatusChange = (next: CaseStatus) => {
    if (complianceLocked && (next === "contacted" || next === "matched")) {
      toast.error("Compliance hold: re-screen this request before contacting or matching.");
      return;
    }
    const patch: Partial<CaseRow> = { status: next };
    if (next === "contacted" && !caseRow.last_contacted_at) {
      patch.last_contacted_at = new Date().toISOString();
    }
    updateMutation.mutate(patch);
  };

  const boardPublishMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      // Issue #412: held requests never circulate — even a stale Public
      // selection cannot publish a compliance_hold case to the board.
      if (publish && caseRow.status === "compliance_hold") {
        throw new Error("Compliance hold: this request cannot be published until re-screened.");
      }
      const { error } = await supabase
        .from("tutoring_cases")
        .update({
          board_published_at: publish ? new Date().toISOString() : null,
        } as never)
        .eq("id", caseRow.id);
      if (error) throw error;
    },
    onSuccess: (_data, publish) => {
      toast.success(
        publish
          ? `Case ${caseRow.case_code} published to the tutor request board`
          : `Case ${caseRow.case_code} removed from the board`,
      );
      invalidateCase();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleAddNote = () => {
    const trimmed = noteBody.trim();
    if (!trimmed) return;
    noteMutation.mutate(trimmed);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 pb-6 border-b border-[color:var(--ink)]/10">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="mb-3 -ml-2 h-8 text-xs font-bold text-muted-foreground hover:text-[color:var(--ink)]"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> All cases
          </Button>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-lg bg-[color:var(--ink)]/[0.06] px-2.5 py-1 font-mono text-sm font-bold text-[color:var(--ink)]">
              {caseRow.case_code}
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-[color:var(--ink)] sm:text-3xl">
              {caseRow.title}
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_PILL_CLASS[caseRow.status]}`}
            >
              {STATUS_LABEL[caseRow.status]}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Received {formatDistanceToNow(new Date(caseRow.created_at), { addSuffix: true })} via{" "}
            {caseRow.source}
            {caseRow.last_contacted_at
              ? ` · last contacted ${formatDistanceToNow(new Date(caseRow.last_contacted_at), { addSuffix: true })}`
              : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* SoR panel (#201): status machine, lessons 1–2, admin fee, audit */}
        <div className="space-y-6 lg:col-span-3">
          <SorCasePanel caseId={caseRow.id} />
        </div>
        {/* Left column: requirements + contact + notes */}
        <div className="space-y-6 lg:col-span-2">
          <ConsolePanel>
            <h2 className="text-xs font-semibold text-muted-foreground">Requirements</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <DetailRow
                label="Student level"
                value={formatStudentLevel(caseRow.student_level) || caseRow.student_level}
              />
              <DetailRow
                label="Current grade"
                value={caseRow.student_grade_current ?? "Not provided"}
              />
              <DetailRow label="School" value={caseRow.student_school ?? "Not provided"} />
              <DetailRow
                label="Subjects"
                value={
                  caseRow.subjects.length > 0 ? (
                    <span className="flex flex-wrap gap-1">
                      {caseRow.subjects.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center rounded-md bg-[color:var(--ink)]/[0.06] px-2 py-0.5 text-[11px] font-medium"
                        >
                          {s}
                        </span>
                      ))}
                    </span>
                  ) : (
                    "Not provided"
                  )
                }
              />
              <DetailRow label="Curriculum" value={caseRow.exam_system ?? "Not specified"} />
              <DetailRow label="District" value={caseRow.district ?? "Any"} />
              <DetailRow label="Lesson mode" value={MODE_LABEL[caseRow.mode] ?? caseRow.mode} />
              <DetailRow
                label="Lessons"
                value={`${caseRow.sessions_per_week}x / week, ${caseRow.session_length_minutes} min`}
              />
              <DetailRow
                label="Tutor gender"
                value={GENDER_LABEL[caseRow.preferred_gender] ?? caseRow.preferred_gender}
              />
              {/* Issue #437: case-level demographics (legacy rows pre-date
                  the columns — show a quiet placeholder, never a crash). */}
              <DetailRow
                label="Who is this for"
                value={caseRow.who_for ? (WHO_FOR_LABEL[caseRow.who_for] ?? caseRow.who_for) : "—"}
              />
              <DetailRow
                label="Student gender"
                value={
                  caseRow.student_gender
                    ? (STUDENT_GENDER_LABEL[caseRow.student_gender] ?? caseRow.student_gender)
                    : "—"
                }
              />
            </div>
            {caseRow.description ? (
              <div className="mt-5 border-t border-[color:var(--ink)]/[0.07] pt-4">
                <h3 className="text-[11px] font-medium text-muted-foreground">Parent notes</h3>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--ink)]">
                  {caseRow.description}
                </p>
              </div>
            ) : null}
            {caseRow.schedule_note ? (
              <div className="mt-4 border-t border-[color:var(--ink)]/[0.07] pt-4">
                <h3 className="text-[11px] font-medium text-muted-foreground">Schedule notes</h3>
                <p className="mt-1.5 text-sm text-[color:var(--ink)]">{caseRow.schedule_note}</p>
              </div>
            ) : null}
          </ConsolePanel>

          <ConsolePanel>
            <h2 className="text-xs font-semibold text-muted-foreground">Parent contact</h2>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[color:var(--ink)]">{caseRow.contact_name}</p>
                <p className="text-sm text-muted-foreground">{caseRow.contact_phone}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" asChild className="h-9">
                  <a href={whatsappUrl(caseRow.contact_phone)} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> WhatsApp
                  </a>
                </Button>
                <Button size="sm" variant="outline" asChild className="h-9">
                  <a href={`tel:${caseRow.contact_phone.replace(/[^\d+]/g, "")}`}>
                    <Phone className="mr-1.5 h-3.5 w-3.5" /> Call
                  </a>
                </Button>
              </div>
            </div>
          </ConsolePanel>

          <ConsolePanel>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-muted-foreground">Internal notes</h2>
              <NotebookPen className="h-4 w-4 text-muted-foreground/60" aria-hidden="true" />
            </div>
            <div className="mt-3 space-y-2">
              <Textarea
                rows={3}
                placeholder="Add an internal note. Only visible to the MatchMax team."
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                className="w-full rounded-sm"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={!noteBody.trim() || noteMutation.isPending}
                  onClick={() => noteMutation.mutate(noteBody.trim())}
                  className="font-bold"
                >
                  {noteMutation.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Add note
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {notesLoading ? (
                <>
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </>
              ) : notes.length === 0 ? (
                <p className="rounded-lg bg-[color:var(--surface-subtle)]/60 px-3 py-4 text-center text-xs text-muted-foreground">
                  No notes yet. Log calls and follow-ups here so the team stays aligned.
                </p>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-xl border border-[color:var(--ink)]/[0.07] bg-[color:var(--surface-subtle)]/40 px-3.5 py-3"
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--ink)]">
                      {note.body}
                    </p>
                    <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">
                      {note.author_name ?? "Admin"} ·{" "}
                      {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </ConsolePanel>
        </div>

        {/* Right column: handling */}
        <div className="space-y-6">
          {/* Issue #412: compliance hold banner — the case is locked out of
              matching/circulation until staff re-screen the triage answers. */}
          {caseRow.status === "compliance_hold" ? (
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/[0.06] px-4 py-3.5">
              <p className="flex items-center gap-2 text-sm font-bold text-purple-700 dark:text-purple-300">
                <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                Compliance hold — matching, circulation, and contact release are locked
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Triage flagged this request. Review the answers below, contact the requester if
                needed, then set the status back to New to release the hold (or Close/Reject).
              </p>
              {caseRow.compliance_note ? (
                <p className="mt-2 rounded-md bg-card px-3 py-2 text-xs text-[color:var(--ink)]">
                  “{caseRow.compliance_note}”
                </p>
              ) : null}
              {caseRow.compliance_triage && Object.keys(caseRow.compliance_triage).length > 0 ? (
                <TriageSummary triage={caseRow.compliance_triage} />
              ) : null}
            </div>
          ) : null}
          <ConsolePanel>
            <h2 className="text-xs font-semibold text-muted-foreground">Handling</h2>
            <div className="mt-3 space-y-3">
              <Select
                value={caseRow.status}
                onValueChange={(v) => handleStatusChange(v as CaseStatus)}
              >
                <SelectTrigger className="h-9 w-full text-sm font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CASE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                className="h-9 w-full"
                disabled={
                  updateMutation.isPending || caseRow.status === "contacted" || complianceLocked
                }
                onClick={() =>
                  updateMutation.mutate({
                    status: "contacted",
                    last_contacted_at: new Date().toISOString(),
                  })
                }
              >
                <Clock className="mr-1.5 h-3.5 w-3.5" />
                {caseRow.last_contacted_at ? "Mark contacted again" : "Mark as contacted"}
              </Button>
            </div>
            <div className="mt-4 space-y-2 border-t border-[color:var(--ink)]/[0.07] pt-4 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                {START_LABEL[caseRow.start_timing ?? ""] ?? "Start timing not set"}
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                {formatBudget(caseBudgetHkdBounds(caseRow).min, caseBudgetHkdBounds(caseRow).max)}
              </div>
            </div>
          </ConsolePanel>

          <MatchFeePanel caseRow={caseRow} onPatched={invalidateCase} />

          {/* Issue #81: 1-click applications from the tutor board, triaged here. */}
          <CaseApplicationsCard caseId={caseRow.id} />

          {/* Issue #412 F: engagement summary + open change reports with
              staff resolve actions. */}
          <EngagementSummaryCard caseId={caseRow.id} party="customer" staff />

          <ConsolePanel>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-muted-foreground">Board listing</h2>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit request
              </Button>
            </div>
            <div className="mt-3 rounded-xl border border-[color:var(--ink)]/[0.07] bg-[color:var(--surface-subtle)]/40 px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <Label className="text-sm font-bold text-foreground">Board visibility</Label>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {caseRow.board_published_at
                      ? `Live at /tutor-requests since ${format(new Date(caseRow.board_published_at), "d MMM yyyy")}. Matched or closed cases are hidden automatically.`
                      : "Not published. Tutors can't see this case yet."}
                  </p>
                </div>
                <Select
                  value={caseRow.board_published_at !== null ? "public" : "private"}
                  onValueChange={(v) => boardPublishMutation.mutate(v === "public")}
                  disabled={
                    boardPublishMutation.isPending ||
                    (complianceLocked && caseRow.board_published_at === null)
                  }
                >
                  <SelectTrigger className="h-9 w-[110px] shrink-0 text-sm font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {caseRow.board_published_at ? (
              <a
                href="/tutor-requests"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[color:var(--brand-link)] hover:underline"
              >
                View board <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            ) : null}
          </ConsolePanel>

          <ConsolePanel>
            <h2 className="text-xs font-semibold text-muted-foreground">Tags</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Track pipeline state: follow-up, premium, matched-source.
            </p>
            <div className="mt-3">
              <TagInput
                value={caseRow.tags ?? []}
                onChange={(tags) => updateMutation.mutate({ tags })}
                suggestions={allTags}
                placeholder="Add tag…"
                maxTags={10}
              />
            </div>
          </ConsolePanel>

          <ConsolePanel>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-muted-foreground">Suggested tutors</h2>
              <Sparkles
                className="h-4 w-4 text-[color:var(--muted-foreground)]"
                aria-hidden="true"
              />
            </div>
            <div className="mt-3 space-y-2">
              {suggestionsLoading ? (
                <>
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                </>
              ) : suggestions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No published tutors to suggest yet.</p>
              ) : (
                suggestions.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-xl border border-[color:var(--ink)]/[0.07] px-3 py-2.5"
                  >
                    {t.photo_url ? (
                      <img
                        src={t.photo_url}
                        alt=""
                        className="h-9 w-9 rounded-lg object-cover ring-1 ring-[color:var(--ink)]/10"
                      />
                    ) : (
                      // Issue #437: branded deterministic initial avatar.
                      <InitialAvatar
                        stableId={t.tutor_code || t.id}
                        name={t.display_name}
                        className="h-9 w-9 text-[10px]"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-[color:var(--ink)]">
                        {t.display_name}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        HK${t.hourly_rate}/hr
                        {t.district ? ` · ${t.district}` : ""}
                      </p>
                    </div>
                    <span className="rounded-md bg-[color:var(--foreground)]/[0.06] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--foreground)]">
                      {Number(t.score).toFixed(0)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </ConsolePanel>

          <section className="rounded-2xl border border-destructive/20 bg-[color:var(--surface)] p-5">
            <h2 className="text-xs font-semibold text-muted-foreground">Danger zone</h2>
            <Button
              variant="destructive"
              size="sm"
              className="mt-3"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete case
            </Button>
          </section>
        </div>
      </div>

      <CaseEditDialog caseRow={caseRow} open={editOpen} onOpenChange={setEditOpen} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete case {caseRow.case_code}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the case request and its internal notes. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete case
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
