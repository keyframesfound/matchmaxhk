import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Check, GraduationCap, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsCard, OptionCard, OptionCardGroup } from "@/features/settings/option-card";
import type { SettingsSectionProps } from "@/features/settings/types";
import { useAuth } from "@/features/auth/useAuth";
import { useMyOrganization } from "@/features/business/useMyOrganization";
import { supabase } from "@/integrations/supabase/client";

const ACCOUNT_TYPE_OPTIONS = [
  {
    value: "parent" as const,
    labelKey: "account.type_parent",
    descKey: "account.type_parent_desc",
    icon: Search,
  },
  {
    value: "tutor" as const,
    labelKey: "account.type_tutor",
    descKey: "account.type_tutor_desc",
    icon: GraduationCap,
  },
];

function formatDate(value: string | null, locale: string) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(locale === "zh-HK" ? "zh-HK" : "en-HK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function OverviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <span className="text-sm font-semibold text-[color:var(--ink)]/70">{label}</span>
      <span className="text-sm font-bold text-[color:var(--ink)]">{value}</span>
    </div>
  );
}

export function AccountSection({ user, profile, updateProfile }: SettingsSectionProps) {
  const { t, i18n } = useTranslation("settings");
  const { hasRole, hasAnyRole, refreshRoles } = useAuth();
  const { membership } = useMyOrganization();
  const isInternal = hasAnyRole(["admin", "staff", "super_admin"]);
  const currentRole: "parent" | "tutor" = hasRole("tutor") ? "tutor" : "parent";
  const [roleChoice, setRoleChoice] = useState<"parent" | "tutor">(currentRole);
  const [savingRole, setSavingRole] = useState(false);
  const roleDirty = roleChoice !== currentRole;

  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);

  useEffect(() => {
    setRoleChoice(currentRole);
  }, [currentRole]);

  const dateLocale = i18n.language?.startsWith("zh") ? "zh-HK" : "en-HK";
  const provider =
    typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : "email";
  const memberSince = formatDate(user.created_at ?? null, dateLocale);
  const tosAccepted = formatDate(profile?.tos_accepted_at ?? null, dateLocale);

  async function saveAccountType() {
    if (!roleDirty || savingRole) return;
    setSavingRole(true);
    try {
      const { error } = await supabase.rpc("switch_role", { _role: roleChoice });
      if (error) throw error;
      await refreshRoles();
      toast.success(t("account.type_saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("account.type_error"));
    } finally {
      setSavingRole(false);
    }
  }

  async function changeEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = newEmail.trim().toLowerCase();
    if (!nextEmail || nextEmail === (user.email ?? "").toLowerCase()) return;
    setChangingEmail(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ email: nextEmail });
      if (error) throw error;
      setNewEmail("");
      // With email confirmation enabled the change only lands after the user
      // clicks the link Resend emails them; without it the update is instant.
      if (data.user?.email?.toLowerCase() === nextEmail) {
        toast.success(t("account.email_changed"));
      } else {
        toast.success(t("account.email_change_sent"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("account.email_change_error"));
    } finally {
      setChangingEmail(false);
    }
  }

  return (
    <div className="space-y-6">
      <SettingsCard title={t("account.overview_title")}>
        <div className="space-y-3">
          <OverviewRow
            label={t("account.sign_in_method")}
            value={
              provider === "google" ? t("account.sign_in_google") : t("account.sign_in_password")
            }
          />
          {memberSince ? (
            <OverviewRow label={t("account.member_since")} value={memberSince} />
          ) : null}
          <OverviewRow
            label={t("account.tos_accepted")}
            value={
              tosAccepted ?? (
                <span className="font-medium text-[color:var(--ink)]/55">
                  {t("account.tos_not_accepted")}
                </span>
              )
            }
          />
          {membership ? (
            <OverviewRow
              label={t("account.business_label")}
              value={
                <Link
                  to="/business"
                  search={{ tab: undefined }}
                  className="font-semibold text-[color:var(--brand-link)] underline underline-offset-2"
                >
                  {t("account.business_link")}
                </Link>
              }
            />
          ) : null}
        </div>
      </SettingsCard>

      <SettingsCard title={t("account.email_title")} description={t("account.email_desc")}>
        <form onSubmit={changeEmail} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="settings-current-email" className="text-[color:var(--ink)]">
              {t("account.email_current")}
            </Label>
            <Input
              id="settings-current-email"
              value={user.email ?? ""}
              disabled
              readOnly
              className="border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] text-[color:var(--ink)]/60"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-new-email" className="text-[color:var(--ink)]">
              {t("account.email_new")}
            </Label>
            <Input
              id="settings-new-email"
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder={t("account.email_new_placeholder")}
              autoComplete="email"
              required
              className="bg-[color:var(--surface)]"
            />
            <p className="text-xs text-[color:var(--ink)]/55">{t("account.email_change_hint")}</p>
          </div>
          <Button type="submit" disabled={changingEmail} className="font-bold">
            {changingEmail ? t("account.email_changing") : t("account.email_change")}
          </Button>
        </form>
      </SettingsCard>

      {!isInternal && (
        <SettingsCard title={t("account.type_title")} description={t("account.type_desc")}>
          <div className="space-y-5">
            <OptionCardGroup label={t("account.type_title")} columns={2}>
              {ACCOUNT_TYPE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = roleChoice === option.value;
                return (
                  <OptionCard
                    key={option.value}
                    selected={selected}
                    onSelect={() => setRoleChoice(option.value)}
                    label={t(option.labelKey)}
                    description={t(option.descKey)}
                    disabled={savingRole}
                    preview={
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--primary)]/10 text-[color:var(--primary)]">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                    }
                    className="pr-9"
                    badge={
                      selected ? (
                        <span
                          aria-hidden
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--ink)]"
                        >
                          <Check className="h-3 w-3 text-[color:var(--surface)]" strokeWidth={3} />
                        </span>
                      ) : undefined
                    }
                  />
                );
              })}
            </OptionCardGroup>
            <Button
              type="button"
              onClick={saveAccountType}
              disabled={!roleDirty || savingRole}
              className="font-bold"
            >
              {savingRole ? t("account.type_saving") : t("account.type_update")}
            </Button>
          </div>
        </SettingsCard>
      )}
    </div>
  );
}
