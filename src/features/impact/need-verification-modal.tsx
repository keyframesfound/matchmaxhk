/**
 * Issue #794 §2.3 (AC-560-1, AC-560-2) — the family's side of Verified Need.
 *
 * Opened from the pro-bono block of the case request form: uploading one proof
 * document is OPTIONAL, and the privacy promise plus the blur hint are shown in
 * the dialog itself, never behind a disclosure. A family that uploads nothing
 * closes the dialog with "Continue without a document" and stays Self-Declared,
 * which is the absence of a record, so nothing is written.
 *
 * The upload is signed: the server mints a `<userId>/…` target, the browser
 * PUTs the bytes straight into the private `access-verification` bucket, then
 * `submitNeedVerification` registers the attempt. File rules come from
 * need-verification-path so the message lands before any bytes move.
 */

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Paperclip } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getMyNeedVerification,
  submitNeedVerification,
  createNeedVerificationUpload,
} from "@/features/impact/need-verification.functions";
import {
  NEED_VERIFICATION_BUCKET,
  NEED_VERIFICATION_MAX_MB,
  needVerificationFileError,
} from "@/features/impact/need-verification-path";
import { PROOF_KINDS, type ProofKind } from "@/features/impact/need-verification";

/** `proof_<kind>` is the key shape, written out so a rename cannot drift. */
const PROOF_KIND_KEYS: Record<ProofKind, string> = {
  cssa: "need_verification.proof_cssa",
  wfsfaa_full: "need_verification.proof_wfsfaa_full",
  wfsfaa_half: "need_verification.proof_wfsfaa_half",
  working_family_allowance: "need_verification.proof_wfa",
  public_housing: "need_verification.proof_public_housing",
  ngo_letter: "need_verification.proof_ngo_letter",
  social_worker_letter: "need_verification.proof_social_worker_letter",
  school_letter: "need_verification.proof_school_letter",
  other: "need_verification.proof_other",
};

const ACCEPT = "application/pdf,image/jpeg,image/png";
const NOTE_MAX = 500;

/** Browsers hand back an empty `type` for some local files. */
const EXT_TYPE: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

function proofContentType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TYPE[ext] ?? "";
}

/** The reviewer's decision date, always read in Hong Kong time. */
function formatHktDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Hong_Kong",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

type NeedVerificationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired after a successful submit so the caller can refresh its chip. */
  onChanged?: () => void;
};

export function NeedVerificationModal({
  open,
  onOpenChange,
  onChanged,
}: NeedVerificationModalProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const fetchMyState = useServerFn(getMyNeedVerification);
  const requestUpload = useServerFn(createNeedVerificationUpload);
  const submitAttempt = useServerFn(submitNeedVerification);

  const { data } = useQuery({
    queryKey: ["my-need-verification"],
    queryFn: () => fetchMyState(),
    enabled: open,
    staleTime: 30_000,
  });

  const [proofKind, setProofKind] = useState<ProofKind | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const pickId = "need-verification-pick";
  const inputId = "need-verification-file";
  const selectId = "need-verification-kind";
  const noteId = "need-verification-note";
  const errorId = "need-verification-error";

  // Unknown while the first read is in flight: let the server be the gate
  // rather than hiding the form and flashing it back in.
  const canSubmit = data ? data.canSubmit : true;

  const statusText = (() => {
    if (!data) return null;
    if (data.state === "pending") return t("need_verification.status_pending");
    if (data.state === "rejected") return t("need_verification.status_rejected");
    if (data.state === "expired") return t("need_verification.status_expired");
    if (data.state === "verified") {
      return t("need_verification.status_verified", {
        date: data.verifiedUntil ? formatHktDate(data.verifiedUntil, i18n.language) : "",
      });
    }
    return null;
  })();

  const onPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null;
    setError(null);
    if (!picked) {
      setFile(null);
      return;
    }
    // Same rules the server enforces, checked before a byte moves.
    const invalid = needVerificationFileError({
      name: picked.name,
      contentType: proofContentType(picked),
      size: picked.size,
    });
    if (invalid) {
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setError(
        invalid === "FILE_TOO_LARGE"
          ? t("need_verification.err_FILE_TOO_LARGE", { mb: NEED_VERIFICATION_MAX_MB })
          : t("need_verification.err_FILE_TYPE"),
      );
      return;
    }
    setFile(picked);
  };

  const clearFile = () => {
    setFile(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !proofKind || submitting) return;
    const meta = {
      name: file.name,
      contentType: proofContentType(file),
      size: file.size,
    };
    const invalid = needVerificationFileError(meta);
    if (invalid) {
      setError(
        invalid === "FILE_TOO_LARGE"
          ? t("need_verification.err_FILE_TOO_LARGE", { mb: NEED_VERIFICATION_MAX_MB })
          : t("need_verification.err_FILE_TYPE"),
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const target = await requestUpload({ data: meta });
      const { supabase } = await import("@/integrations/supabase/client");
      const { error: uploadError } = await supabase.storage
        .from(NEED_VERIFICATION_BUCKET)
        .uploadToSignedUrl(target.path, target.token, file);
      if (uploadError) throw uploadError;

      const description = note.trim().slice(0, NOTE_MAX);
      await submitAttempt({
        data: {
          proofKind,
          path: target.path,
          ...meta,
          ...(description ? { contextNote: description } : {}),
        },
      });

      toast.success(t("need_verification.submitted"));
      await queryClient.invalidateQueries({ queryKey: ["my-need-verification"] });
      onChanged?.();
      setFile(null);
      setNote("");
      setProofKind("");
      onOpenChange(false);
    } catch (submitError) {
      const code = errorText(submitError);
      if (code === "FILE_TYPE" || code === "FILE_TOO_LARGE") {
        setError(
          code === "FILE_TOO_LARGE"
            ? t("need_verification.err_FILE_TOO_LARGE", { mb: NEED_VERIFICATION_MAX_MB })
            : t("need_verification.err_FILE_TYPE"),
        );
      } else if (code === "ALREADY_SUBMITTED") {
        toast.error(t("need_verification.status_pending"));
        await queryClient.invalidateQueries({ queryKey: ["my-need-verification"] });
      } else if (code) {
        toast.error(code);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-[var(--radius-panel)] sm:max-w-lg">
        <DialogHeader className="space-y-1.5 text-left">
          <DialogTitle className="text-xl font-bold text-[color:var(--ink)]">
            {t("need_verification.upload_title")}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {t("need_verification.upload_intro")}
          </DialogDescription>
        </DialogHeader>

        {/* The promise lives in the modal, unconditionally, in every state. */}
        <div className="rounded-[var(--radius-control)] border border-border bg-muted/40 p-3">
          <p className="text-xs leading-relaxed text-[color:var(--ink)]">
            {t("need_verification.privacy_assurance")}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {t("need_verification.blur_hint")}
          </p>
        </div>

        <div aria-live="polite">
          {statusText ? (
            <p className="text-sm font-semibold text-[color:var(--ink)]">{statusText}</p>
          ) : null}
        </div>

        {canSubmit ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={selectId} className="text-sm font-medium">
                {t("need_verification.proof_kind_label")}
              </Label>
              <Select
                value={proofKind}
                onValueChange={(value) => setProofKind(value as ProofKind)}
                disabled={submitting}
              >
                <SelectTrigger id={selectId}>
                  <SelectValue placeholder={t("need_verification.proof_kind_label")} />
                </SelectTrigger>
                <SelectContent>
                  {PROOF_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {t(PROOF_KIND_KEYS[kind])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Button
                id={pickId}
                type="button"
                variant="outline"
                className="h-11 w-full justify-start gap-2 font-medium"
                aria-describedby={error ? errorId : undefined}
                disabled={submitting}
                onClick={() => fileInput.current?.click()}
              >
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{file ? file.name : t("case_files.upload")}</span>
              </Button>
              <input
                ref={fileInput}
                id={inputId}
                type="file"
                accept={ACCEPT}
                tabIndex={-1}
                className="sr-only"
                aria-labelledby={pickId}
                onChange={onPick}
              />
              {file ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="px-0 text-xs font-medium text-muted-foreground"
                  disabled={submitting}
                  onClick={clearFile}
                >
                  {t("need_verification.remove_document")}
                </Button>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={noteId} className="text-sm font-medium">
                {t("need_verification.context_label")}
              </Label>
              <Textarea
                id={noteId}
                rows={3}
                maxLength={NOTE_MAX}
                value={note}
                disabled={submitting}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            {error ? (
              <p id={errorId} role="alert" className="text-xs font-semibold text-destructive">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-end">
              <Button
                type="submit"
                variant="solid"
                color="blue"
                className="h-11 px-6 font-bold"
                disabled={!file || !proofKind || submitting}
                loading={submitting}
              >
                {t("need_verification.submit")}
              </Button>
              {/* No server call: Self-Declared is the absence of a record. */}
              <Button
                type="button"
                variant="ghost"
                className="h-11 px-4 font-semibold"
                onClick={() => onOpenChange(false)}
              >
                {t("need_verification.self_declared_only")}
              </Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
