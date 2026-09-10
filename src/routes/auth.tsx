import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
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
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/useAuth";

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": (errorCode?: string) => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// Forward the pending-save value from the auth page URL onto the post-auth
// redirect target so the save can resume after sign-in.
function withSave(path: string, save: string | undefined): string {
  if (!save) return path;
  const [base, query] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("save", save);
  return `${base}?${params}`;
}

const SAVE_PATTERN = /^(tutor|case|course):.{1,}$/;

export const Route = createFileRoute("/auth")({
  // `mode=sign_up` switches between the sign-in and create-account forms.
  validateSearch: (
    search: Record<string, unknown>,
  ): { mode?: "sign_in" | "sign_up"; redirect?: string; save?: string } => {
    const redirect =
      typeof search.redirect === "string" &&
      search.redirect.startsWith("/") &&
      !search.redirect.startsWith("//")
        ? search.redirect
        : undefined;
    const save =
      typeof search.save === "string" && SAVE_PATTERN.test(search.save) ? search.save : undefined;
    return {
      ...(search.mode === "sign_up" ? { mode: "sign_up" as const } : {}),
      ...(redirect ? { redirect } : {}),
      ...(save ? { save } : {}),
    };
  },

  head: () => ({
    meta: [
      { title: "Log in or sign up — MatchMax" },
      {
        name: "description",
        content:
          "Log in or create your MatchMax account with your email and password to manage your profile and saved tutors.",
      },
      { property: "og:title", content: "Log in or sign up — MatchMax" },
      {
        property: "og:description",
        content: "Access your MatchMax settings and saved tutor profiles.",
      },
      { property: "og:url", content: "https://matchmax.hk/auth" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/auth" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { mode, redirect, save } = Route.useSearch();
  const isSignUp = mode === "sign_up";
  const postAuthPath = redirect ?? "/tutors";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"email" | "password">("email");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showResetHint, setShowResetHint] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const captchaContainerRef = useRef<HTMLDivElement>(null);
  const captchaWidgetIdRef = useRef<string | null>(null);

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

  // Keep the public sitekey available even if the Cloudflare Git build omits the VITE_* variable.
  // The corresponding secret remains server-side in Supabase and is never bundled.
  const siteKey = import.meta.env.VITE_TURNSTILE_SITEKEY || "0x4AAAAAAEiLema3uiveM5pp";

  useEffect(() => {
    if (user) navigate({ to: postAuthPath, replace: true });
  }, [user, navigate, postAuthPath]);

  useEffect(() => {
    if (!siteKey || !captchaContainerRef.current) return;

    const renderWidget = () => {
      if (!window.turnstile || !captchaContainerRef.current || captchaWidgetIdRef.current) return;
      captchaWidgetIdRef.current = window.turnstile.render(captchaContainerRef.current, {
        sitekey: siteKey,
        action: "auth",
        callback: (token) => {
          setCaptchaError(null);
          setCaptchaToken(token);
        },
        "expired-callback": () => setCaptchaToken(null),
        "error-callback": (errorCode = "unknown") => {
          setCaptchaToken(null);
          setCaptchaError(`Security check unavailable (${errorCode}).`);
        },
      });
    };

    const scriptSelector =
      'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"]';
    const script = document.querySelector<HTMLScriptElement>(scriptSelector);
    if (script) {
      script.addEventListener("load", renderWidget);
      renderWidget();
      return () => {
        script.removeEventListener("load", renderWidget);
        if (captchaWidgetIdRef.current && window.turnstile) {
          window.turnstile.remove(captchaWidgetIdRef.current);
        }
        captchaWidgetIdRef.current = null;
      };
    }

    const newScript = document.createElement("script");
    newScript.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    newScript.async = true;
    newScript.defer = true;
    newScript.addEventListener("load", renderWidget);
    newScript.addEventListener("error", () => {
      setCaptchaError("Security check could not be loaded.");
    });
    document.head.appendChild(newScript);
    return () => {
      newScript.removeEventListener("load", renderWidget);
      if (captchaWidgetIdRef.current && window.turnstile) {
        window.turnstile.remove(captchaWidgetIdRef.current);
      }
      captchaWidgetIdRef.current = null;
    };
  }, [siteKey, step]);

  function resetCaptcha() {
    setCaptchaToken(null);
    if (captchaWidgetIdRef.current && window.turnstile) {
      window.turnstile.reset(captchaWidgetIdRef.current);
    }
  }

  function toggleMode() {
    const next = isSignUp ? undefined : ("sign_up" as const);
    setFormError(null);
    setShowResetHint(false);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setStep("email");
    void navigate({ to: "/auth", search: (prev) => ({ ...prev, mode: next }), replace: true });
  }

  function backToEmail() {
    setStep("email");
    setPassword("");
    setConfirmPassword("");
    setFormError(null);
    setShowResetHint(false);
    setShowPassword(false);
    resetCaptcha();
  }

  function onSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setShowResetHint(false);
    if (!email.trim()) return;
    setStep("password");
  }

  async function onSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setShowResetHint(false);
    if (!captchaToken) {
      toast.error(t("auth.captcha_required"));
      return;
    }
    if (isSignUp) {
      if (password !== confirmPassword) {
        setFormError(t("auth.password_mismatch"));
        return;
      }
      if (strength.guessable) {
        setFormError(t("auth.password_too_common"));
        return;
      }
      if (strength.score < strength.max) {
        setFormError(t("auth.password_incomplete"));
        return;
      }
    }
    setBusy(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${withSave(postAuthPath, save)}`,
            captchaToken: captchaToken ?? undefined,
          },
        });
        if (error) throw error;
        // With email confirmation enabled there is no session yet: ask the
        // user to confirm before signing in.
        if (!data.session) setSentTo(email);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: { captchaToken: captchaToken ?? undefined },
        });
        if (error) throw error;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/invalid login credentials/i.test(msg)) {
        setFormError(t("auth.invalid_credentials"));
        setShowResetHint(true);
      } else if (/not confirmed/i.test(msg)) {
        setFormError(t("auth.email_not_confirmed"));
      } else {
        toast.error(msg || t("auth.sign_in_failed"));
      }
    } finally {
      setBusy(false);
      resetCaptcha();
    }
  }

  // Was routed through Lovable's cloud-auth-js OAuth broker. Now goes straight to
  // Supabase's own OAuth support. Requires the "google" provider to be configured
  // under Authentication -> Providers in your Supabase project dashboard, with a
  // Google OAuth client ID/secret set there.
  async function onOAuth(provider: "google") {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}${withSave(postAuthPath, save)}`,
        },
      });
      if (error) throw error;
    } catch (err) {
      const msg = err instanceof Error ? err.message : `${provider} sign-in failed`;
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <SiteHeader />

      <main className="flex min-h-0 flex-1 flex-col items-center px-4 sm:px-6">
        <div className="flex min-h-0 w-full max-w-[420px] flex-1 flex-col">
          {sentTo ? (
            <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
              <svg
                className="h-12 w-12 text-[color:var(--ink)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <h1 className="mt-6 text-2xl font-bold tracking-tight text-[color:var(--ink)]">
                {t("auth.check_email_title")}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                {t("auth.check_email_body", { email: sentTo })}
              </p>
              <Button
                type="button"
                variant="ghost"
                className="mt-6 text-sm font-bold text-[color:var(--brand-link)]"
                onClick={() => {
                  setSentTo(null);
                  setStep("email");
                  setPassword("");
                  setConfirmPassword("");
                  setShowPassword(false);
                  setFormError(null);
                  setShowResetHint(false);
                }}
              >
                {t("auth.different_email")}
              </Button>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col justify-start overflow-y-auto pt-1 pb-4">
              <div className="mb-2 flex justify-center">
                <Logo
                  className="h-16 w-16 sm:h-20 sm:w-20"
                  imgClassName="h-16 w-16 sm:h-20 sm:w-20"
                />
              </div>

              <h1 className="-mt-1 text-center text-3xl font-bold tracking-tight text-[color:var(--ink)]">
                {isSignUp ? t("auth.sign_up_title") : t("auth.sign_in_title")}
              </h1>
              {step === "password" ? (
                <>
                  <p className="mt-2 text-center text-sm font-medium text-foreground">{email}</p>
                  <button
                    type="button"
                    onClick={backToEmail}
                    className="mx-auto mt-1 block text-xs font-bold text-[color:var(--brand-link)] hover:underline"
                  >
                    {t("auth.different_email")}
                  </button>
                </>
              ) : (
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  {isSignUp ? t("auth.sign_up_subtitle") : t("auth.password_sign_in_subtitle")}
                </p>
              )}

              {step === "email" ? (
                <>
                  <form onSubmit={onSubmitEmail} className="mt-6 space-y-3">
                    <div className="relative">
                      <Input
                        id="auth-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        placeholder="you@example.com"
                        className="h-12 w-full bg-[color:var(--muted)] pr-10"
                      />
                      {email ? (
                        <button
                          type="button"
                          onClick={() => setEmail("")}
                          aria-label={t("auth.clear_email")}
                          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                            <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.25" />
                            <path
                              d="M9 9l6 6M15 9l-6 6"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                    <Button
                      type="submit"
                      disabled={busy}
                      variant="solid"
                      color="neutral"
                      className="h-12 w-full rounded-xl text-base font-bold"
                    >
                      {t("auth.continue")}
                    </Button>
                  </form>

                  <div className="my-5 flex items-center gap-3">
                    <Separator className="flex-1" />
                    <span className="text-xs text-muted-foreground">{t("auth.or")}</span>
                    <Separator className="flex-1" />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full rounded-xl font-bold"
                    onClick={() => onOAuth("google")}
                    disabled={busy}
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
                      />
                    </svg>
                    {t("auth.continue_google")}
                  </Button>

                  <p className="mt-5 text-center text-sm text-muted-foreground">
                    {isSignUp ? t("auth.have_account") : t("auth.no_account")}{" "}
                    <button
                      type="button"
                      onClick={toggleMode}
                      className="font-bold text-[color:var(--brand-link)] hover:underline"
                    >
                      {isSignUp ? t("auth.sign_in") : t("auth.sign_up")}
                    </button>
                  </p>
                </>
              ) : (
                <>
                  <form onSubmit={onSubmitPassword} className="mt-6 space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="auth-password">{t("auth.password")}</Label>
                      <div className="relative">
                        <Input
                          id="auth-password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          autoComplete={isSignUp ? "new-password" : "current-password"}
                          spellCheck={false}
                          placeholder={isSignUp ? t("auth.new_password_placeholder") : "••••••••"}
                          className="h-12 w-full bg-[color:var(--muted)] pr-10"
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

                    {isSignUp ? (
                      <>
                        <div className="space-y-1.5">
                          <Label htmlFor="auth-confirm-password">
                            {t("auth.confirm_password")}
                          </Label>
                          <Input
                            id="auth-confirm-password"
                            type={showPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            autoComplete="new-password"
                            spellCheck={false}
                            placeholder={t("auth.new_password_placeholder")}
                            className="h-12 w-full bg-[color:var(--muted)]"
                          />
                        </div>
                        <PasswordStrength
                          value={password}
                          rules={rules}
                          labels={labels}
                          copy={copy}
                        />
                      </>
                    ) : null}

                    <Button
                      type="submit"
                      disabled={busy || !captchaToken}
                      variant="solid"
                      color="neutral"
                      className="h-12 w-full rounded-xl text-base font-bold"
                    >
                      {busy
                        ? isSignUp
                          ? t("auth.creating_account")
                          : t("auth.signing_in")
                        : t("auth.continue")}
                    </Button>
                    <div
                      ref={captchaContainerRef}
                      className="min-h-[65px]"
                      aria-label="Security check"
                    />
                    {captchaError ? (
                      <p className="text-sm text-destructive">{captchaError}</p>
                    ) : null}
                    {formError ? (
                      <div className="text-sm text-destructive">
                        <p>{formError}</p>
                        {showResetHint ? (
                          <p className="mt-1 text-muted-foreground">
                            {t("auth.invalid_credentials_hint")}{" "}
                            <Link
                              to="/forgot-password"
                              className="font-bold text-[color:var(--brand-link)] hover:underline"
                            >
                              {t("auth.set_password_link")}
                            </Link>
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </form>

                  {!isSignUp ? (
                    <p className="mt-3 text-center text-sm">
                      <Link
                        to="/forgot-password"
                        className="text-sm font-bold text-[color:var(--brand-link)] hover:underline"
                      >
                        {t("auth.forgot_password")}
                      </Link>
                    </p>
                  ) : null}
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
