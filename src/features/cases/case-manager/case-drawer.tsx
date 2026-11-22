import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { hktClock, hktDayLabel, nextLessonFor } from "@/features/cases/case-schedule";
import type { CaseTab } from "@/features/cases/case-schedule";
import type { HubScheduleLesson, ScheduleCase } from "@/features/cases/case-schedule.functions";
import { setLessonPrep } from "@/features/cases/case-schedule.functions";
import { useAuth } from "@/features/auth/useAuth";
import { fetchCaseChildAvailability } from "@/features/cases/child-availability.functions";
import { UsefulnessPulseCard } from "@/features/cases/usefulness-pulse-card";
import { DemandSidePanel } from "@/features/cases/demand-side/demand-side-panel";
import { emptyHourlyOpenHours, isHourlyGridEmpty } from "@/features/tutors/availability-grid-model";
import { AvailabilityHourlyGrid } from "@/features/tutors/availability-hourly-grid";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import { BillingTab } from "./billing-tab";
import { EditLessonsDialog } from "./edit-lessons-dialog";
import { HeatmapSection } from "./heatmap-section";
import { HomeworkTab } from "./homework-tab";
import { LessonLogSection } from "./lesson-log-section";
import { MistakeBookSection } from "./mistake-book-tab";
import { NotesRail } from "./notes-rail";
import { ProgressTab } from "./progress-tab";
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
 * #768: the student's weekly Open hours, visible inside the case only while the
 * matched tutor is on an active lead. The server decides who may read it; a
 * refusal (null) renders nothing at all, so the block never hints at a child
 * outside the caller's case.
 */
function ChildAvailability({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ["case-child-availability", caseId],
    queryFn: () => fetchCaseChildAvailability({ data: { caseId } }),
  });
  if (!data) return null;

  return (
    <section className="mt-5 rounded-xl border border-border p-3">
      <p className="text-sm font-medium text-muted-foreground">
        {t("case_manager.child_availability.title")}
        {data.displayName ? ` · ${data.displayName}` : ""}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("case_manager.child_availability.hint")}
      </p>
      {isHourlyGridEmpty(data.openHours) ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {t("case_manager.child_availability.none")}
        </p>
      ) : (
        <div className="mt-3">
          <AvailabilityHourlyGrid
            openHours={data.openHours}
            occupiedHours={emptyHourlyOpenHours()}
            allowPrefill={false}
          />
        </div>
      )}
    </section>
  );
}

/**
 * #785 AC-735-2a: the next lesson's topic and prep note. The tutor (or Ops)
 * writes it while the lesson is still upcoming; the parent and the learner
 * read it. Flat inline block, no card, no modal.
 */
function NextLessonPrep({
  caseId,
  lesson,
  canEdit,
  onSaved,
}: {
  caseId: string;
  lesson: HubScheduleLesson;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [topic, setTopic] = useState(lesson.lessonTopic ?? "");
  const [note, setNote] = useState(lesson.prepNote ?? "");
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: () =>
      setLessonPrep({
        data: {
          caseId,
          lessonId: lesson.id,
          topic: topic.trim() ? topic : null,
          note: note.trim() ? note : null,
        },
      }),
    onSuccess: () => {
      setSaved(true);
      onSaved();
    },
  });

  if (!canEdit) {
    if (!lesson.lessonTopic && !lesson.prepNote) {
      return <p className="text-xs text-muted-foreground">{t("case_manager.prep_empty")}</p>;
    }
    return (
      <div className="space-y-1">
        {lesson.lessonTopic ? (
          <p className="line-clamp-2 text-sm font-medium">{lesson.lessonTopic}</p>
        ) : null}
        {lesson.prepNote ? (
          <p className="line-clamp-3 text-xs text-muted-foreground">{lesson.prepNote}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">{t("case_manager.prep_readonly_hint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{t("case_manager.prep_title")}</p>
      <label className="block space-y-1 text-xs text-muted-foreground">
        <span>{t("case_manager.prep_topic_label")}</span>
        <Input
          className="h-9"
          value={topic}
          maxLength={80}
          placeholder={t("case_manager.prep_placeholder_topic")}
          onChange={(event) => {
            setTopic(event.target.value);
            setSaved(false);
          }}
        />
      </label>
      <label className="block space-y-1 text-xs text-muted-foreground">
        <span>{t("case_manager.prep_note_label")}</span>
        <Input
          className="h-9"
          value={note}
          maxLength={500}
          placeholder={t("case_manager.prep_placeholder_note")}
          onChange={(event) => {
            setNote(event.target.value);
            setSaved(false);
          }}
        />
      </label>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
          {t("case_manager.prep_save")}
        </Button>
        {saved ? (
          <span className="text-xs text-muted-foreground">{t("case_manager.prep_saved")}</span>
        ) : null}
      </div>
      {save.isError ? (
        <p className="text-xs text-destructive">{t("case_manager.prep_error")}</p>
      ) : null}
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
  tab,
  onTabChange,
  onClose,
  onChanged,
}: {
  scheduleCase: ScheduleCase;
  lessons: readonly HubScheduleLesson[];
  tab: CaseTab;
  onTabChange: (tab: CaseTab) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { hasAnyRole } = useAuth();
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
  const nextBase = nextLessonFor(lessons, scheduleCase.id, now);
  // Re-read the row so the banner also carries the #785 topic / prep note.
  const next = nextBase ? (lessons.find((l) => l.id === nextBase.id) ?? null) : null;
  const selected = upcoming.filter((l) => selectedIds.includes(l.id));
  const isTutor = scheduleCase.role === "tutor";
  const isOps = hasAnyRole(["staff", "admin", "super_admin"]);
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

        <Tabs value={tab} onValueChange={(value) => onTabChange(value as CaseTab)} className="mt-4">
          <TabsList className="max-w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">{t("homework.tab_overview")}</TabsTrigger>
            <TabsTrigger value="homework">{t("homework.tab")}</TabsTrigger>
            <TabsTrigger value="progress">{t("progress.tab")}</TabsTrigger>
            {/* #796 §2.2: the Mistake Book sits beside the progress/heatmap surface. */}
            <TabsTrigger value="mistakes">{t("mistakes.tab")}</TabsTrigger>
            <TabsTrigger value="schedule">{t("billing.tab")}</TabsTrigger>
          </TabsList>
          <TabsContent value="homework">
            <HomeworkTab caseId={scheduleCase.id} />
          </TabsContent>
          <TabsContent value="progress">
            {/* #796 §2.1: syllabus mastery sits above the grade chart; the
                server returns null (and this renders nothing) for non-parties. */}
            <HeatmapSection caseId={scheduleCase.id} />
            {/* #796 §2.3: practice material seeded from the case's lesson topics.
                Renders nothing for the tutor side or when there is nothing to show. */}
            <NotesRail caseId={scheduleCase.id} />
            {/* #796 §2.5: the lesson log feed sits under the mastery heatmap and
                above the grade chart; it renders nothing for non-parties. */}
            <LessonLogSection caseId={scheduleCase.id} />
            <ProgressTab caseId={scheduleCase.id} />
          </TabsContent>
          <TabsContent value="mistakes">
            <MistakeBookSection caseId={scheduleCase.id} />
          </TabsContent>
          <TabsContent value="schedule">
            <BillingTab caseId={scheduleCase.id} onScheduleChanged={onChanged} />
          </TabsContent>
          <TabsContent value="overview">
            {/* #796 §2.4: a due pulse leads the overview for the learner side;
                the tutor sees nothing, and the card hides itself when not due. */}
            {scheduleCase.role === "parent" ? (
              <UsefulnessPulseCard caseId={scheduleCase.id} />
            ) : null}

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

            {/* #768: the child's weekly Open hours, shared by the parent for
                this active case only. */}
            <ChildAvailability caseId={scheduleCase.id} />

            {/* #785 AC-637-1: Household Briefing / Learning Goals belongs in the
                case drawer, not one click away. The panel hides itself for a
                caller who is not a party, so no extra gate is needed here. */}
            <div className="mt-5">
              <DemandSidePanel caseId={scheduleCase.id} />
            </div>

            <section className="mt-5 space-y-2">
              <p className="text-sm font-semibold">
                {next
                  ? t("case_manager.next_lesson", {
                      day: hktDayLabel(next.startsAt, i18n.language),
                      time: hktClock(next.startsAt),
                    })
                  : t("case_manager.next_lesson_flexible")}
              </p>
              {next ? (
                <NextLessonPrep
                  key={next.id}
                  caseId={scheduleCase.id}
                  lesson={next}
                  canEdit={isTutor || isOps}
                  onSaved={onChanged}
                />
              ) : null}
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
                <p className="text-xs text-muted-foreground">
                  {t("case_manager.edit_select_hint")}
                </p>
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
          </TabsContent>
        </Tabs>

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
