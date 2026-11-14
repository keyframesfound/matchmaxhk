import { useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Clock,
  Loader2,
  Mic,
  Minus,
  NotebookPen,
  Paperclip,
  Plus,
  Rocket,
  Target,
  Activity,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatExperienceHours } from "@/features/tutors/experience";
import {
  DEFAULT_PULSE,
  DRAWER_DURATION_MAX,
  DRAWER_DURATION_MIN,
  stepDurationMin,
  type DrawerTopic,
  type MasteryLevel,
} from "@/features/cases/super-drawer/super-drawer-logic";
import {
  completeSuperDrawerLog,
  getSuperDrawerContext,
  syncSuperDrawerLog,
} from "@/features/cases/super-drawer/super-drawer.functions";
import { cn } from "@/lib/utils";

const MASTERY_PILLS: { value: MasteryLevel; key: string; dot: string; text: string }[] = [
  {
    value: "weak",
    key: "super_drawer.mastery_weak",
    dot: "bg-destructive",
    text: "text-destructive",
  },
  {
    value: "practicing",
    key: "super_drawer.mastery_practicing",
    dot: "bg-blue-500",
    text: "text-blue-600 dark:text-blue-400",
  },
  {
    value: "mastered",
    key: "super_drawer.mastery_mastered",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
  },
];

function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
      {icon}
      {children}
    </h3>
  );
}

function Pill({
  selected,
  onClick,
  children,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "min-h-9 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-transparent bg-primary text-primary-foreground"
          : "bg-transparent text-muted-foreground hover:bg-muted",
      )}
    >
      {selected ? "✓ " : ""}
      {children}
    </button>
  );
}

/**
 * #767 Super-Drawer — the ONE tutor post-lesson write surface (390px-first
 * bottom sheet; right sheet on desktop). Wave-1 path: defaults + 1 tag +
 * pulse confirm + Sync ≈15s. The sticky footer keeps the permanent
 * Log Hours Only / 只記錄時數 escape hatch visible; it never blocks.
 */
export function SuperDrawer({
  caseId,
  caseCode,
  studentName,
  subject,
  /** Set by the [ Add Recap & Tags ] badge → completion mode (duration locked). */
  completeLessonId,
  onClose,
  onSaved,
}: {
  caseId: string;
  caseCode: string;
  studentName: string | null;
  subject: string | null;
  completeLessonId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const completeMode = Boolean(completeLessonId);
  // Stable per drawer session: a retry/double-tap reuses the SAME key.
  const clientRequestId = useRef<string>(crypto.randomUUID());

  const { data: ctx, isLoading } = useQuery({
    queryKey: ["super-drawer", "context", caseId],
    queryFn: () => getSuperDrawerContext({ data: { caseId } }),
  });

  const [durationMin, setDurationMin] = useState<number | null>(null);
  const duration = durationMin ?? ctx?.defaultDurationMin ?? 60;
  const [selected, setSelected] = useState<DrawerTopic[]>([]);
  const [pulse, setPulse] = useState(DEFAULT_PULSE);
  const [recap, setRecap] = useState("");
  const [nextLesson, setNextLesson] = useState<string>("");
  const [homework, setHomework] = useState("");
  const [newTopic, setNewTopic] = useState("");

  const addTopic = (tag: string, mastery: MasteryLevel | null = null) => {
    const clean = tag.trim().replace(/^#/, "").trim();
    if (!clean) return;
    setSelected((prev) =>
      prev.some((p) => p.tag.toLowerCase() === clean.toLowerCase())
        ? prev
        : [...prev, { tag: clean, mastery }],
    );
  };

  const toggleSuggested = (tag: string) => {
    setSelected((prev) => {
      if (prev.some((p) => p.tag.toLowerCase() === tag.toLowerCase())) {
        return prev.filter((p) => p.tag.toLowerCase() !== tag.toLowerCase());
      }
      const suggested = ctx?.suggestedTopics.find((s) => s.tag.toLowerCase() === tag.toLowerCase());
      return [...prev, { tag, mastery: suggested?.mastery ?? null }];
    });
  };

  const invalidate = () => {
    onSaved();
    void queryClient.invalidateQueries({ queryKey: ["sor", "tutor-cases"] });
    void queryClient.invalidateQueries({ queryKey: ["super-drawer", "pending"] });
  };

  const sync = useMutation({
    mutationFn: (mode: "full" | "hours_only") =>
      syncSuperDrawerLog({
        data: {
          caseId,
          clientRequestId: clientRequestId.current,
          mode,
          durationMin: duration,
          topics: mode === "full" ? selected : [],
          pulse,
          recap: mode === "full" && recap.trim() ? recap.trim() : undefined,
          nextLessonAtIso:
            mode === "full" && nextLesson ? new Date(nextLesson).toISOString() : undefined,
          homework: mode === "full" && homework.trim() ? { title: homework.trim() } : undefined,
        },
      }),
    onSuccess: (res, mode) => {
      toast.success(
        t(mode === "hours_only" ? "super_drawer.hours_saved" : "super_drawer.log_success"),
      );
      invalidate();
      onClose();
    },
    onError: (e: Error) =>
      toast.error(t(`super_drawer.err_${e.message}`, { defaultValue: e.message })),
  });

  const complete = useMutation({
    mutationFn: () =>
      completeSuperDrawerLog({
        data: {
          lessonId: completeLessonId ?? "",
          topics: selected,
          pulse,
          recap: recap.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success(t("super_drawer.log_success"));
      invalidate();
      onClose();
    },
    onError: (e: Error) =>
      toast.error(t(`super_drawer.err_${e.message}`, { defaultValue: e.message })),
  });

  const pending = sync.isPending || complete.isPending || isLoading;
  const tagRequired = !completeMode && selected.length === 0;

  const nextLessonValue = useMemo(() => {
    if (nextLesson) return nextLesson;
    const iso = ctx?.nextLessonDefaultIso;
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [nextLesson, ctx?.nextLessonDefaultIso]);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="flex h-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border p-4 pb-3">
          <SheetTitle className="text-base">
            {t(completeMode ? "super_drawer.complete_title" : "super_drawer.title")}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {t("super_drawer.case_line", {
              code: caseCode,
              student: studentName ?? "",
              detail: subject ?? "",
            })}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 pb-2">
          {completeMode ? (
            <p className="rounded-lg border border-border p-2.5 text-xs text-muted-foreground">
              {t("super_drawer.duration_locked")}
            </p>
          ) : (
            <section aria-label={t("super_drawer.duration_title")}>
              <SectionTitle icon={<Clock className="h-4 w-4" aria-hidden="true" />}>
                {t("super_drawer.duration_title")}
              </SectionTitle>
              <div className="mt-2 flex items-center justify-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="−"
                  disabled={pending || duration <= DRAWER_DURATION_MIN}
                  onClick={() => setDurationMin(stepDurationMin(duration, -1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="min-w-24 text-center text-lg font-semibold text-foreground">
                  {t("experience.duration_hours", {
                    hours: formatExperienceHours(duration / 60),
                  })}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="+"
                  disabled={pending || duration >= DRAWER_DURATION_MAX}
                  onClick={() => setDurationMin(stepDurationMin(duration, 1))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </section>
          )}

          <section aria-label={t("super_drawer.topics_title")}>
            <SectionTitle icon={<Target className="h-4 w-4" aria-hidden="true" />}>
              {t("super_drawer.topics_title")}
            </SectionTitle>
            <p className="mt-1 text-xs text-muted-foreground">{t("super_drawer.topics_hint")}</p>
            {(ctx?.suggestedTopics.length ?? 0) > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {ctx?.suggestedTopics.map((s) => {
                  const isSelected = selected.some(
                    (p) => p.tag.toLowerCase() === s.tag.toLowerCase(),
                  );
                  return (
                    <Pill
                      key={s.tag}
                      selected={isSelected}
                      disabled={pending}
                      onClick={() => toggleSuggested(s.tag)}
                    >
                      #{s.tag}
                    </Pill>
                  );
                })}
              </div>
            )}
            <div className="mt-2 space-y-2">
              {selected.map((topic) => (
                <div
                  key={topic.tag}
                  className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border p-2"
                >
                  <span className="mr-1 text-xs font-semibold text-foreground">#{topic.tag}</span>
                  {MASTERY_PILLS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        setSelected((prev) =>
                          prev.map((p) =>
                            p.tag.toLowerCase() === topic.tag.toLowerCase()
                              ? {
                                  ...p,
                                  mastery: p.mastery === m.value ? null : m.value,
                                }
                              : p,
                          ),
                        )
                      }
                      className={cn(
                        "inline-flex min-h-8 items-center gap-1 rounded-full border border-border px-2 py-1 text-[11px] font-medium",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        topic.mastery === m.value ? `bg-muted ${m.text}` : "text-muted-foreground",
                      )}
                    >
                      <span className={cn("h-2 w-2 rounded-full", m.dot)} aria-hidden="true" />
                      {t(m.key)}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Input
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                placeholder={t("super_drawer.topic_add_ph")}
                className="h-9 flex-1 text-sm"
                maxLength={60}
                disabled={pending}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTopic(newTopic);
                    setNewTopic("");
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || !newTopic.trim()}
                onClick={() => {
                  addTopic(newTopic);
                  setNewTopic("");
                }}
              >
                <Plus className="h-4 w-4" />
                {t("super_drawer.topic_add")}
              </Button>
            </div>
          </section>

          <section aria-label={t("super_drawer.pulse_title")}>
            <SectionTitle icon={<Activity className="h-4 w-4" aria-hidden="true" />}>
              {t("super_drawer.pulse_title")}
            </SectionTitle>
            <p className="mt-1 text-xs text-muted-foreground">{t("super_drawer.pulse_private")}</p>
            <div className="mt-2 space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {t("super_drawer.pulse_punctuality")}
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {(["on_time", "late"] as const).map((v) => (
                    <Pill
                      key={v}
                      selected={pulse.punctuality === v}
                      disabled={pending}
                      onClick={() => setPulse((p) => ({ ...p, punctuality: v }))}
                    >
                      {t(`super_drawer.pulse_${v}`)}
                    </Pill>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {t("super_drawer.pulse_focus")}
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {(["attentive", "good", "distracted"] as const).map((v) => (
                    <Pill
                      key={v}
                      selected={pulse.focus === v}
                      disabled={pending}
                      onClick={() => setPulse((p) => ({ ...p, focus: v }))}
                    >
                      {t(`super_drawer.pulse_${v}`)}
                    </Pill>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {t("super_drawer.pulse_prep")}
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {(["prepared", "partial", "none"] as const).map((v) => (
                    <Pill
                      key={v}
                      selected={pulse.prepHw === v}
                      disabled={pending}
                      onClick={() => setPulse((p) => ({ ...p, prepHw: v }))}
                    >
                      {t(`super_drawer.pulse_${v}`)}
                    </Pill>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section aria-label={t("super_drawer.recap_title")}>
            <SectionTitle icon={<NotebookPen className="h-4 w-4" aria-hidden="true" />}>
              {t("super_drawer.recap_title")}
            </SectionTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("super_drawer.covered_label")}:{" "}
              {selected.length > 0
                ? selected.map((s) => `#${s.tag}`).join(", ")
                : t("super_drawer.covered_none")}
            </p>
            <Textarea
              value={recap}
              onChange={(e) => setRecap(e.target.value)}
              placeholder={t("super_drawer.recap_ph")}
              rows={3}
              maxLength={2000}
              disabled={pending}
              className="mt-2 text-sm"
            />
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Mic className="h-3 w-3" aria-hidden="true" />
              {t("super_drawer.recap_dictation_hint")}
            </p>
            {!completeMode && (
              <label className="mt-3 block text-xs font-medium text-muted-foreground">
                {t("super_drawer.next_label")}
                <Input
                  type="datetime-local"
                  value={nextLessonValue}
                  onChange={(e) => setNextLesson(e.target.value)}
                  disabled={pending}
                  className="mt-1 h-9 text-sm"
                />
              </label>
            )}
            {!completeMode && (
              <label className="mt-3 block text-xs font-medium text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Paperclip className="h-3 w-3" aria-hidden="true" />
                  {t("super_drawer.hw_label")}
                </span>
                <Input
                  value={homework}
                  onChange={(e) => setHomework(e.target.value)}
                  placeholder={t("super_drawer.hw_ph")}
                  maxLength={120}
                  disabled={pending}
                  className="mt-1 h-9 text-sm"
                />
              </label>
            )}
          </section>
        </div>

        <div className="space-y-2 border-t border-border bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {completeMode ? (
            <Button
              type="button"
              className="w-full"
              disabled={pending || selected.length === 0}
              onClick={() => complete.mutate()}
            >
              {complete.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("super_drawer.complete_save")}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                className="w-full"
                disabled={pending || tagRequired}
                onClick={() => sync.mutate("full")}
              >
                {sync.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                {t("super_drawer.sync")}
              </Button>
              {tagRequired ? (
                <p className="text-center text-[11px] text-muted-foreground">
                  {t("super_drawer.tag_required")}
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={pending}
                onClick={() => sync.mutate("hours_only")}
              >
                {t("super_drawer.hours_only")}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
