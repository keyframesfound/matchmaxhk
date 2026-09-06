import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password | MatchMax" },
      { name: "description", content: "Request a MatchMax password reset link." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/forgot-password" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/tutors`,
      });
      if (error) throw error;
      setSent(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send reset email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center p-4 py-8 lg:p-8">
        <div className="w-full max-w-[420px]">
          <div className="w-full rounded-3xl border border-border bg-card p-6 shadow-brand sm:p-8">
            <h1 className="text-3xl font-black tracking-tight text-[color:var(--ink)]">
              Reset your password
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your email address and we will send you a link to choose a new password.
            </p>

            {sent ? (
              <div className="mt-6 space-y-5">
                <p className="rounded-lg bg-[color:var(--ink)]/5 px-4 py-3 text-sm text-[color:var(--ink)]/75">
                  If an account exists for that email, a password reset link is on its way.
                </p>
                <Link
                  to="/auth"
                  className="inline-block text-sm font-bold text-[color:var(--brand-link)] hover:underline"
                >
                  Back to log in
                </Link>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="recovery-email">Email</Label>
                  <Input
                    id="recovery-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                    autoFocus
                  />
                </div>
                <Button type="submit" disabled={sending} className="h-11 w-full font-bold">
                  {sending ? "Sending..." : "Send reset link"}
                </Button>
              </form>
            )}
          </div>

          <p className="mt-6 text-center text-sm">
            <Link to="/auth" className="text-muted-foreground hover:text-foreground">
              Back to log in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
