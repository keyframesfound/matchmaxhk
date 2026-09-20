import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsCard } from "@/features/settings/option-card";
import { isValidPhone, type SettingsSectionProps } from "@/features/settings/types";

export function ProfileSection({ user, profile, updateProfile }: SettingsSectionProps) {
  const { t } = useTranslation("settings");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setPhone(profile.phone ?? "");
  }, [profile]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = displayName.trim();
    if (!nextName) {
      toast.error(t("profile.name_required"));
      return;
    }
    const nextPhone = phone.trim();
    if (nextPhone && !isValidPhone(nextPhone)) {
      toast.error(t("profile.phone_invalid"));
      return;
    }
    setSaving(true);
    const ok = await updateProfile({
      display_name: nextName,
      phone: nextPhone || null,
    });
    setSaving(false);
    if (ok) toast.success(t("profile.saved"));
  }

  return (
    <SettingsCard title={t("profile.title")} description={t("profile.description")}>
      <form onSubmit={save} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="settings-name" className="text-[color:var(--ink)]">
            {t("profile.name")}
          </Label>
          <Input
            id="settings-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={t("profile.name_placeholder")}
            maxLength={80}
            disabled={!profile || saving}
            autoComplete="name"
            className="bg-[color:var(--surface)]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-phone" className="text-[color:var(--ink)]">
            {t("profile.phone")}
          </Label>
          <Input
            id="settings-phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder={t("profile.phone_placeholder")}
            maxLength={20}
            disabled={!profile || saving}
            autoComplete="tel"
            className="bg-[color:var(--surface)]"
          />
          <p className="text-xs text-[color:var(--ink)]/55">{t("profile.phone_hint")}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-email" className="text-[color:var(--ink)]">
            {t("profile.email")}
          </Label>
          <Input
            id="settings-email"
            value={user?.email ?? ""}
            disabled
            readOnly
            className="border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] text-[color:var(--ink)]/60"
          />
          <p className="text-xs text-[color:var(--ink)]/55">{t("profile.email_readonly_hint")}</p>
        </div>
        <Button type="submit" disabled={!profile || saving} className="font-bold">
          {saving ? t("profile.saving") : t("profile.save")}
        </Button>
      </form>
    </SettingsCard>
  );
}
