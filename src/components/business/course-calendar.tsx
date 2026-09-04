import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { courseModeLabel, type CourseMode } from "@/features/courses/queries";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_CODES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export type CalendarCourse = {
  id: string;
  title: string;
  level: string | null;
  mode: CourseMode;
  session_days: string[];
  start_date: string | null;
  end_date: string | null;
};

type EventTone = "default" | "secondary" | "outline";

const TONE_ACCENT: Record<EventTone, string> = {
  default: "bg-[#1FA8B6]",
  secondary: "bg-[#0A245F]",
  outline: "bg-muted-foreground/40",
};

const MODE_TONE: Record<CourseMode, EventTone> = {
  in_person: "default",
  online: "secondary",
  either: "outline",
};

type CalendarEvent = {
  courseId: string;
  title: string;
  meta: string;
  tone: EventTone;
};

function keyFor(year: number, month: number, day: number) {
  return `${year}-${month}-${day}`;
}

function courseRunsOnDay(course: CalendarCourse, date: Date): boolean {
  if (course.session_days.length === 0) return false;
  const code = WEEKDAY_CODES[date.getDay()];
  if (!course.session_days.includes(code)) return false;
  const dayStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  if (course.start_date && dayStr < course.start_date) return false;
  if (course.end_date && dayStr > course.end_date) return false;
  return true;
}

function eventsForDay(courses: CalendarCourse[], date: Date): CalendarEvent[] {
  return courses
    .filter((course) => courseRunsOnDay(course, date))
    .map((course) => ({
      courseId: course.id,
      title: course.title,
      meta: [course.level, courseModeLabel(course.mode)].filter(Boolean).join(" · "),
      tone: MODE_TONE[course.mode] ?? "outline",
    }));
}

export function CourseCalendar({ courses }: { courses: CalendarCourse[] }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<"month" | "week">("month");
  const [selected, setSelected] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const today = new Date();

  const monthCells = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [
      ...Array(firstWeekday).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const weekDays = useMemo(() => {
    const start = new Date(cursor);
    start.setDate(cursor.getDate() - cursor.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  function shift(step: number) {
    setCursor((prev) => {
      const next = new Date(prev);
      if (view === "month") next.setMonth(prev.getMonth() + step);
      else next.setDate(prev.getDate() + step * 7);
      return next;
    });
    setSelected(null);
  }

  function isToday(date: Date) {
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  const headerLabel =
    view === "month"
      ? `${MONTH_NAMES[month]} ${year}`
      : `${MONTH_NAMES[weekDays[0].getMonth()]} ${weekDays[0].getDate()} – ${weekDays[6].getDate()}, ${weekDays[6].getFullYear()}`;

  const scheduledCount = courses.filter((course) => course.session_days.length > 0).length;

  const [, selMonth, selDay] = selected ? selected.split("-").map(Number) : [0, 0, 0];
  const selectedLabel = selected ? `${MONTH_NAMES[selMonth]} ${selDay}` : "";
  const selectedEvents = selected ? eventsForDay(courses, new Date(year, selMonth, selDay)) : [];

  return (
    <div>
      {scheduledCount === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          This business hasn't scheduled recurring class days yet — check each course for schedule
          details.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={view === "month" ? "Previous month" : "Previous week"}
                onClick={() => shift(-1)}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={view === "month" ? "Next month" : "Next week"}
                onClick={() => shift(1)}
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <h3 className="ml-1 text-base font-bold tracking-tight text-[color:var(--ink)]">
                {headerLabel}
              </h3>
            </div>

            <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
              {(["month", "week"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors",
                    view === v
                      ? "bg-card text-[color:var(--ink)] shadow-sm"
                      : "text-muted-foreground hover:text-[color:var(--ink)]",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-7 border-b border-border bg-muted/20">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {view === "month" ? (
            <div className="grid grid-cols-7">
              {monthCells.map((day, idx) => {
                const date = day ? new Date(year, month, day) : null;
                const events = date ? eventsForDay(courses, date) : [];
                const todayCell = date ? isToday(date) : false;
                const isLastRow = idx >= monthCells.length - 7;
                const isSelected = day !== null && selected === keyFor(year, month, day);

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={day === null}
                    onClick={() => day !== null && setSelected(keyFor(year, month, day))}
                    className={cn(
                      "group flex min-h-[5rem] min-w-0 flex-col gap-1 border-border p-1.5 text-left align-top transition-colors sm:min-h-[6rem]",
                      idx % 7 !== 6 && "border-r",
                      !isLastRow && "border-b",
                      day === null && "bg-muted/20",
                      day !== null && "hover:bg-accent/40",
                      isSelected && "bg-accent/60",
                    )}
                  >
                    {day !== null && (
                      <>
                        <span
                          className={cn(
                            "flex size-6 items-center justify-center self-end rounded-md text-xs font-medium",
                            todayCell ? "bg-[#1FA8B6] text-white" : "text-[color:var(--ink)]",
                          )}
                        >
                          {day}
                        </span>
                        <div className="flex min-w-0 flex-col gap-1">
                          {events.slice(0, 2).map((event) => (
                            <span
                              key={event.courseId}
                              className="flex min-w-0 items-center gap-1.5"
                            >
                              <span
                                className={cn("size-1.5 shrink-0", TONE_ACCENT[event.tone])}
                                aria-hidden="true"
                              />
                              <span className="truncate text-[10px] text-foreground/90">
                                {event.title}
                              </span>
                            </span>
                          ))}
                          {events.length > 2 && (
                            <span className="pl-3 text-[10px] font-medium text-muted-foreground">
                              +{events.length - 2} more
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {weekDays.map((d, idx) => {
                const events = eventsForDay(courses, d);
                const todayCell = isToday(d);
                const isSelected = selected === keyFor(d.getFullYear(), d.getMonth(), d.getDate());

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelected(keyFor(d.getFullYear(), d.getMonth(), d.getDate()))}
                    className={cn(
                      "flex min-h-[14rem] min-w-0 flex-col gap-2 border-border p-2 text-left transition-colors",
                      idx !== 6 && "border-r",
                      "hover:bg-accent/40",
                      isSelected && "bg-accent/60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center self-start rounded-md text-sm font-semibold",
                        todayCell ? "bg-[#1FA8B6] text-white" : "text-[color:var(--ink)]",
                      )}
                    >
                      {d.getDate()}
                    </span>
                    <div className="flex min-w-0 flex-col gap-1.5">
                      {events.map((event) => (
                        <div
                          key={event.courseId}
                          className="flex min-w-0 items-stretch gap-1.5 overflow-hidden rounded-md bg-muted/40"
                        >
                          <span
                            className={cn("w-0.5 shrink-0", TONE_ACCENT[event.tone])}
                            aria-hidden="true"
                          />
                          <div className="min-w-0 py-1 pr-1.5">
                            <p className="truncate text-xs font-medium">{event.title}</p>
                            <p className="text-[10px] text-muted-foreground">{event.meta}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selected && (
        <div className="relative mt-4 rounded-xl border border-border bg-card p-4 shadow-sm">
          <button
            type="button"
            aria-label="Close events"
            onClick={() => setSelected(null)}
            className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/50 hover:text-[color:var(--ink)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>

          <div className="flex items-center gap-2 pr-8">
            <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <h4 className="text-sm font-bold text-[color:var(--ink)]">{selectedLabel}</h4>
            <Badge variant="secondary" className="text-[10px]">
              {selectedEvents.length} {selectedEvents.length === 1 ? "class" : "classes"}
            </Badge>
          </div>

          {selectedEvents.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2">
              {selectedEvents.map((event) => (
                <li key={event.courseId}>
                  <a
                    href={`/courses/${event.courseId}`}
                    className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <span
                      className={cn("size-1.5 shrink-0", TONE_ACCENT[event.tone])}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-[color:var(--ink)]">
                      {event.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{event.meta}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No classes scheduled on this day.</p>
          )}
        </div>
      )}
    </div>
  );
}
