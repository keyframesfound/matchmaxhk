import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bookmark,
  Check,
  CircleUserRound,
  GraduationCap,
  KeyRound,
  Monitor,
  Moon,
  Palette,
  Search,
  Sun,
  Trash2,
  UserCog,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/account.functions";
import { ConsolePanel } from "@/components/ui/console-panel";
import { cn } from "@/lib/utils";
import { useTheme, type ThemePreference } from "@/features/theme/ThemeProvider";

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  description: string;
  icon: typeof Sun;
}[] = [
  { value: "system", label: "System", description: "Match your device setting", icon: Monitor },
  { value: "light", label: "Light", description: "Always use the light theme", icon: Sun },
  { value: "dark", label: "Dark", description: "Deep navy dark theme", icon: Moon },
];

const SETTINGS_SECTIONS = [
  { id: "profile", label: "Profile", icon: CircleUserRound },
  { id: "account-type", label: "Account type", icon: UserCog },
  { id: "security", label: "Password", icon: KeyRound },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "danger-zone", label: "Danger zone", icon: Trash2 },
];

const ACCOUNT_TYPE_OPTIONS: {
  value: "parent" | "tutor";
  label: string;
  description: string;
  icon: typeof Search;
}[] = [
  {
    value: "parent",
    label: "Looking for a tutor",
    description: "Find tutoring for yourself or your child.",
    icon: Search,
  },
  {
    value: "tutor",
    label: "Tutor",
    description: "Offer tutoring and find new students.",
    icon: GraduationCap,
  },
];

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
  const { user, signOut, hasRole, hasAnyRole, refreshRoles } = useAuth();
  const { theme, setTheme } = useTheme();

  const [displayName, setDisplayName] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeSection, setActiveSection] = useState("profile");

  // Internal roles are managed by admins; the account type switcher is for
  // self-serve users only.
  const isInternal = hasAnyRole(["admin", "staff", "super_admin"]);
  const currentRole: "parent" | "tutor" = hasRole("tutor") ? "tutor" : "parent";
  const [roleChoice, setRoleChoice] = useState<"parent" | "tutor">(currentRole);
  const [savingRole, setSavingRole] = useState(false);
  const roleDirty = roleChoice !== currentRole;

  useEffect(() => {
    setRoleChoice(currentRole);
  }, [currentRole]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    for (const { id } of SETTINGS_SECTIONS) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, []);

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

  async function saveAccountType() {
    if (!roleDirty || savingRole) return;
    setSavingRole(true);
    try {
      const { error } = await supabase.rpc("switch_role", { _role: roleChoice });
      if (error) throw error;
      await refreshRoles();
      toast.success("Your account type has been updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update your account type.");
    } finally {
      setSavingRole(false);
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Your new password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Your password has been updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update your password.");
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--surface-subtle)] text-[color:var(--ink)]">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <header className="border-b border-[color:var(--ink)]/10 pb-8">
            <p className="text-xs font-medium text-[color:var(--ink)]/65">Account</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[color:var(--ink)] sm:text-4xl">
              Settings
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--ink)]/70">
              Manage your profile details and account access.
            </p>
          </header>

          <div className="grid gap-10 pt-10 lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-16">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <nav className="space-y-1" aria-label="Settings sections">
                <Link
                  to="/saved-posts"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--ink)]/70 transition-colors hover:bg-[color:var(--ink)]/5 hover:text-[color:var(--ink)]"
                >
                  <Bookmark className="h-4 w-4" aria-hidden="true" />
                  Saved Posts
                </Link>
                {(isInternal
                  ? SETTINGS_SECTIONS.filter((section) => section.id !== "account-type")
                  : SETTINGS_SECTIONS
                ).map(({ id, label, icon: Icon }) => {
                  const active = activeSection === id;
                  return (
                    <a
                      key={id}
                      href={`#${id}`}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-[color:var(--ink)]/5 font-semibold text-[color:var(--ink)]"
                          : "font-medium text-[color:var(--ink)]/70 hover:bg-[color:var(--ink)]/5 hover:text-[color:var(--ink)]",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {label}
                    </a>
                  );
                })}
              </nav>
            </aside>

            <div className="min-w-0 max-w-3xl space-y-6">
              <ConsolePanel id="profile" padding="none" className="scroll-mt-28">
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
                      className="bg-[color:var(--surface)]"
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
                  <Button type="submit" disabled={loadingProfile || saving} className="font-bold">
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                </form>
              </ConsolePanel>

              {!isInternal && (
                <ConsolePanel id="account-type" padding="none" className="scroll-mt-28">
                  <div className="border-b border-[color:var(--ink)]/10 px-6 py-5 sm:px-8">
                    <h2 className="text-lg font-bold text-[color:var(--ink)]">Account type</h2>
                    <p className="mt-1 text-sm text-[color:var(--ink)]/65">
                      Choose how you use MatchMax — as a parent or student, or as a tutor. You can
                      switch anytime.
                    </p>
                  </div>
                  <div className="space-y-5 px-6 py-6 sm:px-8">
                    <div
                      role="radiogroup"
                      aria-label="Account type"
                      className="grid gap-3 sm:grid-cols-2"
                    >
                      {ACCOUNT_TYPE_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const selected = roleChoice === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={savingRole}
                            onClick={() => setRoleChoice(option.value)}
                            className={cn(
                              "relative flex flex-col items-start gap-3 rounded-xl border p-4 pr-9 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)] disabled:cursor-not-allowed disabled:opacity-60",
                              selected
                                ? "border-[color:var(--ring)] bg-[color:var(--ink)]/5"
                                : "border-[color:var(--ink)]/10 hover:bg-[color:var(--ink)]/5",
                            )}
                          >
                            <span
                              aria-hidden
                              className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center"
                            >
                              {selected ? (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--ink)]">
                                  <Check
                                    className="h-3 w-3 text-[color:var(--surface)]"
                                    strokeWidth={3}
                                  />
                                </span>
                              ) : (
                                <span className="h-5 w-5 rounded-full border-2 border-[color:var(--ink)]/20" />
                              )}
                            </span>
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--primary)]/10 text-[color:var(--primary)]">
                              <Icon className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <span className="flex flex-col gap-0.5">
                              <span className="text-sm font-bold text-[color:var(--ink)]">
                                {option.label}
                              </span>
                              <span className="text-xs leading-5 text-[color:var(--ink)]/60">
                                {option.description}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <Button
                      type="button"
                      onClick={saveAccountType}
                      disabled={!roleDirty || savingRole}
                      className="font-bold"
                    >
                      {savingRole ? "Saving…" : "Update account type"}
                    </Button>
                  </div>
                </ConsolePanel>
              )}

              <ConsolePanel id="security" padding="none" className="scroll-mt-28">
                <div className="border-b border-[color:var(--ink)]/10 px-6 py-5 sm:px-8">
                  <h2 className="text-lg font-bold text-[color:var(--ink)]">Password</h2>
                  <p className="mt-1 text-sm text-[color:var(--ink)]/65">
                    Set a new password for your MatchMax account.
                  </p>
                </div>
                <form onSubmit={changePassword} className="space-y-5 px-6 py-6 sm:px-8">
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-[color:var(--ink)]">
                      New password
                    </Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      minLength={6}
                      required
                      autoComplete="new-password"
                      className="bg-[color:var(--surface)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-new-password" className="text-[color:var(--ink)]">
                      Confirm new password
                    </Label>
                    <Input
                      id="confirm-new-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      minLength={6}
                      required
                      autoComplete="new-password"
                      className="bg-[color:var(--surface)]"
                    />
                  </div>
                  <Button type="submit" disabled={changingPassword} className="font-bold">
                    {changingPassword ? "Updating..." : "Update password"}
                  </Button>
                </form>
              </ConsolePanel>

              <ConsolePanel id="appearance" padding="none" className="scroll-mt-28">
                <div className="border-b border-[color:var(--ink)]/10 px-6 py-5 sm:px-8">
                  <h2 className="text-lg font-bold text-[color:var(--ink)]">Appearance</h2>
                  <p className="mt-1 text-sm text-[color:var(--ink)]/65">
                    Choose how MatchMax looks on this account.
                  </p>
                </div>
                <div className="grid gap-3 px-6 py-6 sm:grid-cols-3 sm:px-8">
                  {THEME_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const active = theme === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setTheme(option.value)}
                        aria-pressed={active}
                        className={cn(
                          "flex flex-col items-start gap-2 rounded-xl border px-4 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
                          active
                            ? "border-[color:var(--ring)] bg-[color:var(--ink)]/5"
                            : "border-[color:var(--ink)]/10 hover:bg-[color:var(--ink)]/5",
                        )}
                      >
                        <Icon className="h-5 w-5 text-[color:var(--ink)]" aria-hidden="true" />
                        <span className="flex items-center gap-2 text-sm font-bold text-[color:var(--ink)]">
                          {option.label}
                          {option.value === "dark" ? (
                            <Badge
                              variant="destructive"
                              className="px-1.5 py-0 text-[10px] font-bold leading-5"
                            >
                              Beta
                            </Badge>
                          ) : null}
                        </span>
                        <span className="text-xs text-[color:var(--ink)]/60">
                          {option.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </ConsolePanel>

              <section
                id="danger-zone"
                className="scroll-mt-28 rounded-2xl border border-[color:var(--ink)]/15 bg-[color:var(--surface)]"
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
                        className="shrink-0 bg-destructive font-bold text-[color:var(--destructive-foreground)] hover:bg-destructive/90"
                      >
                        Delete account
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-[color:var(--ink)]">
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
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deleting ? "Deleting…" : "Delete permanently"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </section>

              <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-[color:var(--ink)]/10 pt-5 text-sm">
                <Link to="/saved-posts" className="font-semibold text-[color:var(--ink)] underline">
                  View saved posts
                </Link>
                <Link to="/tutors" className="font-semibold text-[color:var(--ink)] underline">
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
