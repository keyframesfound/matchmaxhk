/**
 * #613 §4.1 Rosters & Attendance — the educator surface (tutor dashboard and
 * centre partner dashboard both land here). List + create; roster detail =
 * table (Student | Parent Status | Lessons Logged | Take Attendance), Cap.57
 * independent-operator notice row, Add Student, claim-link management,
 * markers and the 24h-correctable session history. Mobile 375px collapses
 * the table to cards with a pinned Take Attendance CTA.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CalendarCheck2,
  CircleDashed,
  ClipboardCopy,
  Link2,
  Loader2,
  Plus,
  ShieldOff,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { renewalBadgeFor } from "@/features/cases/fee-milestones";
import { ATTENDANCE_STATUSES, formatHktDateTime } from "@/features/rosters/roster-logic";
import { CheckInModal } from "@/features/rosters/checkin-modal";
import {
  addRosterStudent,
  assignRosterMarker,
  createRoster,
  createRosterClaimLink,
  editAttendance,
  getRoster,
  listAffiliatedTutors,
  listMyRosters,
  revokeRosterClaimLink,
  revokeRosterMarker,
  unlinkRosterParent,
  voidSession,
  type MyRoster,
  type RosterDetail,
} from "@/features/rosters/rosters.functions";

const QUERY_KEY_ROOT = ["rosters"] as const;

function errorMsg(error: unknown, fallbackKey: string): string {
  void fallbackKey;
  return error instanceof Error ? error.message : "error";
}

/** Maps server error codes to bilingual toasts; returns true when handled. */
function toastRosterError(error: unknown, t: (key: string) => string): void {
  const code = errorMsg(error, "rosters.error_generic");
  if (code.includes("ROSTER_FORBIDDEN")) toast.error(t("rosters.error_forbidden"));
  else if (code.includes("ATTENDANCE_STALE")) toast.error(t("rosters.error_stale"));
  else if (code.includes("ATTENDANCE_LOCKED")) toast.error(t("rosters.edit_tooltip"));
  else if (code.includes("DUPLICATE")) toast.warning(t("rosters.duplicate_warn"));
  else toast.error(t("rosters.error_generic"));
}

const SOURCE_KEY: Record<string, string> = {
  partner_course: "rosters.source_partner_course",
  matched_case: "rosters.source_matched_case",
  private_class: "rosters.source_private_class",
};

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea path
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Create roster dialog
// ---------------------------------------------------------------------------

function CreateRosterDialog({
  open,
  onOpenChange,
  prefillCourseId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillCourseId?: string;
  onCreated: (rosterId: string) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<"partner_course" | "matched_case" | "private_class">(
    prefillCourseId ? "partner_course" : "private_class",
  );
  const [caseCode, setCaseCode] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createRoster({
        data: {
          title: title.trim(),
          sourceType,
          courseId: sourceType === "partner_course" ? prefillCourseId : undefined,
          caseCode: sourceType === "matched_case" ? caseCode.trim() || undefined : undefined,
        },
      }),
    onSuccess: (result) => {
      toast.success(t("rosters.created_toast"));
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY_ROOT });
      onCreated(result.rosterId);
      onOpenChange(false);
      setTitle("");
      setCaseCode("");
    },
    onError: (error) => toastRosterError(error, t),
  });

  const sources: { value: typeof sourceType; label: string }[] = [
    { value: "partner_course", label: t("rosters.source_partner_course") },
    { value: "matched_case", label: t("rosters.source_matched_case") },
    { value: "private_class", label: t("rosters.source_private_class") },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[color:var(--ink)]">{t("rosters.create_title")}</DialogTitle>
          <DialogDescription>{t("rosters.create_hint")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="roster-title">{t("rosters.create_name")}</Label>
            <Input
              id="roster-title"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("rosters.create_name_ph")}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("rosters.create_source")}</Label>
            <div className="grid gap-1.5">
              {sources.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSourceType(s.value)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                    sourceType === s.value
                      ? "border-[color:var(--brand-link)]/50 bg-[color:var(--brand-link)]/[0.07] text-[color:var(--ink)]"
                      : "border-border text-muted-foreground hover:bg-[color:var(--foreground)]/[0.04]",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {sourceType === "partner_course" ? (
              <p className="text-xs text-muted-foreground">
                {prefillCourseId
                  ? t("rosters.create_course_prefill")
                  : t("rosters.create_course_from_courses")}
              </p>
            ) : null}
          </div>
          {sourceType === "matched_case" ? (
            <div className="space-y-1.5">
              <Label htmlFor="roster-case-code">{t("rosters.create_case_code")}</Label>
              <Input
                id="roster-case-code"
                value={caseCode}
                maxLength={40}
                onChange={(e) => setCaseCode(e.target.value)}
                className="h-11 font-mono"
              />
            </div>
          ) : null}
          <Button
            variant="solid"
            color="blue"
            className="font-bold"
            disabled={!title.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {t("rosters.create")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Add student dialog
// ---------------------------------------------------------------------------

function AddStudentDialog({
  open,
  onOpenChange,
  roster,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roster: RosterDetail;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [engagement, setEngagement] = useState<"standard_ongoing" | "short_course">(
    "standard_ongoing",
  );
  const [packageCount, setPackageCount] = useState<"" | "4" | "8" | "10">("");
  const locked = roster.roster.engagementLocked;

  const add = useMutation({
    mutationFn: () =>
      addRosterStudent({
        data: {
          rosterId: roster.roster.id,
          displayName: name.trim(),
          parentContact: contact.trim(),
          engagementType: locked ? undefined : engagement,
          packageLessonCount: packageCount ? (Number(packageCount) as 4 | 8 | 10) : undefined,
        },
      }),
    onSuccess: (result) => {
      if (result.duplicate) {
        toast.warning(t("rosters.duplicate_warn"));
      } else {
        toast.success(
          result.linkStatus === "linked" ? t("rosters.added_linked") : t("rosters.added_pending"),
        );
      }
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY_ROOT });
      onOpenChange(false);
      setName("");
      setContact("");
      setPackageCount("");
    },
    onError: (error) => toastRosterError(error, t),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[color:var(--ink)]">{t("rosters.add_title")}</DialogTitle>
          <DialogDescription>{roster.roster.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="student-name">{t("rosters.add_name")}</Label>
            <Input
              id="student-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="student-contact">{t("rosters.add_contact")}</Label>
            <Input
              id="student-contact"
              value={contact}
              maxLength={254}
              inputMode="email"
              onChange={(e) => setContact(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("rosters.add_engagement")}</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {(["standard_ongoing", "short_course"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={locked}
                  onClick={() => setEngagement(value)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                    (locked ? "standard_ongoing" : engagement) === value
                      ? "border-[color:var(--brand-link)]/50 bg-[color:var(--brand-link)]/[0.07] text-[color:var(--ink)]"
                      : "border-border text-muted-foreground hover:bg-[color:var(--foreground)]/[0.04]",
                    locked && "opacity-70",
                  )}
                >
                  {t(`rosters.engagement_${value}`)}
                </button>
              ))}
            </div>
            {locked ? (
              <p className="text-xs text-muted-foreground">{t("rosters.engagement_locked")}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="student-package">{t("rosters.add_package")}</Label>
            <div className="flex gap-1.5">
              {(["", "4", "8", "10"] as const).map((value) => (
                <button
                  key={value || "none"}
                  type="button"
                  onClick={() => setPackageCount(value)}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
                    packageCount === value
                      ? "border-[color:var(--brand-link)]/50 bg-[color:var(--brand-link)]/[0.07] text-[color:var(--ink)]"
                      : "border-border text-muted-foreground hover:bg-[color:var(--foreground)]/[0.04]",
                  )}
                >
                  {value || "—"}
                </button>
              ))}
            </div>
          </div>
          <Button
            variant="solid"
            color="blue"
            className="font-bold"
            disabled={!name.trim() || !contact.trim() || add.isPending}
            onClick={() => add.mutate()}
          >
            {add.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            {t("rosters.add_submit")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Marker panel (centre rosters)
// ---------------------------------------------------------------------------

function MarkersPanel({ roster }: { roster: RosterDetail }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const isCentreRoster = roster.roster.organizationId != null;

  const tutorsQuery = useQuery({
    queryKey: ["rosters", "affiliated", roster.roster.organizationId],
    enabled: pickerOpen && isCentreRoster,
    queryFn: () =>
      listAffiliatedTutors({ data: { organizationId: roster.roster.organizationId! } }),
  });

  const assign = useMutation({
    mutationFn: (markerUserId: string) =>
      assignRosterMarker({ data: { rosterId: roster.roster.id, markerUserId } }),
    onSuccess: () => {
      toast.success(t("rosters.marker_assigned"));
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY_ROOT });
      setPickerOpen(false);
    },
    onError: (error) => toastRosterError(error, t),
  });

  const revoke = useMutation({
    mutationFn: (markerUserId: string) =>
      revokeRosterMarker({ data: { rosterId: roster.roster.id, markerUserId } }),
    onSuccess: () => {
      toast.success(t("rosters.marker_revoked"));
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY_ROOT });
    },
    onError: (error) => toastRosterError(error, t),
  });

  const activeMarkers = roster.markers.filter((m) => !m.revoked);
  const tutors = tutorsQuery.data?.tutors ?? [];
  const assignable = tutors.filter(
    (tt) => !activeMarkers.some((m) => m.markerUserId === tt.userId),
  );

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-[color:var(--ink)]">{t("rosters.markers_title")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("rosters.markers_hint")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="font-semibold"
          disabled={!isCentreRoster}
          onClick={() => setPickerOpen((v) => !v)}
        >
          <UserPlus className="mr-2 h-4 w-4" aria-hidden />
          {t("rosters.assign_marker")}
        </Button>
      </div>
      {pickerOpen ? (
        <div className="mt-3 space-y-1.5">
          {tutorsQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">{t("rosters.loading")}</p>
          ) : assignable.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("rosters.markers_none")}</p>
          ) : (
            assignable.map((tt) => (
              <button
                key={tt.userId}
                type="button"
                disabled={assign.isPending}
                onClick={() => assign.mutate(tt.userId)}
                className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-[color:var(--foreground)]/[0.04]"
              >
                <span className="font-semibold text-[color:var(--ink)]">
                  {tt.name ?? tt.userId.slice(0, 8)}
                </span>
                <Plus className="h-4 w-4 text-muted-foreground" aria-hidden />
              </button>
            ))
          )}
        </div>
      ) : null}
      {activeMarkers.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {activeMarkers.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-lg bg-[color:var(--foreground)]/[0.04] px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2 font-semibold text-[color:var(--ink)]">
                <BadgeCheck className="h-4 w-4 text-emerald-600" aria-hidden />
                {m.markerName ?? m.markerUserId.slice(0, 8)}
              </span>
              {roster.roster.canManage ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-destructive hover:underline"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(m.markerUserId)}
                >
                  {t("rosters.revoke_marker")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session history (edit within 24h / void / read-only after)
// ---------------------------------------------------------------------------

function StatusBadge({ status, voided }: { status: string; voided?: boolean }) {
  const { t } = useTranslation();
  if (voided) {
    return (
      <span className="rounded-md bg-slate-500/10 px-2 py-0.5 text-xs font-medium text-muted-foreground line-through">
        {t(`rosters.status_${status}`)}
      </span>
    );
  }
  const cls: Record<string, string> = {
    present: "bg-emerald-500/10 text-emerald-700",
    late: "bg-amber-500/10 text-amber-700",
    absent_excused: "bg-sky-500/10 text-sky-700",
    absent_unexcused: "bg-[#F4212E]/10 text-destructive",
  };
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium",
        cls[status] ?? "bg-slate-500/10 text-muted-foreground",
      )}
    >
      {t(`rosters.status_${status}`)}
    </span>
  );
}

function SessionCard({
  roster,
  session,
}: {
  roster: RosterDetail;
  session: RosterDetail["sessions"][number];
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const edit = useMutation({
    mutationFn: (input: {
      attendanceId: string;
      toStatus: (typeof ATTENDANCE_STATUSES)[number];
      baseUpdatedAt: string;
    }) => editAttendance({ data: input }),
    onSuccess: () => {
      toast.success(t("rosters.edit_saved"));
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY_ROOT });
    },
    onError: (error) => toastRosterError(error, t),
  });

  const voidSessionMutation = useMutation({
    mutationFn: () =>
      voidSession({
        data: { sessionId: session.id, baseUpdatedAt: session.updatedAt },
      }),
    onSuccess: () => {
      toast.success(t("rosters.void_saved"));
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY_ROOT });
    },
    onError: (error) => toastRosterError(error, t),
  });

  const voidable =
    roster.roster.canMark &&
    session.status === "completed" &&
    session.attendance.some((a) => a.canCorrect);

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-[color:var(--ink)]">
            {session.sessionDate} · {session.startTime}
          </p>
          {session.sessionNote ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{session.sessionNote}</p>
          ) : null}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("rosters.marked_at", {
              time: formatHktDateTime(session.createdAt, i18n.language),
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {session.status === "voided" ? (
            <span className="rounded-md bg-slate-500/10 px-2 py-0.5 text-xs font-bold text-muted-foreground">
              {t("rosters.session_void")}
            </span>
          ) : null}
          {voidable ? (
            <Button
              variant="ghost"
              size="sm"
              className="font-semibold text-destructive"
              disabled={voidSessionMutation.isPending}
              onClick={() => voidSessionMutation.mutate()}
            >
              {t("rosters.void_session")}
            </Button>
          ) : null}
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {session.attendance.map((a) => {
          const canEdit = roster.roster.canMark && a.canCorrect && !a.voided;
          return (
            <li
              key={a.attendanceId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[color:var(--background)] px-3 py-2"
            >
              <span className="text-sm font-semibold text-[color:var(--ink)]">{a.studentName}</span>
              <span className="flex items-center gap-1.5">
                {canEdit ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="rounded-md focus-visible:ring-2 focus-visible:ring-[color:var(--brand-link)] focus-visible:outline-none"
                        aria-label={t("rosters.edit_attendance")}
                      >
                        <StatusBadge status={a.status} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {ATTENDANCE_STATUSES.map((status) => (
                        <DropdownMenuItem
                          key={status}
                          disabled={status === a.status || edit.isPending}
                          onClick={() =>
                            edit.mutate({
                              attendanceId: a.attendanceId,
                              toStatus: status,
                              baseUpdatedAt: a.updatedAt,
                            })
                          }
                        >
                          {t(`rosters.status_${status}`)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <span
                    title={roster.roster.canMark ? t("rosters.edit_tooltip") : undefined}
                    className="cursor-not-allowed"
                  >
                    <StatusBadge status={a.status} voided={a.voided} />
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {!roster.roster.canMark ? null : (
        <p className="mt-2 text-xs text-muted-foreground">
          {session.attendance.some((a) => a.canCorrect)
            ? t("rosters.editable_hint")
            : t("rosters.edit_tooltip")}
        </p>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Roster detail (§4.1 table + mobile cards)
// ---------------------------------------------------------------------------

function ClaimLinkActions({
  roster,
  studentId,
  hasActiveLink,
}: {
  roster: RosterDetail;
  studentId: string;
  hasActiveLink: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const createLink = useMutation({
    mutationFn: () => createRosterClaimLink({ data: { rosterStudentId: studentId } }),
    onSuccess: async (result) => {
      const copied = await copyText(result.shareTextBoth);
      toast.success(copied ? t("rosters.link_copied") : t("rosters.link_ready"));
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY_ROOT });
    },
    onError: (error) => toastRosterError(error, t),
  });

  const revokeLink = useMutation({
    mutationFn: () => revokeRosterClaimLink({ data: { rosterStudentId: studentId } }),
    onSuccess: () => {
      toast.success(t("rosters.link_revoked"));
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY_ROOT });
    },
    onError: (error) => toastRosterError(error, t),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="font-semibold"
          disabled={createLink.isPending}
        >
          {createLink.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Link2 className="mr-2 h-4 w-4" aria-hidden />
          )}
          {hasActiveLink ? t("rosters.regenerate_link") : t("rosters.copy_parent_link")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => createLink.mutate()}>
          <ClipboardCopy className="mr-2 h-4 w-4" aria-hidden />
          {hasActiveLink ? t("rosters.regenerate_link") : t("rosters.copy_parent_link")}
        </DropdownMenuItem>
        {hasActiveLink ? (
          <DropdownMenuItem className="text-destructive" onClick={() => revokeLink.mutate()}>
            <ShieldOff className="mr-2 h-4 w-4" aria-hidden />
            {t("rosters.revoke_link")}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StudentActions({
  roster,
  student,
  onTakeAttendance,
}: {
  roster: RosterDetail;
  student: RosterDetail["students"][number];
  onTakeAttendance: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const unlink = useMutation({
    mutationFn: () => unlinkRosterParent({ data: { rosterStudentId: student.id } }),
    onSuccess: () => {
      toast.success(t("rosters.unlinked_toast"));
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY_ROOT });
    },
    onError: (error) => toastRosterError(error, t),
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {roster.roster.canMark ? (
        <Button
          variant="solid"
          color="blue"
          size="sm"
          className="font-bold"
          onClick={onTakeAttendance}
        >
          <CalendarCheck2 className="mr-2 h-4 w-4" aria-hidden />
          {t("rosters.take_attendance")}
        </Button>
      ) : null}
      {roster.roster.canManage && student.linkStatus === "pending_link" ? (
        <ClaimLinkActions
          roster={roster}
          studentId={student.id}
          hasActiveLink={student.hasActiveClaimLink}
        />
      ) : null}
      {roster.roster.canManage && student.linkStatus === "linked" ? (
        <Button
          variant="ghost"
          size="sm"
          className="font-semibold text-muted-foreground"
          disabled={unlink.isPending}
          onClick={() => unlink.mutate()}
        >
          {t("rosters.unlink_parent")}
        </Button>
      ) : null}
    </div>
  );
}

function RosterDetailPanel({ rosterId, onBack }: { rosterId: string; onBack: () => void }) {
  const { t } = useTranslation();
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const detailQuery = useQuery({
    queryKey: ["rosters", "detail", rosterId],
    queryFn: () => getRoster({ data: { rosterId } }),
    retry: false,
  });

  if (detailQuery.isLoading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-border bg-card">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("rosters.error_forbidden")}</p>
        <Button variant="outline" className="mt-3 font-semibold" onClick={onBack}>
          {t("rosters.back")}
        </Button>
      </div>
    );
  }

  const roster = detailQuery.data;
  const lessonsLabel = (student: RosterDetail["students"][number]) =>
    student.packageLessonCount
      ? `${student.completedLessonCount}/${student.packageLessonCount}`
      : String(student.completedLessonCount);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-semibold text-[color:var(--brand-link)] hover:underline"
          >
            ← {t("rosters.title")}
          </button>
          <h2 className="mt-1 text-xl font-bold text-[color:var(--ink)]">{roster.roster.title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t(SOURCE_KEY[roster.roster.sourceType] ?? "rosters.source_private_class")}
            {roster.roster.caseCode ? ` · ${roster.roster.caseCode}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="font-semibold" onClick={() => setAddOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" aria-hidden />
            {t("rosters.add_student")}
          </Button>
          {roster.roster.canMark && roster.students.length > 0 ? (
            <Button
              variant="solid"
              color="blue"
              className="font-bold"
              onClick={() => setCheckinOpen(true)}
            >
              <CalendarCheck2 className="mr-2 h-4 w-4" aria-hidden />
              {t("rosters.take_attendance")}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Cap.57 independent-operator notice row (EN + 繁中 via i18n). */}
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/[0.06] px-4 py-3">
        <p className="text-xs leading-relaxed text-amber-700">{t("rosters.cap57_notice")}</p>
      </div>

      {roster.roster.organizationId != null ? <MarkersPanel roster={roster} /> : null}

      {/* #760 Part 1: tutor-side admin-fee milestones (matched rosters only;
          SELF_BROUGHT rosters are HK$0 and never render a commission box). */}
      {roster.feeMilestones ? <FeeMilestoneCard feeMilestones={roster.feeMilestones} /> : null}

      {roster.students.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <Users className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">{t("rosters.empty")}</p>
          {roster.roster.canManage ? (
            <Button
              variant="solid"
              color="accent"
              className="font-bold"
              onClick={() => setAddOpen(true)}
            >
              <UserPlus className="mr-2 h-4 w-4" aria-hidden />
              {t("rosters.add_student")}
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          {/* Desktop table (§4.1 columns) */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-[color:var(--foreground)]/[0.03] text-xs font-semibold text-muted-foreground">
                  <th className="px-4 py-3">{t("rosters.col_student")}</th>
                  <th className="px-4 py-3">{t("rosters.col_parent")}</th>
                  <th className="px-4 py-3">{t("rosters.col_lessons")}</th>
                  <th className="px-4 py-3 text-right">{t("rosters.col_action")}</th>
                </tr>
              </thead>
              <tbody>
                {roster.students.map((student) => (
                  <tr key={student.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[color:var(--ink)]">{student.displayName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t(
                          student.sourceTag === "matchmax_matched"
                            ? "rosters.tag_matched"
                            : "rosters.tag_self",
                        )}
                        {" · "}
                        {t(`rosters.engagement_${student.engagementType}`)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {student.linkStatus === "linked" ? (
                        <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          {t("rosters.parent_linked")}
                        </span>
                      ) : (
                        <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          {t("rosters.parent_pending")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-sm text-[color:var(--ink)]">
                        {lessonsLabel(student)}
                      </div>
                      {renewalBadgeFor(student.packageLessonCount, student.completedLessonCount)
                        ?.showBadge ? (
                        <p className="mt-0.5 text-xs font-semibold text-amber-700">
                          {t("rosters.package_renewal", {
                            remaining: renewalBadgeFor(
                              student.packageLessonCount,
                              student.completedLessonCount,
                            )?.remaining,
                          })}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <StudentActions
                          roster={roster}
                          student={student}
                          onTakeAttendance={() => setCheckinOpen(true)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards (375px) — CTA pinned bottom */}
          <div className="space-y-2 md:hidden">
            {roster.students.map((student) => (
              <div key={student.id} className="rounded-xl border border-border bg-card p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-[color:var(--ink)]">{student.displayName}</p>
                  {student.linkStatus === "linked" ? (
                    <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      {t("rosters.parent_linked")}
                    </span>
                  ) : (
                    <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      {t("rosters.parent_pending")}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("rosters.col_lessons")}: {lessonsLabel(student)}
                </p>
                {renewalBadgeFor(student.packageLessonCount, student.completedLessonCount)
                  ?.showBadge ? (
                  <p className="mt-1 text-xs font-semibold text-amber-700">
                    {t("rosters.package_renewal", {
                      remaining: renewalBadgeFor(
                        student.packageLessonCount,
                        student.completedLessonCount,
                      )?.remaining,
                    })}
                  </p>
                ) : null}
                <div className="mt-2.5">
                  <StudentActions
                    roster={roster}
                    student={student}
                    onTakeAttendance={() => setCheckinOpen(true)}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {roster.sessions.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-[color:var(--ink)]">
            {t("rosters.sessions_title")}
          </h3>
          <ul className="space-y-2">
            {roster.sessions.map((session) => (
              <SessionCard key={session.id} roster={roster} session={session} />
            ))}
          </ul>
        </div>
      ) : null}

      <CheckInModal open={checkinOpen} onOpenChange={setCheckinOpen} roster={roster} />
      {roster.roster.canManage ? (
        <AddStudentDialog open={addOpen} onOpenChange={setAddOpen} roster={roster} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// #760 Part 1: fee milestone ledger card (matched rosters, educator view)
// ---------------------------------------------------------------------------

function FeeMilestoneCard({
  feeMilestones,
}: {
  feeMilestones: NonNullable<RosterDetail["feeMilestones"]>;
}) {
  const { t, i18n } = useTranslation();
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[color:var(--ink)]">
          {t("rosters.milestones_title")}
        </h3>
        {feeMilestones.rateHkd != null ? (
          <span className="text-xs text-muted-foreground">
            {t("rosters.milestones_rate", { rate: feeMilestones.rateHkd })}
          </span>
        ) : null}
      </div>
      {feeMilestones.items.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("rosters.milestones_empty")}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {feeMilestones.items.map((m) => (
            <li key={m.kind} className="flex flex-wrap items-center gap-2 text-sm">
              {m.status === "delivered" ? (
                <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className="font-medium text-[color:var(--ink)]">
                {t(`rosters.milestone_${m.kind}`)}
              </span>
              {m.amountHkd != null ? (
                <span className="font-mono text-xs text-muted-foreground">
                  {t("rosters.milestones_amount", { amount: m.amountHkd })}
                </span>
              ) : null}
              {m.status === "delivered" && m.deliveredAt ? (
                <span className="text-xs text-muted-foreground">
                  · {formatHktDateTime(m.deliveredAt, i18n.language)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// List (top level)
// ---------------------------------------------------------------------------

function RosterListPanel({
  rosters,
  isLoading,
  onSelect,
  onCreate,
}: {
  rosters: MyRoster[];
  isLoading: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-border bg-card">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }
  if (rosters.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <Users className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{t("rosters.empty_list")}</p>
        <Button variant="solid" color="accent" className="font-bold" onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          {t("rosters.create")}
        </Button>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {rosters.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onSelect(r.id)}
            className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-[color:var(--foreground)]/[0.03]"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-[color:var(--ink)]">{r.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t(SOURCE_KEY[r.sourceType] ?? "rosters.source_private_class")}
                {r.caseCode ? ` · ${r.caseCode}` : ""}
                {" · "}
                {t("rosters.student_count", { count: r.studentCount })}
                {" · "}
                {t("rosters.linked_count", { count: r.linkedCount })}
              </p>
            </div>
            <span className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-[color:var(--ink)]">
              {t("rosters.manage")}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The full panel. `prefillCourseId`/`autoCreate` come from the route search
 * (centre course cards deep-link `?course=<id>&create=1`).
 */
export function RostersPanel({
  prefillCourseId,
  autoCreate,
  selectedRosterId,
  onSelectRoster,
}: {
  prefillCourseId?: string;
  autoCreate?: boolean;
  selectedRosterId?: string;
  onSelectRoster: (rosterId: string | null) => void;
}) {
  const { t } = useTranslation();
  const [createOpen, setCreateOpen] = useState(false);
  const listQuery = useQuery({
    queryKey: QUERY_KEY_ROOT,
    queryFn: () => listMyRosters(),
  });

  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!autoCreate) return;
    // Deep-linked create (centre course Manage Roster): open once, then the
    // created roster is selected by onCreated.
    setCreateOpen(true);
  }, [autoCreate]);

  const rosters = useMemo(() => listQuery.data?.rosters ?? [], [listQuery.data]);

  return (
    <div ref={listRef} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-normal text-[color:var(--ink)]">
            {t("rosters.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("rosters.subtitle")}</p>
        </div>
        <Button variant="outline" className="font-semibold" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          {t("rosters.create")}
        </Button>
      </div>

      {selectedRosterId ? (
        <RosterDetailPanel rosterId={selectedRosterId} onBack={() => onSelectRoster(null)} />
      ) : (
        <RosterListPanel
          rosters={rosters}
          isLoading={listQuery.isLoading}
          onSelect={(id) => onSelectRoster(id)}
          onCreate={() => setCreateOpen(true)}
        />
      )}

      <CreateRosterDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        prefillCourseId={prefillCourseId}
        onCreated={(rosterId) => onSelectRoster(rosterId)}
      />
    </div>
  );
}
