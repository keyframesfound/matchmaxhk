import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { Radio } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConsolePanel } from "@/components/ui/console-panel";
import {
  getCaseMatchWaves,
  runCaseMatchWaveAction,
} from "@/features/cases/case-match-waves.functions";

const STATUS_LABEL = {
  active: "Running",
  responded: "A tutor responded, waves held",
  paused: "Paused",
  exhausted: "Finished, needs desk follow-up",
  stopped: "Stopped",
} as const;

type WaveAction = "next" | "notify_all" | "pause" | "resume";

/** #657: wave status, scores and the explicit staff overrides on the case desk. */
export function CaseMatchWavesPanel({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const fetchState = useServerFn(getCaseMatchWaves);
  const runAction = useServerFn(runCaseMatchWaveAction);
  const queryKey = ["case-match-waves", caseId];
  const { data, error } = useQuery({
    queryKey,
    queryFn: () => fetchState({ data: { caseId } }),
  });
  const mutation = useMutation({
    mutationFn: (action: WaveAction) => runAction({ data: { caseId, action } }),
    onSuccess: ({ notified }, action) => {
      if (action === "next" || action === "notify_all") {
        toast.success(notified > 0 ? `Alerted ${notified} tutors` : "No more tutors to alert");
      }
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const run = data?.run ?? null;
  const tutors = data?.tutors ?? [];
  const notified = tutors.filter((t) => t.waveNo !== null);
  const paused = run?.status === "paused";

  return (
    <ConsolePanel>
      <div className="flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ink)]">
        <Radio className="h-4 w-4" aria-hidden="true" />
        Match alerts
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error.message}</p> : null}
      {run ? (
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <p>
            {STATUS_LABEL[run.status]} · wave {run.currentWave} · {notified.length} notified ·{" "}
            {notified.filter((t) => t.opened).length} opened ·{" "}
            {tutors.filter((t) => t.applied).length} applied
          </p>
          {run.nextWaveAt ? (
            <p>Next wave {format(new Date(run.nextWaveAt), "d MMM, HH:mm")}</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Not started. Starting here alerts the top matches for this case only.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("next")}
        >
          Notify next wave now
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => {
            if (window.confirm("Alert every remaining matching tutor now?")) {
              mutation.mutate("notify_all");
            }
          }}
        >
          Notify all matches now
        </Button>
        {run ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(paused ? "resume" : "pause")}
          >
            {paused ? "Resume" : "Pause"}
          </Button>
        ) : null}
      </div>
      {tutors.length > 0 ? (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer font-medium text-[color:var(--ink)]">
            Ranked tutors ({tutors.length})
          </summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {tutors.map((t) => (
              <li key={t.tutorId} className="flex justify-between gap-2">
                <span className="min-w-0 truncate">
                  {t.score} · {t.tutorCode} {t.displayName}
                </span>
                <span className="shrink-0">
                  {t.waveNo === null ? "Queued" : `Wave ${t.waveNo}`}
                  {t.opened ? " · opened" : ""}
                  {t.applied ? " · applied" : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </ConsolePanel>
  );
}
