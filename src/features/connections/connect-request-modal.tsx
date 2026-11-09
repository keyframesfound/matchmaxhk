import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { sendConnectionRequest } from "@/features/connections/connections.functions";
import {
  CONNECT_INTENT_TAGS,
  MAX_INTRO_NOTE_CHARS,
  type ConnectIntentTag,
} from "@/features/connections/connections-pure";

/**
 * #617: the Connect request modal. A required structured Intent Tag (radio
 * cards) plus an optional 140-char intro note. The note is sanitized
 * SERVER-side (phone/WA/Telegram/email → [Contact hidden] token) — the
 * client cap here is just the first gate.
 */
export function ConnectRequestModal({
  target,
  open,
  onOpenChange,
  preselectedIntent,
  onSent,
}: {
  target: { id: string; display_name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedIntent?: ConnectIntentTag;
  onSent?: (result: { status: string; mutual: boolean }) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [intentTag, setIntentTag] = useState<ConnectIntentTag | null>(preselectedIntent ?? null);
  const [note, setNote] = useState("");

  const send = useMutation({
    mutationFn: () =>
      sendConnectionRequest({
        data: {
          recipientTutorId: target?.id ?? "",
          intentTag: intentTag ?? "",
          introNote: note.trim() ? note.trim() : undefined,
        },
      }),
    onSuccess: (result) => {
      if (result.mutual) {
        // Mutual simultaneous requests auto-accept (#617 edge case).
        toast.success(t("connections.toast_accepted", { name: target?.display_name ?? "" }));
      } else {
        toast.success(t("connections.toast_sent", { name: target?.display_name ?? "" }));
      }
      void queryClient.invalidateQueries({ queryKey: ["connections"] });
      onOpenChange(false);
      setNote("");
      onSent?.({ status: result.status, mutual: result.mutual });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.startsWith("connections.")) {
        toast.error(t(message));
        return;
      }
      toast.error(t("connections.error.save_failed"));
    },
  });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!intentTag) return;
    send.mutate();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!send.isPending) onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("connections.modal_title")}</DialogTitle>
          <DialogDescription>
            {t("connections.modal_to", { name: target?.display_name ?? "" })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-[color:var(--ink)]">{t("connections.intent_label")}</Label>
            <div
              className="grid gap-2"
              role="radiogroup"
              aria-label={t("connections.intent_label")}
            >
              {CONNECT_INTENT_TAGS.map((tag) => {
                const selected = intentTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setIntentTag(tag)}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors",
                      selected
                        ? "border-[color:var(--brand-link)] bg-[color:var(--brand-link)]/[0.06] font-semibold text-[color:var(--ink)]"
                        : "border-border bg-card text-[color:var(--ink)] hover:bg-[color:var(--foreground)]/[0.03]",
                    )}
                  >
                    <span>{t(`connections.intent_${tag}`)}</span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-4 w-4 shrink-0 rounded-full border",
                        selected
                          ? "border-[color:var(--brand-link)] bg-[color:var(--brand-link)]"
                          : "border-[color:var(--ink)]/25",
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="connect-intro" className="text-[color:var(--ink)]">
              {t("connections.note_label")}
            </Label>
            <Textarea
              id="connect-intro"
              value={note}
              maxLength={MAX_INTRO_NOTE_CHARS}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("connections.note_placeholder")}
              rows={3}
              className="bg-[color:var(--surface)]"
            />
            <p className="text-right text-xs text-muted-foreground">
              {t("connections.note_counter", { length: note.length })}
            </p>
          </div>

          <Button
            type="submit"
            variant="solid"
            color="blue"
            className="w-full font-bold"
            disabled={!intentTag || send.isPending}
          >
            {send.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            {send.isPending ? t("connections.sending") : t("connections.send")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
