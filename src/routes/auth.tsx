import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/auth")({
  // Kept for backwards compatibility: existing links pass ?mode=sign_up,
  // but the merged page handles login and signup in one magic-link flow.
  validateSearch: (search: Record<string, unknown>): { mode?: "sign_in" | "sign_up" } =>
    search.mode === "sign_up" ? { mode: "sign_up" } : {},

  head: () => ({
    meta: [
      { title: "Log in or sign up — MatchMax" },
      {
        name: "description",
        content:
          "Log in or create your MatchMax account to manage your MatchMax profile and saved tutors.",
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
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const captchaContainerRef = useRef<HTMLDivElement>(null);
  const captchaWidgetIdRef = useRef<string | null>(null);
  // Keep the public sitekey available even if the Cloudflare Git build omits the VITE_* variable.
  // The corresponding secret remains server-side in Supabase and is never bundled.
  const siteKey = import.meta.env.VITE_TURNSTILE_SITEKEY || "0x4AAAAAAEiLema3uiveM5pp";

  useEffect(() => {
    if (user) navigate({ to: "/tutors", replace: true });
  }, [user, navigate]);

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
  }, [siteKey]);

  function resetCaptcha() {
    setCaptchaToken(null);
    if (captchaWidgetIdRef.current && window.turnstile) {
      window.turnstile.reset(captchaWidgetIdRef.current);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!captchaToken) {
      toast.error("Please complete the security check.");
      return;
    }
    setBusy(true);
    try {
      // Magic link covers both login and signup: new emails create an account,
      // existing (password) users receive a one-hour sign-in link.
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/tutors`,
          captchaToken: captchaToken ?? undefined,
        },
      });
      if (error) throw error;
      setSentTo(email);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      toast.error(msg);
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
          redirectTo: `${window.location.origin}/tutors`,
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
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2 font-bold tracking-tight text-[color:var(--ink)]"
          aria-label="MatchMax home"
        >
          <Logo className="h-8 w-8" />
          <span>MatchMax</span>
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 pb-16 sm:px-6">
        <div className="flex w-full max-w-[420px] flex-1 flex-col">
          {sentTo ? (
            <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--muted)] text-2xl">
                ✉️
              </div>
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
                onClick={() => setSentTo(null)}
              >
                {t("auth.different_email")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-1 flex-col justify-center py-12">
              <div className="mb-8 flex justify-center">
                <Logo className="h-16 w-16" />
              </div>

              <h1 className="text-center text-3xl font-bold tracking-tight text-[color:var(--ink)]">
                {t("auth.login_or_signup_title")}
              </h1>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {t("auth.magic_link_subtitle")}
              </p>

              <form onSubmit={onSubmit} className="mt-8 space-y-3">
                <div className="relative">
                  <Input
                    id="email"
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
                  disabled={busy || !captchaToken}
                  variant="solid"
                  color="neutral"
                  className="h-12 w-full text-base font-bold"
                >
                  {busy ? t("auth.sending_link") : t("auth.continue")}
                </Button>
                <div
                  ref={captchaContainerRef}
                  className="min-h-[65px]"
                  aria-label="Security check"
                />
                {captchaError ? <p className="text-sm text-destructive">{captchaError}</p> : null}
              </form>

              <div className="my-6 flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">{t("auth.or")}</span>
                <Separator className="flex-1" />
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-12 w-full font-bold"
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
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
