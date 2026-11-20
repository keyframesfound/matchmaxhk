import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, EyeOff, ImagePlus, Loader2, PencilLine, Plus, Target, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MISTAKE_ERROR_REASONS,
  MISTAKE_SOURCE_MAX,
  MISTAKE_TAG_MAX,
  MISTAKE_TEXT_MAX,
  MISTAKE_TIP_MAX,
  MISTAKE_TITLE_MAX,
  mistakeImageCapMb,
  mistakeImageError,
  nextMistakeStatus,
  type MistakeErrorReason,
  type MistakeStatus,
} from "@/features/cases/mistake-book";
import {
  addCaseMistake,
  getCaseMistakeBook,
  saveCaseMistakeTip,
  setCaseMistakeStatus,
  type MistakeBookState,
  type MistakeItem,
} from "@/features/cases/mistake-book.functions";
import { cn } from "@/lib/utils";

function useMistakeErrorToast() {
  const { t } = useTranslation();
  return (e: Error) =>
    toast.error(
      t(`mistakes.err_${e.message}`, {
        mb: mistakeImageCapMb(),
        defaultValue: t("mistakes.err_gen"),
      }),
    );
}

const STATUS_CLASS: Record<MistakeStatus, string> = {
  unresolved:
    "border-[color:var(--destructive)]/40 bg-[color:var(--destructive)]/10 text-destructive",
  practiced_once:
    "border-[color:var(--warning)]/50 bg-[color:var(--warning)]/15 text-[color:var(--ink)]",
  mastered:
    "border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]",
};

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("IMAGE_TYPE"));
    reader.readAsDataURL(file);
  });
}

type ImageSlot = "question" | "solution";

type PickedImage = {
  filename: string;
  contentType: string;
  size: number;
  content: string;
  preview: string;
};

function ImagePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PickedImage | null;
  onChange: (next: PickedImage | null) => void;
}) {
  const { t } = useTranslation();
  const onError = useMistakeErrorToast();

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const failure = mistakeImageError({ contentType: file.type, size: file.size });
    if (failure) {
      onError(new Error(failure));
      return;
    }
    try {
      const content = await readFileAsBase64(file);
      onChange({
        filename: file.name,
        contentType: file.type,
        size: file.size,
        content,
        preview: `data:${file.type};base64,${content}`,
      });
    } catch (e) {
      onError(e instanceof Error ? e : new Error("IMAGE_TYPE"));
    }
  };

  return (
    <div className="grid gap-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <div className="flex items-center gap-3">
        {value ? (
          <img
            src={value.preview}
            alt={label}
            className="h-16 w-16 rounded-lg border border-border object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border">
            <ImagePlus className="h-5 w-5 text-muted-foreground" aria-hidden />
          </span>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex min-h-9 cursor-pointer items-center rounded-full border border-border px-3 text-xs font-medium text-[color:var(--ink)] hover:bg-[color:var(--surface-subtle)]">
            {t("mistakes.image_pick")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                void pick(file);
              }}
            />
          </label>
          {value ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
              <X className="h-4 w-4" aria-hidden />
              {t("mistakes.image_remove")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AddMistakeDialog({
  caseId,
  tags,
  onOpenChange,
  onDone,
}: {
  caseId: string;
  tags: string[];
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const onError = useMistakeErrorToast();
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [tag, setTag] = useState("");
  const [reason, setReason] = useState<MistakeErrorReason | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [solutionText, setSolutionText] = useState("");
  const [images, setImages] = useState<Record<ImageSlot, PickedImage | null>>({
    question: null,
    solution: null,
  });

  const save = useMutation({
    mutationFn: () =>
      addCaseMistake({
        data: {
          caseId,
          title: title.trim(),
          source: source.trim() || undefined,
          topicTag: tag.trim() || undefined,
          errorReason: reason ?? "concept_gap",
          questionText: questionText.trim() || undefined,
          solutionText: solutionText.trim() || undefined,
          questionImage: images.question
            ? {
                filename: images.question.filename,
                contentType: images.question.contentType,
                size: images.question.size,
                content: images.question.content,
              }
            : undefined,
          solutionImage: images.solution
            ? {
                filename: images.solution.filename,
                contentType: images.solution.contentType,
                size: images.solution.size,
                content: images.solution.content,
              }
            : undefined,
        },
      }),
    onSuccess: () => {
      toast.success(t("mistakes.saved"));
      onOpenChange(false);
      onDone();
    },
    onError,
  });

  const canSubmit =
    title.trim().length > 0 &&
    reason !== null &&
    (questionText.trim().length > 0 || images.question);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("mistakes.add_title")}</DialogTitle>
          <DialogDescription>{t("mistakes.add_hint")}</DialogDescription>
        </DialogHeader>

        {/* Locked copyright reminder — verbatim from #796 §2.2. */}
        <p className="rounded-lg border border-border bg-[color:var(--surface-subtle)] p-3 text-xs text-muted-foreground">
          {t("mistakes.copyright")}
        </p>

        <label className="grid gap-1 text-xs text-muted-foreground">
          {t("mistakes.field_title")}
          <Input
            value={title}
            maxLength={MISTAKE_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("mistakes.field_source")}
            <Input
              value={source}
              maxLength={MISTAKE_SOURCE_MAX}
              placeholder={t("mistakes.field_source_hint")}
              onChange={(e) => setSource(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("mistakes.field_tag")}
            <Input
              value={tag}
              maxLength={MISTAKE_TAG_MAX}
              list="mistake-book-tags"
              placeholder={t("mistakes.field_tag_hint")}
              onChange={(e) => setTag(e.target.value)}
            />
            <datalist id="mistake-book-tags">
              {tags.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </label>
        </div>

        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 8).map((value) => {
              const active = tag.trim().toLowerCase() === value.toLowerCase();
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTag(active ? "" : value)}
                  className={cn(
                    "min-h-8 rounded-full border px-2.5 text-xs",
                    active
                      ? "border-[color:var(--ink)]/40 bg-[color:var(--foreground)]/[0.08] text-[color:var(--ink)]"
                      : "border-border text-muted-foreground",
                  )}
                >
                  #{value}
                </button>
              );
            })}
          </div>
        ) : null}

        <fieldset className="grid gap-1.5">
          <legend className="text-xs text-muted-foreground">{t("mistakes.field_reason")}</legend>
          <div
            className="flex flex-wrap gap-1.5"
            role="radiogroup"
            aria-label={t("mistakes.field_reason")}
          >
            {MISTAKE_ERROR_REASONS.map((value) => {
              const active = reason === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setReason(value)}
                  className={cn(
                    "min-h-9 rounded-full border px-3 text-xs font-medium",
                    active
                      ? "border-[color:var(--ink)]/50 bg-[color:var(--foreground)]/[0.08] text-[color:var(--ink)]"
                      : "border-border text-muted-foreground hover:bg-[color:var(--surface-subtle)]",
                  )}
                >
                  {t(`mistakes.reason_${value}`)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="grid gap-1 text-xs text-muted-foreground">
          {t("mistakes.field_question")}
          <Textarea
            value={questionText}
            rows={3}
            maxLength={MISTAKE_TEXT_MAX}
            onChange={(e) => setQuestionText(e.target.value)}
          />
        </label>

        <ImagePicker
          label={t("mistakes.field_question_image")}
          value={images.question}
          onChange={(next) => setImages((prev) => ({ ...prev, question: next }))}
        />

        <label className="grid gap-1 text-xs text-muted-foreground">
          {t("mistakes.field_solution")}
          <Textarea
            value={solutionText}
            rows={2}
            maxLength={MISTAKE_TEXT_MAX}
            onChange={(e) => setSolutionText(e.target.value)}
          />
        </label>

        <ImagePicker
          label={t("mistakes.field_solution_image")}
          value={images.solution}
          onChange={(next) => setImages((prev) => ({ ...prev, solution: next }))}
        />

        <p className="text-[11px] text-muted-foreground">
          {t("mistakes.image_hint", { mb: mistakeImageCapMb() })}
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("mistakes.cancel")}
          </Button>
          <Button disabled={!canSubmit || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {t("mistakes.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TipEditor({
  caseId,
  item,
  onDone,
}: {
  caseId: string;
  item: MistakeItem;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const onError = useMistakeErrorToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(item.tutorTipText ?? "");
  const save = useMutation({
    mutationFn: () =>
      saveCaseMistakeTip({ data: { caseId, mistakeId: item.id, tipText: text.trim() } }),
    onSuccess: () => {
      toast.success(t("mistakes.tip_saved"));
      setOpen(false);
      onDone();
    },
    onError,
  });

  if (!open) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <PencilLine className="h-4 w-4" aria-hidden />
        {item.tutorTipText ? t("mistakes.tip_edit") : t("mistakes.tip_add")}
      </Button>
    );
  }

  return (
    <div className="mt-1 grid gap-2">
      <Textarea
        value={text}
        rows={2}
        maxLength={MISTAKE_TIP_MAX}
        placeholder={t("mistakes.tip_placeholder")}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {t("mistakes.cancel")}
        </Button>
        <Button type="button" size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {t("mistakes.tip_save")}
        </Button>
      </div>
    </div>
  );
}

function MistakeCard({
  caseId,
  item,
  role,
  revealMode,
  revealed,
  onToggleReveal,
  onChanged,
}: {
  caseId: string;
  item: MistakeItem;
  role: MistakeBookState["role"];
  revealMode: boolean;
  revealed: boolean;
  onToggleReveal: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const onError = useMistakeErrorToast();
  const showSolution = !revealMode || revealed;
  const next = nextMistakeStatus(item.status);

  const advance = useMutation({
    mutationFn: (status: MistakeStatus) =>
      setCaseMistakeStatus({ data: { caseId, mistakeId: item.id, status } }),
    onSuccess: () => {
      toast.success(t("mistakes.status_updated"));
      onChanged();
    },
    onError,
  });

  return (
    <li className="rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-[color:var(--ink)]">{item.title}</span>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px] font-medium",
            STATUS_CLASS[item.status],
          )}
        >
          {t(`mistakes.status_${item.status}`)}
        </span>
        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
          {t(`mistakes.reason_${item.errorReason}`)}
        </span>
        {item.topicTag ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
            #{item.topicTag}
          </span>
        ) : null}
        {item.fromEarlierCase ? (
          <span className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground">
            {t("mistakes.later_case_badge")}
          </span>
        ) : null}
      </div>

      {item.source ? <p className="mt-1 text-xs text-muted-foreground">{item.source}</p> : null}

      {item.questionText ? (
        <p className="mt-2 whitespace-pre-wrap text-sm text-[color:var(--ink)]">
          {item.questionText}
        </p>
      ) : null}
      {item.questionImageUrl ? (
        <a href={item.questionImageUrl} target="_blank" rel="noreferrer">
          <img
            src={item.questionImageUrl}
            alt={t("mistakes.field_question_image")}
            className="mt-2 max-h-64 w-full rounded-lg border border-border object-contain"
          />
        </a>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {revealMode ? (
          <Button type="button" size="sm" variant="outline" onClick={onToggleReveal}>
            {revealed ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
            {revealed ? t("mistakes.hide_solution") : t("mistakes.reveal_solution")}
          </Button>
        ) : null}
        {item.canEdit && next ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={advance.isPending}
            onClick={() => advance.mutate(next)}
          >
            {advance.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : next === "mastered" ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              <Target className="h-4 w-4" aria-hidden />
            )}
            {t(`mistakes.mark_${next}`)}
          </Button>
        ) : null}
        {/* Tutors and Ops may reopen a mastered item; learners only move forward. */}
        {item.canEdit && role !== "learner" && item.status !== "unresolved" ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={advance.isPending}
            onClick={() => advance.mutate("unresolved")}
          >
            {t("mistakes.mark_unresolved")}
          </Button>
        ) : null}
      </div>

      {showSolution && (item.solutionText || item.solutionImageUrl) ? (
        <div className="mt-2 rounded-lg border border-border bg-[color:var(--surface-subtle)] p-2">
          <p className="text-[11px] font-medium text-muted-foreground">
            {t("mistakes.solution_label")}
          </p>
          {item.solutionText ? (
            <p className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--ink)]">
              {item.solutionText}
            </p>
          ) : null}
          {item.solutionImageUrl ? (
            <a href={item.solutionImageUrl} target="_blank" rel="noreferrer">
              <img
                src={item.solutionImageUrl}
                alt={t("mistakes.field_solution_image")}
                className="mt-1 max-h-64 w-full rounded-lg border border-border object-contain"
              />
            </a>
          ) : null}
        </div>
      ) : null}
      {!showSolution && (item.solutionText || item.solutionImageUrl) ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("mistakes.solution_hidden")}</p>
      ) : null}

      {item.tutorTipText ? (
        <p className="mt-2 rounded-lg border border-border p-2 text-sm text-[color:var(--ink)]">
          <span className="text-[11px] font-medium text-muted-foreground">
            {t("mistakes.tip_label")}
          </span>
          <span className="mt-1 block whitespace-pre-wrap">{item.tutorTipText}</span>
        </p>
      ) : null}

      {item.canEdit && role !== "learner" ? (
        <TipEditor caseId={caseId} item={item} onDone={onChanged} />
      ) : null}
    </li>
  );
}

/**
 * #796 §2.2 Digital Mistake Book (錯題本). Hosted inside the Case Workspace
 * (the #636 case drawer's tab set, beside the progress/heatmap surface) and on
 * the parent case page — never a new top-level route. Opens after Lesson 1.
 */
export function MistakeBookSection({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [revealMode, setRevealMode] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const { data, isLoading, isError } = useQuery({
    queryKey: ["cases", "mistake-book", caseId],
    queryFn: () => getCaseMistakeBook({ data: { caseId } }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["cases", "mistake-book", caseId] });
  };

  // Fail silent: a non-party / pre-migration read never blocks the workspace.
  if (isError) return null;

  if (isLoading || !data) {
    return (
      <div className="space-y-2">
        <div className="h-5 w-40 rounded bg-[color:var(--foreground)]/[0.06]" />
        <div className="h-20 w-full rounded-xl border border-border" />
      </div>
    );
  }

  if (!data.revealed) {
    return (
      <section className="rounded-xl border border-dashed border-border p-3 text-sm">
        <p className="font-semibold text-[color:var(--ink)]">{t("mistakes.title")}</p>
        <p className="mt-1 text-muted-foreground">{t("mistakes.locked")}</p>
      </section>
    );
  }

  const toggleReveal = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[color:var(--ink)]">{t("mistakes.title")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("mistakes.counter", {
              resolved: data.counts.resolved,
              total: data.counts.total,
              unresolved: data.counts.unresolved,
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.counts.total > 0 ? (
            <Button
              type="button"
              size="sm"
              variant={revealMode ? "default" : "outline"}
              aria-pressed={revealMode}
              onClick={() => {
                setRevealMode((prev) => !prev);
                setRevealed(new Set());
              }}
            >
              {revealMode ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
              {revealMode ? t("mistakes.revision_on") : t("mistakes.revision_off")}
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {t("mistakes.add_open")}
          </Button>
        </div>
      </div>

      {data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
          {t("mistakes.empty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {data.items.map((item) => (
            <MistakeCard
              key={item.id}
              caseId={caseId}
              item={item}
              role={data.role}
              revealMode={revealMode}
              revealed={revealed.has(item.id)}
              onToggleReveal={() => toggleReveal(item.id)}
              onChanged={invalidate}
            />
          ))}
        </ul>
      )}

      {addOpen ? (
        <AddMistakeDialog
          caseId={caseId}
          tags={data.tags}
          onOpenChange={setAddOpen}
          onDone={invalidate}
        />
      ) : null}
    </section>
  );
}
