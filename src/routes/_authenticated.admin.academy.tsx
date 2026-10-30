import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays } from "lucide-react";

import {
  ConsoleTable,
  ConsoleTableBody,
  ConsoleTableEmpty,
  ConsoleTableHead,
  ConsoleTableSkeletonRows,
  ConsoleTd,
  ConsoleTh,
} from "@/components/ui/console-table";
import { useAuth } from "@/features/auth/useAuth";
import { getAcademyCalendar, type CalendarLesson } from "@/features/academy/managed.functions";

export const Route = createFileRoute("/_authenticated/admin/academy")({
  head: () => ({
    meta: [
      { title: "Academy calendar, MatchMax Admin" },
      {
        name: "description",
        content: "Master lesson calendar across tutors with attendance and occupancy.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAcademy,
});

const ATTENDANCE_LABEL: Record<string, string> = {
  present: "Present",
  late: "Late",
  left_early: "Left early",
  absent_excused: "Absent, excused",
  absent_billable: "Absent, billable",
};

const dayKey = (iso: string) =>
  new Date(iso).toLocaleDateString("en-HK", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Hong_Kong",
  });
const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-HK", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Hong_Kong",
  });

function LessonRow({ l }: { l: CalendarLesson }) {
  return (
    <tr>
      <ConsoleTd className="whitespace-nowrap text-xs">
        {timeOf(l.startsAt)} · {l.durationMin}m
      </ConsoleTd>
      <ConsoleTd className="text-xs">
        {l.caseCode ? (
          <Link
            to="/admin/cases"
            search={{ q: l.caseCode }}
            className="font-semibold underline-offset-2 hover:underline"
          >
            {l.caseCode}
          </Link>
        ) : (
          "—"
        )}
        {l.managed ? (
          <span className="ml-2 rounded-full bg-[color:var(--primary)]/[0.1] px-2 py-0.5 text-[11px] font-semibold">
            Managed
          </span>
        ) : null}
      </ConsoleTd>
      <ConsoleTd className="text-xs text-muted-foreground">{l.tutorName ?? "—"}</ConsoleTd>
      <ConsoleTd className="text-xs text-muted-foreground">
        {l.attendance ? (ATTENDANCE_LABEL[l.attendance] ?? l.attendance) : l.status}
      </ConsoleTd>
    </tr>
  );
}

/**
 * Issue #533 admin master calendar: every lesson in the window (all tutors,
 * pure matching and Managed), plus each tutor's occupancy of their own
 * weekly windows. Attendance is marked on the case page (Managed panel) or by
 * the tutor; this view only reads. Extends the #461 calendar, no second store.
 */
function AdminAcademy() {
  const { user } = useAuth();
  const [days, setDays] = useState(7);
  const query = useQuery({
    queryKey: ["admin", "academy-calendar", days],
    queryFn: () => getAcademyCalendar({ data: { days } }),
    enabled: Boolean(user),
  });
  const lessons = query.data?.lessons ?? [];
  const occupancy = query.data?.occupancy ?? [];
  const byDay = lessons.reduce<Map<string, CalendarLesson[]>>((map, l) => {
    const key = dayKey(l.startsAt);
    return new Map(map).set(key, [...(map.get(key) ?? []), l]);
  }, new Map());

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Academy calendar</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            All lessons from yesterday onward. Occupancy is booked time over each tutor's weekly
            windows.
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="h-9 rounded-xl border border-input bg-transparent px-2 text-sm"
          aria-label="Days ahead"
        >
          <option value={7}>Next 7 days</option>
          <option value={14}>Next 14 days</option>
        </select>
      </div>

      {occupancy.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {occupancy.map((o) => (
            <span
              key={o.tutorId}
              className="rounded-full border border-border px-3 py-1 text-xs text-[color:var(--ink)]"
            >
              {o.tutorName ?? "Tutor"} · {o.pct}%
            </span>
          ))}
        </div>
      ) : null}

      <ConsoleTable>
        <ConsoleTableHead>
          <tr>
            <ConsoleTh>Time</ConsoleTh>
            <ConsoleTh>Case</ConsoleTh>
            <ConsoleTh>Tutor</ConsoleTh>
            <ConsoleTh>Attendance</ConsoleTh>
          </tr>
        </ConsoleTableHead>
        <ConsoleTableBody>
          {query.isLoading ? (
            <ConsoleTableSkeletonRows rows={5} columns={4} />
          ) : lessons.length === 0 ? (
            <ConsoleTableEmpty colSpan={4} icon={CalendarDays} title="No lessons in this window" />
          ) : (
            [...byDay.entries()].flatMap(([day, rows]) => [
              <tr key={day}>
                <ConsoleTd
                  colSpan={4}
                  className="bg-[color:var(--surface-subtle)] text-xs font-semibold"
                >
                  {day}
                </ConsoleTd>
              </tr>,
              ...rows.map((l) => <LessonRow key={l.id} l={l} />),
            ])
          )}
        </ConsoleTableBody>
      </ConsoleTable>
    </div>
  );
}
