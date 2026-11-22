import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setCaseMeetingUrl } from "@/features/cases/case-schedule.functions";

import { MEETING_URL_MAX, normaliseMeetingUrl } from "./meeting-link";

/**
 * #785 AC-CONV-1: the online-lesson link, one tap to open or copy.
 *
 * A flat bordered bar above the drawer tabs. With a link saved every party
 * gets Open and Copy; the tutor (and Ops) can change it or clear it. An online
 * case with no link yet shows the inline editor to a writer and a short note
 * to a reader; an in-person case reads the same bar as a backup link and shows
 * nothing at all to a reader who has none.
 */
export function MeetingLink({
  caseId,
  url,
  mode,
  canEdit,
  canClear,
  onSaved,
}: {
  caseId: string;
  url: string | null;
  /** "online" | "in_person" | null, straight off the case row. */
  mode: string | null;
  canEdit: boolean;
  /** Only the tutor may clear a saved link, so an empty save is not offered to Ops. */
  canClear: boolean;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [draft, setDraft] = useState(url ?? "");
  const backup = mode === "in_person";

  const save = useMutation({
    mutationFn: (next: string | null) => setCaseMeetingUrl({ data: { caseId, url: next } }),
    onSuccess: (saved) => {
      setDraft(saved.url ?? "");
      setEditing(false);
      onSaved();
    },
  });

  // A reader with nothing to open on an in-person case sees no bar at all.
  if (backup && !url && !canEdit) return null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("case_manager.meet_copied"));
    } catch {
      toast.error(t("case_manager.meet_copy_failed"));
    }
  };

  const submit = () => {
    // Same rule the server applies, so a bad scheme is caught before the round trip.
    const normalised = normaliseMeetingUrl(draft);
    setInvalid(!normalised.ok);
    if (!normalised.ok) return;
    save.mutate(draft.trim() === "" ? null : draft);
  };

  const editorOpen = canEdit && (editing || !url);
  const saveDisabled = save.isPending || (draft.trim() === "" && (!url || !canClear));
  const errorText =
    save.isError && save.error.message.includes("URL_INVALID")
      ? t("case_manager.meet_invalid")
      : t("case_manager.prep_error");

  return (
    <section className="mt-4 rounded-xl border border-border px-3 py-2.5">
      <p className="text-xs font-medium text-muted-foreground">
        {t(backup ? "case_manager.meet_backup" : "case_manager.meet_title")}
      </p>

      {url ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button asChild size="default" variant="outline" className="h-9">
            <a href={url} target="_blank" rel="noreferrer noopener">
              {t("case_manager.meet_join")}
            </a>
          </Button>
          <Button type="button" size="default" variant="ghost" className="h-9" onClick={copy}>
            {t("case_manager.meet_copy")}
          </Button>
          {canEdit && !editing ? (
            <Button
              type="button"
              size="default"
              variant="ghost"
              className="h-9"
              onClick={() => setEditing(true)}
            >
              {t("case_manager.meet_edit")}
            </Button>
          ) : null}
          {!canEdit ? (
            <span className="text-xs text-muted-foreground">{t("case_manager.meet_readonly")}</span>
          ) : null}
        </div>
      ) : canEdit ? null : (
        <p className="mt-1 text-sm text-muted-foreground">{t("case_manager.meet_none")}</p>
      )}

      {editorOpen ? (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="h-9 min-w-0 flex-1"
              value={draft}
              maxLength={MEETING_URL_MAX}
              inputMode="url"
              placeholder={t("case_manager.meet_placeholder")}
              onChange={(event) => {
                setDraft(event.target.value);
                setInvalid(false);
                save.reset();
              }}
            />
            <Button
              type="button"
              size="default"
              className="h-9"
              disabled={saveDisabled}
              onClick={submit}
            >
              {t("case_manager.meet_save")}
            </Button>
            {url ? (
              <Button
                type="button"
                size="default"
                variant="ghost"
                className="h-9"
                onClick={() => {
                  setDraft(url);
                  setEditing(false);
                  setInvalid(false);
                  save.reset();
                }}
              >
                {t("case_manager.meet_cancel")}
              </Button>
            ) : null}
          </div>
          {invalid || save.isError ? (
            <p className="text-xs text-destructive">
              {invalid ? t("case_manager.meet_invalid") : errorText}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
