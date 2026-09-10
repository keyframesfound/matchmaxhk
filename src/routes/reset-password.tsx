import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  makePasswordRules,
  PasswordStrength,
  usePasswordStrength,
  type PasswordStrengthCopy,
} from "@/components/ui/password-strength";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password | MatchMax" },
      { name: "description", content: "Choose a new password for your MatchMax account." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/reset-password" }],
  }),
  component: ResetPasswordPage,
});

type Phase = "checking" | "ready" | "invalid";

function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [updating, setUpdating] = useState(false);

  const rules = useMemo(
    () =>
      makePasswordRules({
        length: t("auth.rule_length"),
        case: t("auth.rule_case"),
        digit: t("auth.rule_digit"),
      }),
    [t],
  );
  const labels = useMemo(
    () => [
      t("auth.strength_empty"),
      t("auth.strength_weak"),
      t("auth.strength_fair"),
      t("auth.strength_strong"),
    ],
    [t],
  );
  const copy = useMemo<PasswordStrengthCopy>(
    () => ({
      meterLabel: t("auth.meter_label"),
      commonlyGuessed: t("auth.commonly_guessed"),
      srMet: t("auth.sr_met"),
      srNotMet: t("auth.sr_not_met"),
      announcedStrength: t("auth.sr_strength"),
      announcedGuessed: t("auth.sr_guessed"),
      announcedAllMet: t("auth.sr_all_met"),
      announcedStillNeeded: t("auth.sr_still_needed"),
    }),
    [t],
  );
  const strength = usePasswordStrength(password, { rules, labels, copy });

  // The recovery link lands here with session tokens in the URL hash; the
  // supabase client detects them and emits SIGNED_IN. Allow a short grace
  // period for that detection before declaring the link invalid.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) setPhase("ready");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) setPhase("ready");
    });
    const timeout = window.setTimeout(() => {
      if (active) setPhase((current) => (current === "checking" ? "invalid" : current));
    }, 4000);
    return () => {
      active = false;
      sub.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t("auth.password_mismatch"));
      return;
    }
    if (strength.guessable) {
      toast.error(t("auth.password_too_common"));
      return;
    }
    if (strength.score < strength.max) {
      toast.error(t("auth.password_incomplete"));
      return;
    }
    setUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(t("auth.reset_password_updated"));
      await navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("auth.reset_password_failed"));
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center p-4 py-8 lg:p-8">
        <div className="w-full max-w-[420px]">
          <div className="w-full rounded-3xl border border-border bg-card p-6 shadow-brand sm:p-8">
            {phase === "checking" ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("auth.reset_checking_link")}
              </p>
            ) : phase === "invalid" ? (
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-[color:var(--ink)]">
                  {t("auth.reset_invalid_title")}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">{t("auth.reset_invalid_body")}</p>
                <div className="mt-6 flex flex-col gap-3">
                  <Link to="/forgot-password" className="w-full">
                    <Button type="button" className="h-11 w-full font-bold">
                      {t("auth.request_new_link")}
                    </Button>
                  </Link>
                  <Link
                    to="/auth"
                    className="text-center text-sm font-bold text-[color:var(--brand-link)] hover:underline"
                  >
                    {t("auth.back_to_login")}
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-bold tracking-tight text-[color:var(--ink)]">
                  {t("auth.reset_password_title")}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("auth.reset_password_subtitle")}
                </p>

                <form onSubmit={onSubmit} className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">{t("auth.new_password_label")}</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="new-password"
                        spellCheck={false}
                        required
                        autoFocus
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={
                          showPassword ? t("auth.hide_password") : t("auth.show_password")
                        }
                        className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            aria-hidden
                          >
                            <path d="M3 3l18 18" />
                            <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7-.3.8-1 2-2.2 3.3" />
                            <path d="M6.2 6.9C4 8.4 4.5 9.6 3 12c1 2.5 5 7 9 7 1.8 0 3.4-.7 4.8-1.7" />
                            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                          </svg>
                        ) : (
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            aria-hidden
                          >
                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">{t("auth.confirm_password")}</Label>
                    <Input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      spellCheck={false}
                      required
                    />
                  </div>

                  <PasswordStrength value={password} rules={rules} labels={labels} copy={copy} />

                  <Button type="submit" disabled={updating} className="h-11 w-full font-bold">
                    {updating ? t("auth.updating_password") : t("auth.update_password_btn")}
                  </Button>
                </form>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-sm">
            <Link to="/auth" className="text-muted-foreground hover:text-foreground">
              {t("auth.back_to_login")}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
