import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CASE_FILE_MAX_MB } from "@/features/cases/case-files";
import { CASE_FILE_ACCEPT, uploadCaseFile } from "@/features/cases/case-file-upload";
import { listCaseFiles, type CaseFileItem } from "@/features/cases/case-files.functions";
import { hktDayLabel } from "@/features/cases/case-schedule";
import { COACHING_COMMENT_MAX, COACHING_URL_MAX } from "@/features/cases/coaching-comment";
import {
  listCoachingComments,
  setCoachingComment,
} from "@/features/cases/coaching-comment.functions";
import { cn } from "@/lib/utils";

type CoachingRow = NonNullable<Awaited<ReturnType<typeof listCoachingComments>>>[number];

/**
 * #785 AC-735-2b: one lesson's coach note, written by the tutor (or Ops) and
 * read by every party. A reader gets the comment and nothing to press; a writer
 * gets the editor in the same row, under the copy it replaces, so the drawer
 * never jumps and no modal interrupts the reading column.
 *
 * #785 AC-CONV-4: the optional lesson link and any files attached to this
 * lesson read as two quiet lines under the note, for every party. The attach
 * control lives only inside the writer's editor, so a learner reads the tutor's
 * material without gaining a way to write.
 */
function CoachingNoteRow({
  caseId,
  row,
  canEdit,
  attachments,
}: {
  caseId: string;
  row: CoachingRow;
  canEdit: boolean;
  attachments: CaseFileItem[];
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(row.comment ?? "");
  const [link, setLink] = useState(row.url ?? "");
  const initial = row.comment ?? "";
  const initialLink = row.url ?? "";

  const save = useMutation({
    mutationFn: () =>
      setCoachingComment({
        data: {
          caseId,
          lessonId: row.lessonId,
          text: draft.trim() ? draft : null,
          url: link.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success(t("coaching.saved"));
      void queryClient.invalidateQueries({ queryKey: ["case-coaching-notes", caseId] });
    },
  });

  const attach = useMutation({
    mutationFn: (file: File) =>
      uploadCaseFile({ caseId, file, category: "post_class", lessonId: row.lessonId }),
    onSuccess: () => {
      toast.success(t("coaching.saved"));
      void queryClient.invalidateQueries({ queryKey: ["case-files", caseId] });
    },
    onError: (error: Error) => {
      toast.error(
        t(`case_files.err_${error.message}`, {
          mb: CASE_FILE_MAX_MB,
          defaultValue: t("common.error"),
        }),
      );
    },
  });

  // A cleared comment is a real change: it deletes the note, so an empty draft
  // against an existing comment still saves. A changed link is a change too.
  const unchanged = draft === initial && link === initialLink;
  const atCap = draft.length >= COACHING_COMMENT_MAX;
  const errorText = save.isError
    ? save.error.message.includes("TOO_LONG")
      ? t("coaching.err_TOO_LONG", { max: COACHING_COMMENT_MAX })
      : save.error.message.includes("BAD_LINK")
        ? t("coaching.err_BAD_LINK")
        : t("common.error")
    : null;

  return (
    <li className="space-y-2 px-3 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium text-[color:var(--ink)]">
          {t("lesson_log.lesson_n", { n: row.lessonNumber })}
        </p>
        <p className="text-xs text-muted-foreground">{hktDayLabel(row.startsAt, i18n.language)}</p>
      </div>

      {canEdit ? (
        <div className="space-y-1.5">
          {row.comment === null ? (
            <p className="text-xs text-muted-foreground">{t("coaching.placeholder")}</p>
          ) : null}

          <Textarea
            aria-label={t("coaching.placeholder")}
            className="min-h-[76px] resize-y"
            maxLength={COACHING_COMMENT_MAX}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              save.reset();
            }}
          />

          <Input
            type="url"
            inputMode="url"
            placeholder="https://"
            maxLength={COACHING_URL_MAX}
            aria-label={t("coaching.link_label")}
            value={link}
            onChange={(event) => {
              setLink(event.target.value);
              save.reset();
            }}
          />

          <input
            ref={fileRef}
            type="file"
            accept={CASE_FILE_ACCEPT}
            className="hidden"
            aria-label={t("coaching.attach")}
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Reset so picking the same file again still fires `change`.
              event.target.value = "";
              if (file) attach.mutate(file);
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span
              aria-live="polite"
              className={cn(
                "text-[11px] tabular-nums",
                atCap ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {draft.length} / {COACHING_COMMENT_MAX}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                disabled={attach.isPending}
                onClick={() => fileRef.current?.click()}
              >
                {t("coaching.attach")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-9"
                disabled={save.isPending || unchanged}
                onClick={() => save.mutate()}
              >
                {t("coaching.save")}
              </Button>
            </div>
          </div>

          {errorText ? <p className="text-xs text-destructive">{errorText}</p> : null}
        </div>
      ) : row.comment ? (
        <div className="space-y-1">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-[color:var(--ink)]">
            {row.comment}
          </p>
          <p className="text-xs text-muted-foreground">{t("coaching.readonly")}</p>
        </div>
      ) : null}

      {row.url ? (
        <a
          href={row.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="w-fit text-xs font-semibold text-[color:var(--brand-link)] hover:underline"
        >
          {t("coaching.open_link")}
        </a>
      ) : null}

      {attachments.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground">{t("coaching.attached")}</p>
          <ul className="space-y-0.5">
            {attachments.map((file) => (
              <li key={file.id} className="truncate text-xs">
                {file.url ? (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[color:var(--brand-link)] hover:underline"
                  >
                    {file.name}
                  </a>
                ) : (
                  <span className="text-muted-foreground">{file.name}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

/**
 * #785 AC-735-2b Coach notes. A per-lesson long-form comment written after the
 * lesson, read by every party in the Case Workspace drawer. The server only
 * returns lessons that have already started, so there is no locked row to
 * explain, and it returns `null` for a caller who is not a party: this renders
 * nothing at all then, while loading, and when there are no started lessons.
 *
 * `canEdit` comes from the drawer (`isTutor || isOps`), exactly like the
 * meeting link bar; a learner or parent never gets a textarea the server would
 * refuse.
 */
export function CoachingNotes({ caseId, canEdit }: { caseId: string; canEdit: boolean }) {
  const { t } = useTranslation();
  const headingId = useId();

  const { data } = useQuery({
    queryKey: ["case-coaching-notes", caseId],
    queryFn: () => listCoachingComments({ data: { caseId } }),
  });
  // Same key as the Files tray, so opening both costs one request. Attachments
  // already visible there are listed here against their lesson, not duplicated
  // as a second upload surface.
  const { data: files } = useQuery({
    queryKey: ["case-files", caseId],
    queryFn: () => listCaseFiles({ data: { caseId } }),
  });

  if (!data || data.length === 0) return null;

  return (
    <section className="mt-4 space-y-2" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-sm font-semibold text-[color:var(--ink)]">
        {t("coaching.title")}
      </h2>

      <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-panel)] border border-border">
        {data.map((row) => (
          <CoachingNoteRow
            key={row.lessonId}
            caseId={caseId}
            row={row}
            canEdit={canEdit}
            attachments={(files ?? []).filter((file) => file.lessonId === row.lessonId)}
          />
        ))}
      </ul>
    </section>
  );
}
