import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bookmark, CircleUserRound, Trash2 } from "lucide-react";
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
    <div className="flex min-h-screen flex-col bg-[color:var(--surface-subtle)] text-[color:var(--ink)]">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <header className="border-b border-[color:var(--ink)]/10 pb-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--ink)]/65">
              Account
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[color:var(--ink)] sm:text-4xl">
              Settings
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--ink)]/70">
              Manage your profile details and account access.
            </p>
          </header>

          <div className="grid gap-10 pt-10 lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-16">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--ink)]/55">
                Settings
              </p>
              <nav className="mt-3 space-y-1" aria-label="Settings sections">
                <a
                  href="#profile"
                  className="flex items-center gap-2 rounded-lg bg-[color:var(--ink)]/5 px-3 py-2 text-sm font-semibold text-[color:var(--ink)]"
                >
                  <CircleUserRound className="h-4 w-4" aria-hidden="true" />
                  Profile
                </a>
                <Link
                  to="/saved-posts"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--ink)]/70 transition-colors hover:bg-[color:var(--ink)]/5 hover:text-[color:var(--ink)]"
                >
                  <Bookmark className="h-4 w-4" aria-hidden="true" />
                  Saved Posts
                </Link>
                <a
                  href="#danger-zone"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--ink)]/70 transition-colors hover:bg-[color:var(--ink)]/5 hover:text-[color:var(--ink)]"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Danger zone
                </a>
              </nav>
            </aside>

            <div className="min-w-0 max-w-3xl space-y-6">
              <section
                id="profile"
                className="rounded-2xl border border-[color:var(--ink)]/10 bg-[color:var(--surface)]"
              >
                <div className="border-b border-[color:var(--ink)]/10 px-6 py-5 sm:px-8">
                  <h2 className="text-lg font-bold text-[color:var(--ink)]">Profile</h2>
                  <p className="mt-1 text-sm text-[color:var(--ink)]/65">
                    Update the name associated with your MatchMax account.
                  </p>
                </div>
                <form onSubmit={saveProfile} className="space-y-5 px-6 py-6 sm:px-8">
                  <div className="space-y-2">
                    <Label htmlFor="settings-name" className="text-[color:var(--ink)]">
                      Name
                    </Label>
                    <Input
                      id="settings-name"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="Your name"
                      maxLength={80}
                      disabled={loadingProfile || saving}
                      autoComplete="name"
                      className="border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-[color:var(--ink)] placeholder:text-[color:var(--ink)]/35 focus-visible:ring-[color:var(--ink)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="settings-email" className="text-[color:var(--ink)]">
                      Email
                    </Label>
                    <Input
                      id="settings-email"
                      value={user?.email ?? ""}
                      disabled
                      readOnly
                      className="border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] text-[color:var(--ink)]/60"
                    />
                    <p className="text-xs text-[color:var(--ink)]/55">
                      Your email address is managed by your sign-in provider.
                    </p>
                  </div>
                  <Button
                    type="submit"
                    disabled={loadingProfile || saving}
                    className="bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                </form>
              </section>

              <section
                id="danger-zone"
                className="rounded-2xl border border-[color:var(--ink)]/15 bg-[color:var(--surface)]"
              >
                <div className="border-b border-[color:var(--ink)]/10 px-6 py-5 sm:px-8">
                  <h2 className="text-lg font-bold text-[color:var(--ink)]">Danger zone</h2>
                  <p className="mt-1 text-sm text-[color:var(--ink)]/65">
                    Permanently remove your account and its associated data.
                  </p>
                </div>
                <div className="flex flex-col gap-5 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                  <p className="max-w-xl text-sm leading-6 text-[color:var(--ink)]/70">
                    This deletes your account, saved tutors, profile, and tutor profiles you
                    created. This action cannot be undone.
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        disabled={deleting}
                        className="shrink-0 bg-red-600 font-bold text-white hover:bg-red-700"
                      >
                        Delete account
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-[color:var(--ink)] shadow-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-[color:var(--ink)]">
                          Delete your MatchMax account?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-[color:var(--ink)]/70">
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
                          className="bg-[color:var(--surface-invert)] text-white hover:bg-[color:var(--surface-invert-hover)]"
                        >
                          {deleting ? "Deleting…" : "Delete permanently"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </section>

              <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-[color:var(--ink)]/10 pt-5 text-sm">
                <Link
                  to="/saved-posts"
                  className="font-semibold text-[color:var(--ink)] underline"
                >
                  View saved posts
                </Link>
                <Link
                  to="/tutors"
                  className="font-semibold text-[color:var(--ink)] underline"
                >
                  Browse tutors
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
