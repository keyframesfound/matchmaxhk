import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  bulkRowProblem,
  suggestBulkMode,
  toBulkRows,
  type BulkRow,
} from "@/features/materials/bulk-notes";
import { NOTE_CURRICULA } from "@/features/materials/lifecycle";
import { CollectionPicker } from "@/features/materials/collection-picker";
import { setMaterialCollection } from "@/features/materials/collections.functions";
import { saveNoteDraft, type NoteDraftInput } from "@/features/materials/note-drafts.functions";
import {
  attachNoteMainPdf,
  createNoteUploadTargets,
} from "@/features/materials/note-uploads.functions";

type UploadFn = (
  url: string,
  file: File,
  onProgress: (fraction: number) => void,
) => Promise<unknown>;

/**
 * #556 bulk intercept: several PDFs dropped on a Note become N note drafts, so
 * a Form 1–6 library never means one-by-one uploading. A pack bundles published
 * items, so "Notes Pack" makes the same drafts and then opens the pack editor.
 */
export function BulkNotesDialog({
  files,
  sharedMeta,
  upload,
  onClose,
}: {
  files: readonly File[];
  sharedMeta: () => NoteDraftInput;
  upload: UploadFn;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rows, setRows] = useState<BulkRow[]>(() => toBulkRows(files));
  const [mode, setMode] = useState<"pack" | "separate">(() =>
    suggestBulkMode(files.map((file) => file.name)),
  );
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [batch, setBatch] = useState(() => ({
    curriculumTag: sharedMeta().curriculumTag,
    subjectTag: sharedMeta().subjectTag ?? "",
    tags: "",
    price: "",
  }));
  const [done, setDone] = useState(0);
  const [running, setRunning] = useState(false);
  const invalid = rows.some((row) => bulkRowProblem(row));

  const patchRow = (key: string, patch: Partial<BulkRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const createDrafts = async () => {
    setRunning(true);
    setDone(0);
    try {
      for (const row of rows) {
        const { materialId } = await saveNoteDraft({
          data: {
            ...sharedMeta(),
            materialId: undefined,
            curriculumTag: batch.curriculumTag,
            subjectTag: batch.subjectTag.trim() || null,
            searchTags: [
              ...new Set([
                ...(sharedMeta().searchTags ?? []),
                ...batch.tags
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              ]),
            ],
            title: row.title.trim(),
            priceHkd: row.price.trim() === "" ? undefined : Number(row.price),
          },
        });
        const [target] = await createNoteUploadTargets({
          data: {
            materialId,
            files: [{ role: "main", fileName: row.file.name, sizeBytes: row.file.size }],
          },
        });
        await upload(target.signedUrl, row.file, () => undefined);
        await attachNoteMainPdf({
          data: {
            materialId,
            path: target.path,
            fileName: row.file.name,
            previewPageIndices: null,
          },
        });
        if (collectionId) {
          await setMaterialCollection({ data: { materialId, collectionId } });
        }
        setDone((count) => count + 1);
      }
      toast.success(t(`materials_store.bulk_done_${mode}`, { count: rows.length }));
      onClose();
      await navigate({ to: mode === "pack" ? "/account/folders/new" : "/account" });
    } catch (error) {
      // Finished drafts stay on the account page; only the rest need retrying.
      toast.error(error instanceof Error ? error.message : t("notes.form.save_failed"));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open || running ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("materials_store.bulk_title", { count: rows.length })}</DialogTitle>
          <DialogDescription>{t("materials_store.bulk_question")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2" role="radiogroup">
          {(["pack", "separate"] as const).map((option) => (
            <label key={option} className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                className="mt-1"
                checked={mode === option}
                onChange={() => setMode(option)}
              />
              <span>
                <span className="font-semibold">
                  {t(`materials_store.bulk_${option}`, { count: rows.length })}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t(`materials_store.bulk_${option}_hint`)}
                </span>
              </span>
            </label>
          ))}
        </div>
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-semibold">{t("materials_store.bulk_batch")}</legend>
          <select
            aria-label={t("notes.form.field_curriculum")}
            value={batch.curriculumTag ?? ""}
            onChange={(event) =>
              setBatch((current) => ({
                ...current,
                curriculumTag: (event.target.value || undefined) as NoteDraftInput["curriculumTag"],
              }))
            }
            className="h-10 rounded-md border border-input bg-[color:var(--surface)] px-3 text-sm"
          >
            <option value="">{t("notes.form.field_curriculum")}</option>
            {NOTE_CURRICULA.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
          <Input
            aria-label={t("notes.form.field_subject")}
            placeholder={t("notes.form.field_subject")}
            value={batch.subjectTag}
            onChange={(event) =>
              setBatch((current) => ({ ...current, subjectTag: event.target.value }))
            }
          />
          <Input
            aria-label={t("materials_store.bulk_batch_tags")}
            placeholder={t("materials_store.bulk_batch_tags")}
            value={batch.tags}
            onChange={(event) => setBatch((current) => ({ ...current, tags: event.target.value }))}
          />
          <div className="flex gap-2">
            <Input
              aria-label={t("materials_store.bulk_row_price")}
              type="number"
              min={0}
              placeholder="HK$"
              value={batch.price}
              onChange={(event) =>
                setBatch((current) => ({ ...current, price: event.target.value }))
              }
            />
            <Button
              type="button"
              variant="outline"
              disabled={batch.price.trim() === ""}
              onClick={() =>
                setRows((current) => current.map((row) => ({ ...row, price: batch.price })))
              }
            >
              {t("materials_store.bulk_apply_price")}
            </Button>
          </div>
        </fieldset>
        <ul className="space-y-2">
          {rows.map((row) => {
            const problem = bulkRowProblem(row);
            return (
              <li key={row.key} className="grid grid-cols-[1fr_6rem] gap-2">
                <Input
                  aria-label={t("materials_store.bulk_row_title")}
                  aria-invalid={problem === "title"}
                  maxLength={80}
                  value={row.title}
                  onChange={(event) => patchRow(row.key, { title: event.target.value })}
                />
                <Input
                  aria-label={t("materials_store.bulk_row_price")}
                  aria-invalid={problem === "price"}
                  type="number"
                  min={0}
                  placeholder="HK$"
                  value={row.price}
                  onChange={(event) => patchRow(row.key, { price: event.target.value })}
                />
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">{t("materials_store.bulk_price_rule")}</p>
        <CollectionPicker materialId={null} value={collectionId} onChange={setCollectionId} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={running} onClick={onClose}>
            {t("materials_store.bulk_cancel")}
          </Button>
          <Button type="button" loading={running} disabled={invalid} onClick={createDrafts}>
            {running
              ? t("materials_store.bulk_progress", { done, total: rows.length })
              : t("materials_store.bulk_create", { count: rows.length })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
