import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { DatePicker, dateToIso, isoToDate } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConsolePanel } from "@/components/ui/console-panel";
import {
  addMyBlackout,
  getMyBlackouts,
  getMyWeeklyWindows,
  removeMyBlackout,
  setMyWeeklyWindows,
  type WindowRow,
} from "@/features/cases/tutor.functions";
import { validateWindows } from "@/features/cases/tutor/week-model";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function minutesToHHmm(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
function hhmmToMinutes(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

/**
 * #204: tutor-published weekly windows (HKT) + blackout dates. Replaces the
 * window set on save; confirmed lessons are separate rows and survive edits.
 */
export function CalendarWindowsEditor() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const windowsQuery = useQuery({ queryKey: ["sor", "windows"], queryFn: getMyWeeklyWindows });
  const blackoutsQuery = useQuery({ queryKey: ["sor", "blackouts"], queryFn: getMyBlackouts });

  const [rows, setRows] = useState<
    { weekday: number; start: string; end: string; station: string }[]
  >([]);

  // Seed the editable rows once the saved windows arrive.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const windows = windowsQuery.data;
  if (windows && seededFor !== "seeded") {
    setSeededFor("seeded");
    setRows(
      windows.length > 0
        ? windows.map((w: WindowRow) => ({
            weekday: w.weekday,
            start: minutesToHHmm(w.start_minute),
            end: minutesToHHmm(w.end_minute),
            station: w.station ?? "",
          }))
        : [{ weekday: 0, start: "16:00", end: "20:00", station: "" }],
    );
  }

  const save = useMutation({
    mutationFn: () =>
      setMyWeeklyWindows({
        data: {
          windows: rows.map((r) => ({
            weekday: r.weekday,
            start_minute: hhmmToMinutes(r.start) ?? -1,
            end_minute: hhmmToMinutes(r.end) ?? -1,
            station: r.station || null,
          })),
        },
      }),
    onSuccess: () => {
      toast.success(t("sor.tutor_windows_saved"));
      queryClient.invalidateQueries({ queryKey: ["sor", "windows"] });
      queryClient.invalidateQueries({ queryKey: ["sor", "tutor-week"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const addBlackout = useMutation({
    mutationFn: (date: string) => addMyBlackout({ data: { date } }),
    onSuccess: () => {
      toast.success(t("sor.tutor_blackout_added"));
      queryClient.invalidateQueries({ queryKey: ["sor", "blackouts"] });
      queryClient.invalidateQueries({ queryKey: ["sor", "tutor-week"] });
    },
    onError: (e) => toast.error(e.message),
  });
  const removeBlackout = useMutation({
    mutationFn: (id: string) => removeMyBlackout({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sor", "blackouts"] }),
    onError: (e) => toast.error(e.message),
  });

  const [newBlackout, setNewBlackout] = useState("");
  const clientErrors = validateWindows(
    rows.map((r) => ({
      weekday: r.weekday,
      start_minute: hhmmToMinutes(r.start) ?? -1,
      end_minute: hhmmToMinutes(r.end) ?? -1,
    })),
  );

  return (
    <ConsolePanel title={t("sor.tutor_windows_title")}>
      <div className="space-y-3 p-4">
        {rows.map((row, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Select
              value={String(row.weekday)}
              onValueChange={(v) =>
                setRows(rows.map((r, j) => (j === i ? { ...r, weekday: Number(v) } : r)))
              }
            >
              <SelectTrigger aria-label={t("sor.tutor_window_day")} className="w-auto px-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_KEYS.map((d, idx) => (
                  <SelectItem key={d} value={String(idx)}>
                    {t(`sor.day_${d}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="time"
              aria-label={t("sor.tutor_window_start")}
              className="w-28"
              value={row.start}
              onChange={(e) =>
                setRows(rows.map((r, j) => (j === i ? { ...r, start: e.target.value } : r)))
              }
            />
            <span className="text-sm text-muted-foreground">–</span>
            <Input
              type="time"
              aria-label={t("sor.tutor_window_end")}
              className="w-28"
              value={row.end}
              onChange={(e) =>
                setRows(rows.map((r, j) => (j === i ? { ...r, end: e.target.value } : r)))
              }
            />
            <Input
              aria-label={t("sor.tutor_window_station")}
              placeholder={t("sor.tutor_window_station")}
              className="w-40"
              maxLength={60}
              value={row.station}
              onChange={(e) =>
                setRows(rows.map((r, j) => (j === i ? { ...r, station: e.target.value } : r)))
              }
            />
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("sor.tutor_window_remove")}
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setRows([...rows, { weekday: 0, start: "16:00", end: "20:00", station: "" }])
            }
          >
            <Plus className="h-4 w-4" />
            {t("sor.tutor_window_add")}
          </Button>
          <Button
            size="sm"
            disabled={save.isPending || clientErrors.length > 0}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("sor.tutor_windows_save")}
          </Button>
          {clientErrors.length > 0 && (
            <span className="text-xs text-red-600">{clientErrors[0]}</span>
          )}
        </div>

        <div className="border-t border-[color:var(--ink)]/10 pt-3">
          <p className="text-sm font-medium text-[color:var(--ink)]">
            {t("sor.tutor_blackouts_title")}
          </p>
          <ul className="mt-2 space-y-1">
            {blackoutsQuery.data?.map((b) => (
              <li key={b.id} className="flex items-center gap-2 text-sm">
                <span>{format(new Date(`${b.blackout_date}T00:00:00Z`), "d MMM yyyy")}</span>
                {b.reason && <span className="text-muted-foreground">· {b.reason}</span>}
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t("sor.tutor_blackout_remove")}
                  onClick={() => removeBlackout.mutate(b.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
            {(blackoutsQuery.data?.length ?? 0) === 0 && (
              <li className="text-sm text-muted-foreground">{t("sor.tutor_blackouts_empty")}</li>
            )}
          </ul>
          <div className="mt-2 flex items-center gap-2">
            <DatePicker
              className="w-40"
              label={t("sor.tutor_blackout_add")}
              value={isoToDate(newBlackout)}
              onChange={(d) => setNewBlackout(dateToIso(d))}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!newBlackout || addBlackout.isPending}
              onClick={() => {
                addBlackout.mutate(newBlackout);
                setNewBlackout("");
              }}
            >
              <Plus className="h-4 w-4" />
              {t("sor.tutor_blackout_add")}
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{t("sor.tutor_windows_hint")}</p>
      </div>
    </ConsolePanel>
  );
}
