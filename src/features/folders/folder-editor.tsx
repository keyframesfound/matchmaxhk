import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findContactViolations } from "@/lib/contact-filter";
import { formatMoney } from "@/lib/money";
import { shopKindLabel } from "@/features/materials/material-card";
import {
  uploadMaterialCover,
  MAX_MATERIAL_COVER_BYTES,
} from "@/features/materials/cover.functions";
import {
  FOLDER_MAX_CHILDREN,
  FOLDER_MIN_CHILDREN,
  folderBulkSavings,
  validateFolderChildren,
} from "@/features/folders/folder-rules";
import {
  getFolderEditorData,
  saveFolderDraft,
  submitFolderForReview,
  type FolderEditorPickerRow,
} from "@/features/folders/folder-drafts.functions";

/**
 * #392: the Topic Folder editor (/account/folders/new + edit). The tutor
 * bundles 2–20 of their OWN published items behind a bulk price that must
 * undercut the items' sum ("Save HK$X (Y%)"), with a REQUIRED cover for the
 * big-cover shop card. Draft → submitForReview → pending_review (the same
 * staff review as notes/gigs).
 */

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

export function FolderEditorForm({ folderId }: { folderId?: string }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const editorQuery = useQuery({
    queryKey: ["folder-editor", folderId ?? "new"],
    queryFn: () => getFolderEditorData({ data: { folderId } }),
    enabled: true,
  });

  // Hydrate the form exactly once, when the editor data first lands (a
  // later refetch must never clobber in-progress edits).
  const hydratedRef = useRef(false);
  useEffect(() => {
    const data = editorQuery.data;
    if (!data || hydratedRef.current) return;
    hydratedRef.current = true;
    if (data.folder) {
      setTitle(data.folder.title === "Untitled folder" ? "" : data.folder.title);
      setDescription(data.folder.description ?? "");
      setPrice(data.folder.priceHkd ? String(data.folder.priceHkd) : "");
      setSelectedIds(data.children.map((child) => child.id));
    }
  }, [editorQuery.data]);

  const picker = useMemo(() => editorQuery.data?.picker ?? [], [editorQuery.data]);
  const pickerById = useMemo(() => new Map(picker.map((row) => [row.id, row])), [picker]);
  const selectedRows: FolderEditorPickerRow[] = selectedIds
    .map((id) => pickerById.get(id))
    .filter((row): row is FolderEditorPickerRow => Boolean(row));

  const savings = folderBulkSavings(
    Number(price) || 0,
    // The picker is server-filtered to the tutor's own published pickable
    // items, so the children gate here covers count / no-folders / dupes.
    selectedRows.map((row) => ({
      materialId: row.id,
      priceHkd: row.priceHkd,
      materialType: row.materialType,
    })),
  );
  const childErrors = validateFolderChildren(
    selectedRows.map((row) => ({
      materialId: row.id,
      priceHkd: row.priceHkd,
      materialType: row.materialType,
    })),
  );
  // Client-renderable child problems with i18n copy. The picker is
  // server-filtered to the tutor's own published pickable items, so only the
  // count and duplicate rules can surface here; the remaining validator
  // rules gate submit and re-check server-side.
  const childMessages: string[] = [];
  if (selectedRows.length < FOLDER_MIN_CHILDREN || selectedRows.length > FOLDER_MAX_CHILDREN) {
    childMessages.push(
      t("shop.form.folder_children_count", {
        min: FOLDER_MIN_CHILDREN,
        max: FOLDER_MAX_CHILDREN,
        n: selectedRows.length,
      }),
    );
  }
  {
    const seenIds = new Set<string>();
    for (const row of selectedRows) {
      if (seenIds.has(row.id)) childMessages.push(t("shop.form.folder_children_dup"));
      seenIds.add(row.id);
    }
  }

  const copyViolations = useMemo(() => {
    const titleV = findContactViolations(title);
    const descV = findContactViolations(description);
    return { titleV, descV };
  }, [title, description]);
  const blockedByContact = copyViolations.titleV.length > 0 || copyViolations.descV.length > 0;

  const priceNum = price.trim() === "" ? Number.NaN : Number(price);
  const sumHkd = selectedRows.reduce((sum, row) => sum + Math.max(0, row.priceHkd), 0);
  const priceInvalid =
    Number.isNaN(priceNum) || !Number.isInteger(priceNum) || priceNum <= 0 || priceNum >= sumHkd;
  const coverMissingForSubmit = !cover && !editorQuery.data?.folder?.coverUrl;
  const childrenInvalid =
    selectedIds.length < FOLDER_MIN_CHILDREN || selectedIds.length > FOLDER_MAX_CHILDREN;

  const done = () => {
    window.location.assign("/account");
  };

  const buildPayload = () => ({
    materialId: editorQuery.data?.folder?.id,
    title: title.trim() || undefined,
    description: description.trim() || undefined,
    priceHkd: price.trim() === "" ? undefined : Number(price),
    childIds: selectedIds,
  });

  const uploadCoverIfNeeded = async (folderIdValue: string) => {
    if (!cover) return;
    const base64 = await fileToBase64(cover);
    await uploadMaterialCover({
      data: { materialId: folderIdValue, fileName: cover.name, base64Data: base64 },
    });
  };

  const draftMutation = useMutation({
    mutationFn: async () => {
      const { folderId: savedId } = await saveFolderDraft({ data: buildPayload() });
      await uploadCoverIfNeeded(savedId);
      return savedId;
    },
    onSuccess: () => {
      toast.success(t("notes.form.draft_saved"));
      done();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("notes.form.save_failed")),
    onSettled: () => setSaving(false),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { folderId: savedId } = await saveFolderDraft({ data: buildPayload() });
      await uploadCoverIfNeeded(savedId);
      return submitFolderForReview({ data: { folderId: savedId } });
    },
    onSuccess: () => {
      toast.success(t("notes.form.submitted"));
      done();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("notes.form.submit_failed")),
    onSettled: () => setSaving(false),
  });

  const missing: string[] = [];
  if (title.trim().length < 3) missing.push(t("shop.form.field_title"));
  if (priceInvalid) missing.push(t("shop.form.field_price"));
  if (childrenInvalid) missing.push(t("shop.form.field_items"));
  if (coverMissingForSubmit) missing.push(t("shop.form.field_cover"));

  const run = (kind: "draft" | "submit") => {
    setSaving(true);
    if (kind === "draft") draftMutation.mutate();
    else submitMutation.mutate();
  };

  const violationNote = (violations: { match: string }[]) =>
    violations.length > 0 ? (
      <p className="text-xs text-destructive">
        {t("notes.form.contact_block", {
          match: violations
            .map((v) => v.match)
            .slice(0, 2)
            .join(", "),
        })}
      </p>
    ) : null;

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!blockedByContact && missing.length === 0 && childErrors.length === 0) run("submit");
      }}
    >
      {editorQuery.data?.folder?.rejectionReason ? (
        <p className="rounded-md border border-[#B42318]/30 bg-[#B42318]/5 px-3 py-2 text-xs leading-relaxed text-destructive">
          {editorQuery.data.folder.rejectionReason}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="folder-title">{t("shop.form.field_title")}</Label>
        <Input
          id="folder-title"
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("shop.form.title_placeholder")}
          className="h-11"
        />
        {violationNote(copyViolations.titleV)}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="folder-description">{t("shop.form.field_description")}</Label>
        <textarea
          id="folder-description"
          value={description}
          maxLength={4000}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder={t("shop.form.description_placeholder")}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-[0.95rem] focus-visible:border-[color:var(--ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
        />
        {violationNote(copyViolations.descV)}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="folder-price">{t("shop.form.field_price")}</Label>
          <Input
            id="folder-price"
            type="number"
            min={1}
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={t("shop.form.price_placeholder")}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">{t("shop.form.price_folder_hint")}</p>
          {savings.savingsHkd > 0 && !priceInvalid ? (
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {t("shop.form.savings_line", {
                amount: formatMoney(savings.savingsHkd),
                percent: savings.percent,
              })}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="folder-cover">{t("shop.form.field_cover")}</Label>
          <Input
            id="folder-cover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="h-11 cursor-pointer"
            onChange={(e) => setCover(e.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-muted-foreground">{t("shop.form.cover_hint")}</p>
          {cover != null && cover.size > MAX_MATERIAL_COVER_BYTES ? (
            <p className="text-xs text-destructive">{t("shop.form.cover_too_large")}</p>
          ) : null}
        </div>
      </div>

      {/* Children picker: the tutor's own PUBLISHED non-folder items. */}
      <div className="space-y-2 rounded-2xl border border-border bg-muted/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>{t("shop.form.items_label")}</Label>
          <span
            className={
              childrenInvalid
                ? "text-xs font-medium text-destructive"
                : "text-xs font-medium text-emerald-700 dark:text-emerald-400"
            }
          >
            {t("shop.form.items_count", { count: selectedIds.length })}
          </span>
        </div>
        {editorQuery.isLoading ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : picker.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("shop.form.items_empty")}</p>
        ) : (
          <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {picker.map((row) => {
              const checked = selectedIds.includes(row.id);
              return (
                <li key={row.id}>
                  <label
                    className={
                      checked
                        ? "flex cursor-pointer items-center gap-3 rounded-md border border-[color:var(--ink)]/40 bg-card px-3 py-2"
                        : "flex cursor-pointer items-center gap-3 rounded-md border border-border bg-card px-3 py-2 transition-colors hover:bg-[color:var(--surface-subtle)]"
                    }
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => {
                        setSelectedIds((prev) =>
                          c ? [...prev, row.id] : prev.filter((id) => id !== row.id),
                        );
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-[color:var(--ink)]">
                      {row.title}
                    </span>
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                      {shopKindLabel(row.materialType, t)}
                    </span>
                    <span className="shrink-0 text-sm font-medium text-[color:var(--ink)]">
                      {row.priceHkd === 0 ? t("notes.card.free") : formatMoney(row.priceHkd)}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {childMessages.length > 0 ? (
          <p className="text-xs text-destructive">{childMessages.join(" ")}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">{t("shop.form.items_hint")}</p>
      </div>

      {/* Selected summary with remove buttons. */}
      {selectedRows.length > 0 ? (
        <ul className="space-y-1.5">
          {selectedRows.map((row, index) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate text-sm">
                {index + 1}. {row.title}
              </span>
              <span className="shrink-0 text-sm font-medium">
                {row.priceHkd === 0 ? t("notes.card.free") : formatMoney(row.priceHkd)}
              </span>
              <button
                type="button"
                aria-label={t("shop.form.remove_item")}
                onClick={() => setSelectedIds((prev) => prev.filter((id) => id !== row.id))}
                className="rounded-md border border-border p-1 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
          <li className="flex items-center justify-between gap-2 px-3 pt-1 text-sm">
            <span className="font-medium">{t("shop.form.items_sum_label")}</span>
            <span className="font-medium">{formatMoney(sumHkd)}</span>
          </li>
          <li className="flex items-center justify-between gap-2 px-3">
            <span className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
              <Check className="h-4 w-4" aria-hidden />
              {t("shop.form.bulk_label")}
            </span>
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
              {price.trim() === "" ? "—" : formatMoney(Number(price))}
            </span>
          </li>
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <Button type="button" variant="outline" disabled={saving} onClick={() => run("draft")}>
          {saving && draftMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          {t("notes.form.save_draft")}
        </Button>
        <Button
          type="submit"
          variant="solid"
          color="accent"
          className="font-medium"
          disabled={saving || blockedByContact || missing.length > 0 || childErrors.length > 0}
        >
          {saving && submitMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          {t("notes.form.submit_review")}
        </Button>
      </div>
      {missing.length > 0 && !blockedByContact && (
        <p className="text-xs text-muted-foreground">
          {t("notes.form.missing_note", { fields: missing.join(", ") })}
        </p>
      )}
    </form>
  );
}
