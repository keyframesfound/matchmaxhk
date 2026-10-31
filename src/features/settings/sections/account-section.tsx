import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { BookOpen, GraduationCap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsCard } from "@/features/settings/option-card";
import type { SettingsSectionProps } from "@/features/settings/types";
import { useAuth } from "@/features/auth/useAuth";
import { useMyOrganization } from "@/features/business/useMyOrganization";
import { supabase } from "@/integrations/supabase/client";

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
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-[color:var(--ink)]">{value}</span>
    </div>
  );
}

export function AccountSection({ user, profile, updateProfile }: SettingsSectionProps) {
  const { t, i18n } = useTranslation();
  const { hasRole, hasAnyRole } = useAuth();
  const { membership } = useMyOrganization();
  const isInternal = hasAnyRole(["admin", "staff", "super_admin"]);
  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);

  const dateLocale = i18n.language?.startsWith("zh") ? "zh-HK" : "en-HK";
  const provider =
    typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : "email";
  const memberSince = formatDate(user.created_at ?? null, dateLocale);
  const tosAccepted = formatDate(profile?.tos_accepted_at ?? null, dateLocale);

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
        toast.success(t("settings.account.email_changed"));
      } else {
        toast.success(t("settings.account.email_change_sent"));
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("settings.account.email_change_error"),
      );
    } finally {
      setChangingEmail(false);
    }
  }

  return (
    <div className="space-y-6">
      <SettingsCard title={t("settings.account.overview_title")}>
        <div className="space-y-3">
          <OverviewRow
            label={t("settings.account.sign_in_method")}
            value={
              provider === "google"
                ? t("settings.account.sign_in_google")
                : t("settings.account.sign_in_password")
            }
          />
          {memberSince ? (
            <OverviewRow label={t("settings.account.member_since")} value={memberSince} />
          ) : null}
          <OverviewRow
            label={t("settings.account.tos_accepted")}
            value={
              tosAccepted ?? (
                <span className="font-medium text-[color:var(--ink)]/55">
                  {t("settings.account.tos_not_accepted")}
                </span>
              )
            }
          />
          {membership ? (
            <OverviewRow
              label={t("settings.account.business_label")}
              value={
                <Link
                  to="/business"
                  search={{ tab: undefined }}
                  className="font-semibold text-[color:var(--brand-link)] underline underline-offset-2"
                >
                  {t("settings.account.business_link")}
                </Link>
              }
            />
          ) : null}
        </div>
      </SettingsCard>

      <SettingsCard
        title={t("settings.account.email_title")}
        description={t("settings.account.email_desc")}
      >
        <form onSubmit={changeEmail} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="settings-current-email" className="text-[color:var(--ink)]">
              {t("settings.account.email_current")}
            </Label>
            <Input
              id="settings-current-email"
              value={user.email ?? ""}
              disabled
              readOnly
              className="border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] text-muted-foreground"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-new-email" className="text-[color:var(--ink)]">
              {t("settings.account.email_new")}
            </Label>
            <Input
              id="settings-new-email"
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder={t("settings.account.email_new_placeholder")}
              autoComplete="email"
              required
              className="bg-[color:var(--surface)]"
            />
            <p className="text-xs text-[color:var(--ink)]/55">
              {t("settings.account.email_change_hint")}
            </p>
          </div>
          <Button type="submit" disabled={changingEmail} className="font-bold">
            {changingEmail
              ? t("settings.account.email_changing")
              : t("settings.account.email_change")}
          </Button>
        </form>
      </SettingsCard>

      {/* #459 §F: additive capabilities replace the old exclusive "account
          type" switch. Mode switching lives in the header; nothing here can
          remove a role or its data. */}
      {!isInternal && (
        <SettingsCard
          title={t("settings.account.capabilities_title")}
          description={t("settings.account.capabilities_desc")}
        >
          <ul className="divide-y divide-border">
            <CapabilityRow
              icon={BookOpen}
              label={t("settings.account.cap_learning")}
              description={t("settings.account.cap_learning_desc")}
              action={<ActiveBadge />}
            />
            <CapabilityRow
              icon={GraduationCap}
              label={t("settings.account.cap_teaching")}
              description={t("settings.account.cap_teaching_desc")}
              action={
                hasRole("tutor") ? (
                  <div className="flex items-center gap-3">
                    <ActiveBadge />
                    <Link
                      to="/account"
                      className="text-sm font-semibold text-[color:var(--brand-link)] underline underline-offset-2"
                    >
                      {t("settings.account.cap_manage")}
                    </Link>
                  </div>
                ) : (
                  <Button asChild variant="outline" size="sm" className="font-bold">
                    <Link to="/join">{t("settings.account.cap_activate")}</Link>
                  </Button>
                )
              }
            />
          </ul>
        </SettingsCard>
      )}
    </div>
  );
}

function ActiveBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center rounded-full border border-[color:var(--success)]/30 bg-[color:var(--success)]/10 px-2.5 py-0.5 text-xs font-semibold text-[color:var(--success)]">
      {t("settings.account.cap_active")}
    </span>
  );
}

function CapabilityRow({
  icon: Icon,
  label,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--primary)]/10 text-[color:var(--primary)]">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[color:var(--ink)]">{label}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </li>
  );
}
