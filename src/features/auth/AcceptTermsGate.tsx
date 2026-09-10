import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/** Effective date of the current Terms of Service (see /tos). Bump to re-prompt all users. */
export const TOS_VERSION = "2026-09-08";

function LockIllustration() {
  return (
    <svg
      viewBox="0 0 240 240"
      className="h-44 w-44 text-[color:var(--ink)]"
      fill="none"
      aria-hidden
    >
      <path
        d="M88 98V76a32 32 0 0 1 64 0v22"
        stroke="var(--brand-royal)"
        strokeWidth="17"
        strokeLinecap="round"
      />
      <rect
        x="62"
        y="96"
        width="116"
        height="94"
        rx="18"
        fill="var(--surface)"
        stroke="currentColor"
        strokeWidth="4.5"
      />
      <circle cx="120" cy="134" r="11" fill="currentColor" />
      <rect x="115.5" y="138" width="9" height="22" rx="4.5" fill="currentColor" />
    </svg>
  );
}

type AcceptTermsGateProps = {
  userId: string;
  onAccepted: () => void;
  onDecline: () => void;
};

export function AcceptTermsGate({ userId, onAccepted, onDecline }: AcceptTermsGateProps) {
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
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 sm:px-6">
        <div className="flex w-full max-w-[400px] flex-col items-center text-center">
          <LockIllustration />
          <h1 className="mt-8 text-2xl font-bold tracking-tight text-[color:var(--ink)] sm:text-3xl">
            {t("auth.tos_title")}
          </h1>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-muted-foreground">
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
          </p>
          <Button
            variant="solid"
            color="neutral"
            loading={accepting}
            onClick={accept}
            className="mt-8 h-12 w-full rounded-xl text-base font-bold"
          >
            {t("auth.tos_accept")}
          </Button>
          <Button
            variant="ghost"
            onClick={onDecline}
            disabled={accepting}
            className="mt-2 h-10 rounded-xl font-bold text-[color:var(--ink)] underline underline-offset-4"
          >
            {t("auth.tos_decline")}
          </Button>
        </div>
      </main>
    </div>
  );
}
