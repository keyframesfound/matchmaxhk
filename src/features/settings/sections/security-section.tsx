import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
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
import { PasswordStrength, usePasswordStrength } from "@/components/ui/password-strength";
import { SettingsCard } from "@/features/settings/option-card";
import type { SettingsSectionProps } from "@/features/settings/types";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function SecuritySection(_props: SettingsSectionProps) {
  const { t } = useTranslation();
  const { signOutEverywhere } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const strength = usePasswordStrength(newPassword);

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 6) {
      toast.error(t("settings.security.password_min"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("settings.security.password_mismatch"));
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      toast.success(t("settings.security.password_updated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings.security.password_error"));
    } finally {
      setChangingPassword(false);
    }
  }

  async function signOutAllDevices() {
    setSigningOutAll(true);
    try {
      await signOutEverywhere();
    } finally {
      // The global sign-out navigates away; reset in case it failed.
      setSigningOutAll(false);
    }
  }

  return (
    <div className="space-y-6">
      <SettingsCard
        title={t("settings.security.password_title")}
        description={t("settings.security.password_desc")}
      >
        <form onSubmit={changePassword} className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="new-password" className="text-[color:var(--ink)]">
                {t("settings.security.new_password")}
              </Label>
              <button
                type="button"
                onClick={() => setShowPassword((show) => !show)}
                className="flex items-center gap-1.5 text-xs font-semibold text-[color:var(--ink)]/60 transition-colors hover:text-[color:var(--ink)]"
              >
                {showPassword ? (
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {showPassword
                  ? t("settings.security.hide_password")
                  : t("settings.security.show_password")}
              </button>
            </div>
            <Input
              id="new-password"
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={6}
              required
              autoComplete="new-password"
              className="bg-[color:var(--surface)]"
            />
            {newPassword ? <PasswordStrength value={newPassword} showRules={false} /> : null}
          </div>
          {newPassword ? (
            <div className="space-y-1.5 rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink)]/55">
                {t("settings.security.password_rules")}
              </p>
              <ul className="space-y-1">
                {strength.rules.map((rule) => (
                  <li
                    key={rule.id}
                    className={
                      rule.met
                        ? "text-xs font-semibold text-[color:var(--success)]"
                        : "text-xs text-[color:var(--ink)]/60"
                    }
                  >
                    {rule.met ? "✓" : "•"} {rule.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="confirm-new-password" className="text-[color:var(--ink)]">
              {t("settings.security.confirm_password")}
            </Label>
            <Input
              id="confirm-new-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={6}
              required
              autoComplete="new-password"
              className="bg-[color:var(--surface)]"
            />
          </div>
          <Button type="submit" disabled={changingPassword} className="font-bold">
            {changingPassword
              ? t("settings.security.updating_password")
              : t("settings.security.update_password")}
          </Button>
        </form>
      </SettingsCard>

      <SettingsCard
        title={t("settings.security.sessions_title")}
        description={t("settings.security.sessions_desc")}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-sm leading-6 text-[color:var(--ink)]/70">
            {t("settings.security.sessions_body")}
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={signingOutAll}
                className="shrink-0 border-[color:var(--ink)]/15 font-bold text-[color:var(--ink)] hover:bg-[color:var(--ink)]/5"
              >
                {t("settings.security.sign_out_all")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-[color:var(--ink)]">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-[color:var(--ink)]">
                  {t("settings.security.sign_out_all_confirm_title")}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[color:var(--ink)]/70">
                  {t("settings.security.sign_out_all_confirm_desc")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={signingOutAll}>
                  {t("settings.security.cancel")}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault();
                    void signOutAllDevices();
                  }}
                  disabled={signingOutAll}
                  className="font-bold"
                >
                  {t("settings.security.sign_out_all_confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </SettingsCard>
    </div>
  );
}
