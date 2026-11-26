import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConsolePanel } from "@/components/ui/console-panel";
import {
  getCsBackupTutors,
  queueCsBackupWave,
  type CsBackupResult,
} from "@/features/cases/cs-backups.functions";

type OkResult = Extract<CsBackupResult, { status: "ok" }>;

/**
 * #825 §2.2: 3 backup lookalikes on the case desk. Staff choose a seed (the
 * tutor who said no / went quiet / is being replaced), see why each backup
 * fits, and queue at most 3 pending pings. Nothing is sent from here.
 * English-first desk, with 繁中 on the copy the HK desk relies on.
 */
const COPY = {
  title: "3 backup lookalike tutors / 3 位後備相似導師",
  subtitle: "Filtered by this case and recent reply history.",
  suggest: "Suggest 3 lookalikes / 推薦 3 位匹配導師",
  short: "Fewer than 3 strict matches. / 少於 3 位完全匹配導師。",
  relax: "Relax rate +15% / Include online / 放寬學費 +15% ／ 包含網上授課",
  noneAfterRelax:
    "No backups match even after relaxing rate and including online tutors. Match manually, or widen the case filters. / 即使放寬學費及包含網上授課，仍找不到後備導師。請改為人手配對，或放寬個案條件。",
  loading: "Finding backup tutors… / 正在尋找後備導師…",
  error: "Couldn’t load backup tutors. Try again. / 未能載入後備導師。請再試一次。",
  centre: "Manual matching for Centre cases / 中心個案請以人手配對",
  queue: "Queue selected wave (max 3) / 加入派單名單（最多 3 位）",
  cap: "3 pings are already pending on this case. Wait for replies before queueing more.",
} as const;

const REASONS = [
  ["", "No rematch"],
  ["RATE_TOO_HIGH", "Rematch: rate too high"],
  ["TUTOR_QUIT", "Rematch: tutor quit"],
  ["PARENT_REQUESTED", "Rematch: parent requested"],
  ["OTHER", "Rematch: other"],
] as const;

type Reason = (typeof REASONS)[number][0];

export function CsBackupsPanel({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const fetchBackups = useServerFn(getCsBackupTutors);
  const queueWave = useServerFn(queueCsBackupWave);
  const [requested, setRequested] = useState(false);
  const [seed, setSeed] = useState("");
  const [reason, setReason] = useState<Reason>("");
  const [relax, setRelax] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const queryKey = ["cs-backups", caseId, seed, reason, relax];

  const { data, isFetching, isError } = useQuery({
    queryKey,
    queryFn: () =>
      fetchBackups({
        data: { caseId, seedTutorId: seed || null, rematchReason: reason || null, relax },
      }),
    enabled: requested,
    // Keep the last good list on a failed refresh (AC: never blank on error).
    placeholderData: (previous) => previous,
  });

  const queue = useMutation({
    mutationFn: () => queueWave({ data: { caseId, tutorIds: selected } }),
    onSuccess: ({ queued }) => {
      toast.success(`Queued ${queued}. Send the WhatsApp from the desk.`);
      setSelected([]);
      void queryClient.invalidateQueries({ queryKey: ["cs-backups", caseId] });
    },
    onError: (e: Error) => toast.error(e.message === "WAVE_CAP" ? COPY.cap : e.message),
  });

  const ok: OkResult | null = data && data.status === "ok" ? (data as OkResult) : null;
  const room = ok?.queueRoom ?? 0;
  const toggle = (id: string) =>
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < room ? [...cur, id] : cur,
    );

  return (
    <ConsolePanel>
      <div className="flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ink)]">
        <Users className="h-4 w-4" aria-hidden="true" />
        {COPY.title}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{COPY.subtitle}</p>

      {data?.status === "manual_centre" ? (
        <p className="mt-2 text-xs font-medium text-[color:var(--ink)]">{COPY.centre}</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <select
              aria-label="Seed tutor"
              className="h-8 rounded-[var(--radius-control)] border border-border bg-background px-2"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
            >
              <option value="">No seed (score against the case)</option>
              {(ok?.seedOptions ?? []).map((s) => (
                <option key={s.tutorId} value={s.tutorId}>
                  Like {s.tutorCode} {s.displayName}
                </option>
              ))}
            </select>
            <select
              aria-label="Rematch reason"
              className="h-8 rounded-[var(--radius-control)] border border-border bg-background px-2"
              value={reason}
              onChange={(e) => setReason(e.target.value as Reason)}
            >
              {REASONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isFetching}
              onClick={() => {
                setRequested(true);
                void queryClient.invalidateQueries({ queryKey });
              }}
            >
              {COPY.suggest}
            </Button>
          </div>

          {isFetching && !ok ? (
            <p className="mt-2 text-xs text-muted-foreground">{COPY.loading}</p>
          ) : null}
          {isError ? <p className="mt-2 text-xs text-destructive">{COPY.error}</p> : null}

          {ok ? (
            <div className="mt-3 space-y-2">
              {ok.picks.length < 3 ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {ok.picks.length === 0 && ok.relaxed ? COPY.noneAfterRelax : COPY.short}
                  </span>
                  {!ok.relaxed ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setRelax(true)}>
                      {COPY.relax}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <ul className="space-y-1.5 text-xs">
                {ok.picks.map((p) => (
                  <li key={p.tutorId} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      aria-label={`Select ${p.tutorCode}`}
                      checked={selected.includes(p.tutorId)}
                      disabled={!selected.includes(p.tutorId) && selected.length >= room}
                      onChange={() => toggle(p.tutorId)}
                    />
                    <span className="min-w-0">
                      <span className="font-medium text-[color:var(--ink)]">
                        {p.tutorCode} {p.displayName}
                      </span>{" "}
                      <span className="text-muted-foreground">· {p.reasons.join(" + ")}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Button
                  type="button"
                  size="sm"
                  disabled={selected.length === 0 || queue.isPending || room === 0}
                  onClick={() => queue.mutate()}
                >
                  {COPY.queue}
                </Button>
                <span>
                  {ok.pendingPings} pending · room for {room}
                </span>
              </div>
              {room === 0 ? <p className="text-xs text-muted-foreground">{COPY.cap}</p> : null}
            </div>
          ) : null}
        </>
      )}
    </ConsolePanel>
  );
}
