/**
 * Issue #782 §2.5 (was #703) — private pre-lesson behaviour report panel,
 * mounted on the existing /admin/trust-safety staff desk.
 *
 * INTERNAL ONLY: files a concierge behaviour concern (parent or tutor)
 * against a case and lists filed reports plus accumulated strike counts.
 * Nothing here publishes to a tutor card, a parent profile or any public
 * query, and no filing triggers quarantine, rematch blocks or shortlist
 * consequences (AC-703-3 [UNVERIFIED] — thresholds await Ryan; see the
 * migration and server fn comments). It is NOT a replacement for the §2.4
 * Urgent Safety quarantine.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileWarning, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  createBehaviourReport,
  listBehaviourReports,
} from "@/features/trust/behaviour-report.functions";
import {
  BEHAVIOUR_SEVERITIES,
  BEHAVIOUR_SUBJECT_PARTIES,
  type BehaviourSeverity,
  type BehaviourSubjectParty,
} from "@/features/trust/behaviour-strikes";

const SEVERITY_LABEL_KEYS: Record<BehaviourSeverity, string> = {
  low: "trust.behaviour_report.severity.low",
  medium: "trust.behaviour_report.severity.medium",
  high: "trust.behaviour_report.severity.high",
};

const PARTY_LABEL_KEYS: Record<BehaviourSubjectParty, string> = {
  parent: "trust.behaviour_report.party.parent",
  tutor: "trust.behaviour_report.party.tutor",
};

/** One filed report row in the desk list. */
function ReportRow({
  row,
}: {
  row: Awaited<ReturnType<typeof listBehaviourReports>>["reports"][number];
}) {
  const { t } = useTranslation();
  const severityKey = isSeverity(row.severity) ? row.severity : "low";
  return (
    <tr>
      <ConsoleTd className="whitespace-nowrap text-xs text-muted-foreground">
        {new Date(row.createdAt).toLocaleString()}
      </ConsoleTd>
      <ConsoleTd className="text-xs font-semibold">{row.caseCode ?? row.caseId}</ConsoleTd>
      <ConsoleTd className="text-xs">
        {t(PARTY_LABEL_KEYS[row.subjectParty as BehaviourSubjectParty] ?? PARTY_LABEL_KEYS.parent)}
      </ConsoleTd>
      <ConsoleTd>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
          {t(SEVERITY_LABEL_KEYS[severityKey])}
        </span>
      </ConsoleTd>
      <ConsoleTd className="max-w-[320px] text-xs text-muted-foreground">{row.concern}</ConsoleTd>
      <ConsoleTd className="text-xs text-muted-foreground">
        {row.reportedBy?.slice(0, 8) ?? "—"}
      </ConsoleTd>
    </tr>
  );
}

function isSeverity(value: string): value is BehaviourSeverity {
  return (BEHAVIOUR_SEVERITIES as readonly string[]).includes(value);
}

export function BehaviourReportPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const reportsQuery = useQuery({
    queryKey: ["admin", "trust-safety", "behaviour-reports"],
    queryFn: () => listBehaviourReports(),
  });

  const [caseCode, setCaseCode] = useState("");
  const [party, setParty] = useState<BehaviourSubjectParty>("parent");
  const [severity, setSeverity] = useState<BehaviourSeverity>("low");
  const [concern, setConcern] = useState("");

  const fileReport = useMutation({
    mutationFn: () =>
      createBehaviourReport({
        data: { caseCode: caseCode.trim(), subjectParty: party, severity, concern: concern.trim() },
      }),
    onSuccess: () => {
      toast.success(t("trust.behaviour_report.toast.saved"));
      setCaseCode("");
      setConcern("");
      void queryClient.invalidateQueries({
        queryKey: ["admin", "trust-safety", "behaviour-reports"],
      });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : t("trust.behaviour_report.toast.error")),
  });

  const reports = reportsQuery.data?.reports ?? [];
  const strikeCounts = reportsQuery.data?.strikeCounts ?? {};
  const strikeEntries = Object.entries(strikeCounts).sort((a, b) => b[1] - a[1]);
  const canSubmit = caseCode.trim().length >= 2 && concern.trim().length > 0;

  return (
    <section className="mt-10">
      <h3 className="text-sm font-semibold tracking-tight">{t("trust.behaviour_report.title")}</h3>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        {t("trust.behaviour_report.description")}
      </p>

      <div className="mt-4 max-w-3xl space-y-3 rounded-lg border p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-[color:var(--ink)]">
              {t("trust.behaviour_report.form.case_code")}
            </Label>
            <Input
              value={caseCode}
              maxLength={32}
              onChange={(e) => setCaseCode(e.target.value)}
              placeholder={t("trust.behaviour_report.form.case_code_placeholder")}
              className="h-10 border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-[color:var(--ink)]">
              {t("trust.behaviour_report.form.subject")}
            </Label>
            <Select value={party} onValueChange={(v) => setParty(v as BehaviourSubjectParty)}>
              <SelectTrigger className="h-10 border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BEHAVIOUR_SUBJECT_PARTIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(PARTY_LABEL_KEYS[value])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-[color:var(--ink)]">
              {t("trust.behaviour_report.form.severity_label")}
            </Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as BehaviourSeverity)}>
              <SelectTrigger className="h-10 border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BEHAVIOUR_SEVERITIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(SEVERITY_LABEL_KEYS[value])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-[color:var(--ink)]">
            {t("trust.behaviour_report.form.concern")}
          </Label>
          <Textarea
            value={concern}
            maxLength={2000}
            rows={3}
            onChange={(e) => setConcern(e.target.value)}
            placeholder={t("trust.behaviour_report.form.concern_placeholder")}
            className="border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            disabled={!canSubmit || fileReport.isPending}
            onClick={() => fileReport.mutate()}
          >
            {fileReport.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {t("trust.behaviour_report.form.submit")}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t("trust.behaviour_report.form.internal_note")}
          </span>
        </div>
      </div>

      {strikeEntries.length > 0 ? (
        <div className="mt-6">
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {t("trust.behaviour_report.strikes.title")}
          </h4>
          <ul className="mt-2 flex flex-wrap gap-2">
            {strikeEntries.map(([key, count]) => (
              <li
                key={key}
                className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground"
                title={
                  key.startsWith("tutor:") || key === "parent:none"
                    ? key.replace("tutor:", "tutor ")
                    : key.replace("parent:", "parent ")
                }
              >
                {key.startsWith("tutor:")
                  ? t("trust.behaviour_report.strikes.tutor_count", { count })
                  : t("trust.behaviour_report.strikes.parent_count", { count })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6">
        <ConsoleTable minTableWidth="900px">
          <ConsoleTableHead>
            <tr>
              <ConsoleTh>{t("trust.behaviour_report.list.raised")}</ConsoleTh>
              <ConsoleTh>{t("trust.behaviour_report.list.case")}</ConsoleTh>
              <ConsoleTh>{t("trust.behaviour_report.list.subject")}</ConsoleTh>
              <ConsoleTh>{t("trust.behaviour_report.list.severity")}</ConsoleTh>
              <ConsoleTh>{t("trust.behaviour_report.list.concern")}</ConsoleTh>
              <ConsoleTh>{t("trust.behaviour_report.list.filed_by")}</ConsoleTh>
            </tr>
          </ConsoleTableHead>
          <ConsoleTableBody>
            {reportsQuery.isLoading ? (
              <ConsoleTableSkeletonRows columns={6} />
            ) : reports.length === 0 ? (
              <ConsoleTableEmpty
                colSpan={6}
                icon={FileWarning}
                title={t("trust.behaviour_report.list.empty")}
                description={t("trust.behaviour_report.list.empty_description")}
              />
            ) : (
              reports.map((row) => <ReportRow key={row.id} row={row} />)
            )}
          </ConsoleTableBody>
        </ConsoleTable>
      </div>
    </section>
  );
}
