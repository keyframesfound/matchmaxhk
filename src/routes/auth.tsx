import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { LanguageToggle } from "@/components/brand/LanguageToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — MatchMax" },
      {
        name: "description",
        content:
          "Sign in or create your MatchMax account to post a tutoring case or manage your tutor profile.",
      },
      { property: "og:title", content: "Sign in — MatchMax" },
      {
        property: "og:description",
        content:
          "Access your MatchMax dashboard to post a tutoring case or manage your verified tutor profile.",
      },
      { property: "og:url", content: "https://maxmatch.app/auth" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://maxmatch.app/auth" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard", replace: true });
  }, [user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "sign_in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success(t("dashboard.welcome"));
        router.navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: name },
          },
        });
        if (error) throw error;
        toast.success(t("auth.check_email"));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      toast.error(msg);
    } finally {
      setBusy(false);
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
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
      // Supabase redirects the browser to the provider immediately, so we
      // never actually reach the code below in normal operation.
    } catch (err) {
      const msg = err instanceof Error ? err.message : `${provider} sign-in failed`;
      toast.error(msg);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Link to="/">
          <Logo />
        </Link>
        <LanguageToggle />
      </header>

      <main className="flex flex-1 items-center justify-center p-4 lg:p-8">
        <div className="grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,1fr)_28rem]">
          <div className="hidden h-[560px] rounded-3xl border border-dashed border-border bg-muted/20 lg:block" />

          <div className="w-full max-w-md justify-self-center lg:max-w-none">
            <div className="rounded-3xl border border-border bg-card p-8 shadow-brand">
              <h1 className="text-3xl font-black tracking-tight text-[color:var(--brand-navy)]">
                {t(mode === "sign_in" ? "auth.sign_in_title" : "auth.sign_up_title")}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(mode === "sign_in" ? "auth.sign_in_subtitle" : "auth.sign_up_subtitle")}
              </p>

              <div className="mt-6 space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full font-bold"
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

              <div className="my-6 flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t("auth.or")}
                </span>
                <Separator className="flex-1" />
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                {mode === "sign_up" && (
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("auth.name")}</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoComplete="name"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">{t("auth.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={busy}
                  className="h-11 w-full bg-[color:var(--brand-navy)] font-bold text-white hover:bg-[color:var(--brand-royal)]"
                >
                  {busy ? t("auth.signing_in") : t("auth.continue")}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "sign_in" ? t("auth.no_account") : t("auth.have_account")}{" "}
                <button
                  type="button"
                  onClick={() => setMode(mode === "sign_in" ? "sign_up" : "sign_in")}
                  className="font-bold text-[color:var(--brand-teal)] hover:underline"
                >
                  {mode === "sign_in" ? t("auth.sign_up") : t("auth.sign_in")}
                </button>
              </p>
            </div>

            <p className="mt-6 text-center text-sm">
              <Link to="/" className="text-muted-foreground hover:text-foreground">
                ← {t("common.back_home")}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
