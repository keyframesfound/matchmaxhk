import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

/** Effective date of the current Terms of Service (see /tos). Bump to re-prompt all users. */
export const TOS_VERSION = "2026-09-08";

type AcceptTermsDialogProps = {
  userId: string;
  onAccepted: () => void;
  onDecline: () => void;
};

export function AcceptTermsDialog({ userId, onAccepted, onDecline }: AcceptTermsDialogProps) {
  const { t } = useTranslation();
  const [accepting, setAccepting] = useState(false);

  async function accept() {
    setAccepting(true);
    const acceptedAt = new Date().toISOString();
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      tos_accepted_at: acceptedAt,
      tos_version: TOS_VERSION,
    });
    if (error) {
      toast.error(t("auth.tos_accept_error"));
      setAccepting(false);
      return;
    }
    onAccepted();
  }

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="top-auto bottom-0 left-1/2 w-full max-w-[420px] translate-x-[-50%] translate-y-0 gap-0 rounded-t-3xl border-0 bg-[color:var(--surface)] p-6 pb-10 shadow-2xl data-[state=open]:slide-in-from-bottom-1/2 data-[state=closed]:slide-out-to-bottom-full sm:top-1/2 sm:bottom-auto sm:translate-y-[-50%] sm:rounded-3xl sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95"
      >
        <DialogTitle className="text-2xl font-bold tracking-tight text-[color:var(--ink)]">
          {t("auth.tos_title")}
        </DialogTitle>
        <DialogDescription className="mt-2 text-base leading-relaxed text-muted-foreground">
          {t("auth.tos_body_prefix")}
          <Link
            to="/tos"
            target="_blank"
            rel="noreferrer"
            className="font-bold text-[color:var(--brand-link)] underline underline-offset-4 hover:opacity-80"
          >
            {t("auth.tos_terms")}
          </Link>
          {t("auth.tos_body_mid")}
          <Link
            to="/privacy-policy"
            target="_blank"
            rel="noreferrer"
            className="font-bold text-[color:var(--brand-link)] underline underline-offset-4 hover:opacity-80"
          >
            {t("auth.tos_privacy")}
          </Link>
          {t("auth.tos_body_suffix")}
        </DialogDescription>
        <div className="mt-6 space-y-3">
          <Button
            variant="solid"
            color="neutral"
            loading={accepting}
            onClick={accept}
            className="h-12 w-full rounded-xl text-base font-bold"
          >
            {t("auth.tos_accept")}
          </Button>
          <Button
            variant="ghost"
            onClick={onDecline}
            disabled={accepting}
            className="h-10 w-full rounded-xl font-bold text-[color:var(--ink)] underline underline-offset-4"
          >
            {t("auth.tos_decline")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
