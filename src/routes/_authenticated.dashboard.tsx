import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Settings | MatchMax" },
      { name: "description", content: "Manage your MatchMax account settings." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    setLoadingProfile(true);
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          toast.error(error.message);
        } else {
          setDisplayName(data?.display_name ?? user.user_metadata.display_name ?? "");
        }
        setLoadingProfile(false);
      });
    return () => {
      mounted = false;
    };
  }, [user]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const nextName = displayName.trim();
    if (!nextName) {
      toast.error("Please enter your name.");
      return;
    }
    setSaving(true);
    try {
      const [{ error: profileError }, { error: authError }] = await Promise.all([
        supabase.from("profiles").update({ display_name: nextName }).eq("id", user.id),
        supabase.auth.updateUser({ data: { display_name: nextName } }),
      ]);
      if (profileError) throw profileError;
      if (authError) throw authError;
      setDisplayName(nextName);
      toast.success("Your name has been updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update your name.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await deleteMyAccount({ data: {} });
      toast.success("Your account has been deleted.");
      await signOut();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete your account.");
      setDeleting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-[color:var(--brand-teal)]">
              Account
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">
              Settings
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Update your account details or permanently remove your MatchMax account.
            </p>
          </div>

          <div className="mt-10 space-y-6">
            <section className="rounded-3xl border border-border bg-card p-6 shadow-brand sm:p-8">
              <div>
                <h2 className="text-xl font-bold text-[color:var(--brand-navy)]">
                  Profile details
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This name is used across your MatchMax account.
                </p>
              </div>
              <form onSubmit={saveProfile} className="mt-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="settings-name">Name</Label>
                  <Input
                    id="settings-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Your name"
                    maxLength={80}
                    disabled={loadingProfile || saving}
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-email">Email</Label>
                  <Input id="settings-email" value={user?.email ?? ""} disabled readOnly />
                </div>
                <Button
                  type="submit"
                  disabled={loadingProfile || saving}
                  className="bg-[color:var(--brand-navy)] font-bold text-white hover:bg-[color:var(--brand-royal)]"
                >
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </form>
            </section>

            <section className="rounded-3xl border border-red-200 bg-red-50/50 p-6 sm:p-8">
              <div>
                <h2 className="text-xl font-bold text-red-900">Delete account</h2>
                <p className="mt-1 text-sm leading-6 text-red-800/80">
                  This permanently deletes your account, saved tutors, profile, and tutor profiles
                  you created. This action cannot be undone.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={deleting}
                    className="mt-6 border-red-300 bg-white font-bold text-red-700 hover:bg-red-100 hover:text-red-800"
                  >
                    Delete my account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete your MatchMax account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes your account and cannot be reversed. Your saved
                      tutors and any tutor profiles you created will also be removed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(event) => {
                        event.preventDefault();
                        void deleteAccount();
                      }}
                      disabled={deleting}
                      className="bg-red-600 text-white hover:bg-red-700"
                    >
                      {deleting ? "Deleting…" : "Delete permanently"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </section>
          </div>

          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            <Link
              to="/saved-posts"
              className="font-semibold text-[color:var(--brand-teal)] underline"
            >
              View saved posts
            </Link>
            <Link to="/tutors" className="font-semibold text-[color:var(--brand-teal)] underline">
              Browse tutors
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
