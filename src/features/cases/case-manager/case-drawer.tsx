import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  hktClock,
  hktDayLabel,
  nextLessonFor,
} from "@/features/cases/case-schedule";
import type {
  HubScheduleLesson,
  ScheduleCase,
} from "@/features/cases/case-schedule.functions";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import { EditLessonsDialog } from "./edit-lessons-dialog";
import { SeriesDialog } from "./series-dialog";

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

/**
 * #636 Case Detail drawer (`?case=`): masked counterparty, Next Lesson and the
 * lesson list. No phones and no fee amounts; attendance is a preview (#612).
 */
export function CaseDrawer({
  scheduleCase,
  lessons,
  onClose,
  onChanged,
}: {
  scheduleCase: ScheduleCase;
  lessons: readonly HubScheduleLesson[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [seriesOpen, setSeriesOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const now = new Date();
  const upcoming = lessons
    .filter(
      (l) =>
        l.caseId === scheduleCase.id &&
        (l.status === "planned" || l.status === "confirmed") &&
        Date.parse(l.startsAt) > now.getTime(),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const next = nextLessonFor(lessons, scheduleCase.id, now);
  const selected = upcoming.filter((l) => selectedIds.includes(l.id));
  const isTutor = scheduleCase.role === "tutor";
  const toggle = (id: string) =>
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn("overflow-y-auto", isMobile ? "max-h-[85dvh]" : "w-full sm:max-w-md")}
      >
        <SheetHeader>
          <SheetTitle>#{scheduleCase.code}</SheetTitle>
          <SheetDescription>
            {t(isTutor ? "case_manager.verified_parent" : "case_manager.verified_tutor")}
            {scheduleCase.sorStatus ? ` · ${t(`sor.status_${scheduleCase.sorStatus}`)}` : ""}
          </SheetDescription>
        </SheetHeader>

        <dl className="mt-4 space-y-2">
          <Fact label={t("case_manager.fact_subject")} value={scheduleCase.subject} />
          <Fact label={t("case_manager.fact_level")} value={scheduleCase.level} />
          <Fact
            label={t("case_manager.fact_rate")}
            value={
              scheduleCase.rateHkd === null
                ? null
                : t("case_manager.rate_value", { rate: scheduleCase.rateHkd })
            }
          />
          <Fact label={t("case_manager.fact_mode")} value={scheduleCase.mode} />
          <Fact label={t("case_manager.fact_district")} value={scheduleCase.district} />
        </dl>

        <section className="mt-5 space-y-2">
          <p className="text-sm font-semibold">
            {next
              ? t("case_manager.next_lesson", {
                  day: hktDayLabel(next.startsAt, i18n.language),
                  time: hktClock(next.startsAt),
                })
              : t("case_manager.next_lesson_flexible")}
          </p>
          {scheduleCase.paused ? (
            <p className="text-sm text-muted-foreground">{t("case_manager.paused_note")}</p>
          ) : null}
          {upcoming.length > 0 ? (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {upcoming.map((l) => (
                <li key={l.id}>
                  <label className="flex min-h-11 items-center gap-3 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(l.id)}
                      onChange={() => toggle(l.id)}
                    />
                    <span className="flex-1">
                      {hktDayLabel(l.startsAt, i18n.language)}, {hktClock(l.startsAt)}
                      <span className="text-muted-foreground">
                        {" · "}
                        {t("sor.schedule_next_minutes", { n: l.durationMin })}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {scheduleCase.canSchedule ? (
              <Button type="button" size="sm" onClick={() => setSeriesOpen(true)}>
                {t("case_manager.series_open")}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={selected.length === 0}
              onClick={() => setEditOpen(true)}
            >
              {t("case_manager.edit_open")}
            </Button>
          </div>
          {upcoming.length > 0 ? (
            <p className="text-xs text-muted-foreground">{t("case_manager.edit_select_hint")}</p>
          ) : null}
        </section>

        <section className="mt-5 rounded-xl border border-dashed border-border p-3 text-sm">
          <p className="font-semibold">{t("case_manager.attendance_title")}</p>
          <p className="text-muted-foreground">{t("case_manager.attendance_soon")}</p>
        </section>

        <div className="mt-5 flex flex-col gap-2 text-sm">
          {isTutor ? (
            <Link
              to="/dashboard"
              hash="lessons"
              className="font-semibold text-[color:var(--brand-link)] hover:underline"
            >
              {t("calendar_hub.open_tutor")}
            </Link>
          ) : (
            <Link
              to="/account/cases/$caseId"
              params={{ caseId: scheduleCase.id }}
              className="font-semibold text-[color:var(--brand-link)] hover:underline"
            >
              {t("calendar_hub.open_parent")}
            </Link>
          )}
          <Link
            to={isTutor ? "/guide/tutors" : "/guide/parents"}
            className="font-semibold text-[color:var(--brand-link)] hover:underline"
          >
            {t("case_manager.guide_link")}
          </Link>
          <p className="text-xs text-muted-foreground">{t("case_manager.independent_note")}</p>
        </div>

        {seriesOpen ? (
          <SeriesDialog
            scheduleCase={scheduleCase}
            open={seriesOpen}
            onOpenChange={setSeriesOpen}
            onDone={onChanged}
          />
        ) : null}
        {editOpen && selected.length > 0 ? (
          <EditLessonsDialog
            caseId={scheduleCase.id}
            selected={selected}
            open={editOpen}
            onOpenChange={setEditOpen}
            onDone={() => {
              setSelectedIds([]);
              onChanged();
            }}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
