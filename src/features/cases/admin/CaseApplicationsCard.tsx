/**
 * Issue #81, staff-side "Applications" card on the case desk: every tutor
 * who hit 1-click Apply for this case, with their code/name/subjects, the
 * optional pitch note, and a small status triage Select. Applications never
 * route to the parent, this card is where staff work them.
 *
 * Data comes from listCaseApplicationsAdmin (staff-gated server fn over the
 * RLS-deny case_applications table), never a direct client query.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Inbox } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConsolePanel } from "@/components/ui/console-panel";
import {
  listCaseApplicationsAdmin,
  updateApplicationStatus,
} from "@/features/cases/applications.functions";
import {
  APPLICATION_STATUSES,
  type CaseApplicationAdminRow,
  type CaseApplicationStatus,
} from "@/features/cases/applications";

const STATUS_LABEL_KEY: Record<CaseApplicationStatus, string> = {
  new: "caseApplications.status_new",
  reviewed: "caseApplications.status_reviewed",
  shortlisted: "caseApplications.status_shortlisted",
  rejected: "caseApplications.status_rejected",
};

function ApplicationRow({
  application,
  onStatusChange,
  pending,
}: {
  application: CaseApplicationAdminRow;
  onStatusChange: (status: CaseApplicationStatus) => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const tutor = application.tutors;
  const subjects = (tutor?.subjects ?? []).filter(Boolean);
  return (
    <div className="rounded-xl border border-[color:var(--ink)]/[0.07] bg-[color:var(--surface-subtle)]/40 px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-[color:var(--ink)]">
            <span className="truncate">{tutor?.display_name ?? "—"}</span>
            {tutor?.tutor_code ? (
              <span className="shrink-0 rounded bg-[color:var(--ink)]/[0.06] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[color:var(--ink)]">
                {tutor.tutor_code}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {subjects.length > 0
              ? subjects.join(" · ")
              : t("caseApplications.no_subjects", { defaultValue: "No subjects listed" })}
          </p>
        </div>
        <Select
          value={application.status}
          disabled={pending}
          onValueChange={(v) => onStatusChange(v as CaseApplicationStatus)}
        >
          <SelectTrigger className="h-7 w-[118px] shrink-0 text-xs font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {APPLICATION_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {t(STATUS_LABEL_KEY[status])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {application.note ? (
        <p className="mt-2 rounded-md bg-card px-2.5 py-1.5 text-xs leading-relaxed text-[color:var(--ink)]">
          “{application.note}”
        </p>
      ) : null}
      <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">
        {formatDistanceToNow(new Date(application.created_at), { addSuffix: true })}
      </p>
    </div>
  );
}

export function CaseApplicationsCard({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["admin", "case-applications", caseId],
    queryFn: () => listCaseApplicationsAdmin({ data: { caseId } }),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { id: string; status: CaseApplicationStatus }) =>
      updateApplicationStatus({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "case-applications", caseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <ConsolePanel>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium text-muted-foreground">
          {t("caseApplications.title", { defaultValue: "Applications" })}
        </h2>
        <Inbox className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="mt-3 space-y-2">
        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </>
        ) : applications.length === 0 ? (
          <p className="rounded-lg bg-[color:var(--surface-subtle)]/60 px-3 py-4 text-center text-xs text-muted-foreground">
            {t("caseApplications.empty", { defaultValue: "No tutor applications yet." })}
          </p>
        ) : (
          applications.map((application) => (
            <ApplicationRow
              key={application.id}
              application={application}
              pending={statusMutation.isPending && statusMutation.variables?.id === application.id}
              onStatusChange={(status) => statusMutation.mutate({ id: application.id, status })}
            />
          ))
        )}
      </div>
    </ConsolePanel>
  );
}
