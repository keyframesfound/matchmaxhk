import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/useAuth";

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
  validateSearch: (
    search: Record<string, unknown>,
  ): { redirect?: string; save?: string } => {
    const redirect =
      typeof search.redirect === "string" &&
      search.redirect.startsWith("/") &&
      !search.redirect.startsWith("//")
        ? search.redirect
        : undefined;
    const save =
      typeof search.save === "string" && SAVE_PATTERN.test(search.save) ? search.save : undefined;
    return {
      ...(redirect ? { redirect } : {}),
      ...(save ? { save } : {}),
    };
  },

  head: () => ({
    meta: [
      { title: "Log in or sign up — MatchMax" },
      {
        name: "description",
        content: "Sign in with Google to manage your MatchMax profile, cases, and saved tutors.",
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

// Google-only sign-in (epic #280 P1/P2): one identity provider, no password
// accounts. `redirect` returns the visitor to where they were headed; `save`
// resumes an anonymous draft after the sign-in round-trip.
function AuthPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { redirect, save } = Route.useSearch();
  // Signed-in users land on Account (P6: the login sheet becomes Account).
  const postAuthPath = redirect ?? "/account";
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: postAuthPath, replace: true });
  }, [user, navigate, postAuthPath]);

  // Requires the "google" provider to be configured under Authentication ->
  // Providers in your Supabase project dashboard, with a Google OAuth client
  // ID/secret set there.
  async function onOAuth() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${withSave(postAuthPath, save)}`,
        },
      });
      if (error) throw error;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed";
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
          <div className="flex min-h-0 flex-1 flex-col justify-center-safe overflow-y-auto py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="mb-2 flex justify-center">
              <Logo
                className="h-16 w-16 sm:h-20 sm:w-20"
                imgClassName="h-16 w-16 sm:h-20 sm:w-20"
              />
            </div>

            <h1 className="-mt-1 text-center text-3xl font-bold tracking-tight text-[color:var(--ink)]">
              {t("auth.sign_in_title")}
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {t("auth.google_only_subtitle")}
            </p>

            <Button
              type="button"
              variant="outline"
              className="mt-6 h-12 w-full rounded-xl font-bold"
              onClick={() => void onOAuth()}
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
              {busy ? t("auth.signing_in") : t("auth.continue_google")}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
