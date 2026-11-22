import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CASE_FILE_MAX_MB, caseFileError } from "@/features/cases/case-files";
import {
  createCaseFileUpload,
  deleteCaseFile,
  listCaseFiles,
  recordCaseFile,
  type CaseFileItem,
} from "@/features/cases/case-files.functions";
import { formatHktDateTime } from "@/features/rosters/roster-logic";

const ACCEPT = "application/pdf,image/jpeg,image/png,.docx,.pptx";
const MB = 1024 * 1024;

/** Browsers hand back an empty `type` for some Office files, so fall back to the extension. */
const EXT_TYPE: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function contentTypeFor(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TYPE[ext] ?? "";
}

function formatSize(bytes: number): string {
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

/**
 * #785 AC-CONV-5: the private case-file tray on the Homework tab.
 *
 * Upload is signed: the server hands back a path and token, the browser puts
 * the bytes straight into the `case-files` bucket, then records the metadata.
 * Nothing is base64'd through a server fn. Files open only through the signed
 * URL the server returns (10-minute TTL), so Open appears only when it exists.
 */
function FileRow({ caseId, file }: { caseId: string; file: CaseFileItem }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [armed, setArmed] = useState(false);
  const remove = useMutation({
    mutationFn: () => deleteCaseFile({ data: { caseId, fileId: file.id } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["case-files", caseId] }),
    onError: () => toast.error(t("homework.err_generic")),
  });

  return (
    <li className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{file.name}</p>
        <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{formatSize(file.sizeBytes)}</span>
          <span>{formatHktDateTime(file.createdAt, i18n.language)}</span>
        </p>
      </div>
      {file.url ? (
        <a
          href={file.url}
          target="_blank"
          rel="noreferrer noopener"
          className="shrink-0 text-xs font-semibold text-[color:var(--brand-link)] hover:underline"
        >
          {t("case_files.download")}
        </a>
      ) : null}
      <Button
        type="button"
        variant={armed ? "outline" : "ghost"}
        size={armed ? "sm" : "icon"}
        className={armed ? "h-9 shrink-0 text-xs" : "shrink-0"}
        aria-label={t("case_files.remove", { name: file.name })}
        disabled={remove.isPending}
        onClick={() => {
          if (!armed) {
            setArmed(true);
            return;
          }
          remove.mutate();
        }}
        onBlur={() => setArmed(false)}
      >
        {remove.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : armed ? (
          t("hours.confirm")
        ) : (
          <Trash2 className="h-4 w-4" aria-hidden />
        )}
      </Button>
    </li>
  );
}

export function CaseFilesPanel({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["case-files", caseId],
    queryFn: () => listCaseFiles({ data: { caseId } }),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const meta = {
        caseId,
        name: file.name,
        contentType: contentTypeFor(file),
        size: file.size,
      };
      // Same rules the server enforces, so the message lands before any bytes move.
      const invalid = caseFileError(meta);
      if (invalid) throw new Error(invalid);

      const { path, token } = await createCaseFileUpload({ data: meta });
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.storage
        .from("case-files")
        .uploadToSignedUrl(path, token, file);
      if (error) throw error;

      // `path` comes from the upload target; the rest is the metadata the user saw.
      await recordCaseFile({ data: { ...meta, path } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["case-files", caseId] });
    },
    onError: (error: Error) => {
      toast.error(
        t(`case_files.err_${error.message}`, {
          mb: CASE_FILE_MAX_MB,
          defaultValue: t("homework.err_generic"),
        }),
      );
    },
  });

  // A non-party gets `null`; the tray is private to the case, so render nothing.
  if (isLoading || isError || !data) return null;

  return (
    <section className="space-y-2 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("case_files.title")}</h3>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          aria-label={t("case_files.upload")}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Reset so picking the same file again still fires `change`.
            event.target.value = "";
            if (file) upload.mutate(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="default"
          className="h-9"
          disabled={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {t(upload.isPending ? "case_files.uploading" : "case_files.upload")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("case_files.copyright")}</p>
      <p className="text-xs text-muted-foreground">
        {t("case_files.size", { mb: CASE_FILE_MAX_MB })} {t("case_files.types")}
      </p>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("case_files.empty")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {data.map((file) => (
            <FileRow key={file.id} caseId={caseId} file={file} />
          ))}
        </ul>
      )}
    </section>
  );
}
