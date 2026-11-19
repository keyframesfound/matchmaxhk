import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  BEHAVIOUR_CATEGORIES,
  fileBehaviourReport,
  getCaseBehaviourReports,
  voidBehaviourReport,
  type BehaviourCategory,
} from "@/features/trust/behaviour-reports.functions";

const CATEGORY_LABEL: Record<BehaviourCategory, string> = {
  unresponsive: "Unresponsive / no-show on comms",
  hostile: "Hostile or rude",
  boundary: "Boundary concern",
  safety_concern: "Safety concern (not urgent)",
  other: "Other",
};

/**
 * #782 §2.5 (was #703): private pre-lesson behaviour report + concierge
 * strikes on the staff case page. Ops only; nothing here reaches a public
 * card or parent profile. For an urgent safety risk use the Report reason
 * "Urgent safety" or Freeze & Suspend instead.
 */
export function BehaviourReportPanel({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["admin", "behaviour-reports", caseId] as const;
  const [subject, setSubject] = useState<"parent" | "tutor">("parent");
  const [category, setCategory] = useState<BehaviourCategory>("unresponsive");
  const [note, setNote] = useState("");
  const [strike, setStrike] = useState(true);

  const list = useQuery({ queryKey, queryFn: () => getCaseBehaviourReports({ data: { caseId } }) });
  const refresh = () => void queryClient.invalidateQueries({ queryKey });
  const file = useMutation({
    mutationFn: () =>
      fileBehaviourReport({ data: { caseId, subject, category, note: note.trim(), strike } }),
    onSuccess: () => {
      toast.success("Private behaviour report saved");
      setNote("");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed."),
  });
  const voidReport = useMutation({
    mutationFn: (reportId: string) => voidBehaviourReport({ data: { reportId } }),
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Void failed."),
  });

  const reports = list.data?.reports ?? [];
  const strikes = list.data?.strikes ?? { parent: 0, tutor: 0 };

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-[color:var(--ink)]/[0.07] px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--ink)]">
        <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" /> Behaviour reports (private)
      </p>
      <p className="text-[11px] text-muted-foreground">
        Concierge strikes, all cases: parent {strikes.parent} · tutor {strikes.tutor}. Staff only,
        never shown on cards or profiles.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          className="h-8 rounded-md border border-border bg-[color:var(--surface)] px-2 text-xs"
          value={subject}
          onChange={(e) => setSubject(e.target.value as "parent" | "tutor")}
          aria-label="About"
        >
          <option value="parent">About the parent</option>
          <option value="tutor">About the tutor</option>
        </select>
        <select
          className="h-8 rounded-md border border-border bg-[color:var(--surface)] px-2 text-xs"
          value={category}
          onChange={(e) => setCategory(e.target.value as BehaviourCategory)}
          aria-label="Category"
        >
          {BEHAVIOUR_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>
      <textarea
        className="min-h-[56px] w-full rounded-md border border-border bg-[color:var(--surface)] px-2 py-1.5 text-xs"
        placeholder="What happened before the lesson (facts only)…"
        maxLength={1000}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-[11px]">
          <input type="checkbox" checked={strike} onChange={(e) => setStrike(e.target.checked)} />
          Count as a concierge strike
        </label>
        <Button
          type="button"
          size="sm"
          className="h-7 px-3 text-xs font-bold"
          disabled={note.trim().length < 3 || file.isPending}
          onClick={() => file.mutate()}
        >
          Save report
        </Button>
      </div>
      {reports.length > 0 ? (
        <ul className="divide-y divide-[color:var(--ink)]/10 text-[11px]">
          {reports.map((r) => (
            <li key={r.id} className={`py-1.5 ${r.voided_at ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  {r.subject_role === "parent" ? "Parent" : "Tutor"} · {CATEGORY_LABEL[r.category]}
                  {r.strike ? " · strike" : ""}
                  {r.voided_at ? " · voided" : ""}
                </span>
                {!r.voided_at ? (
                  <button
                    type="button"
                    className="text-[11px] underline"
                    disabled={voidReport.isPending}
                    onClick={() => voidReport.mutate(r.id)}
                  >
                    Void
                  </button>
                ) : null}
              </div>
              <p className="text-muted-foreground">{r.note}</p>
              <p className="text-muted-foreground">
                {new Date(r.created_at).toLocaleString("en-HK")}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
