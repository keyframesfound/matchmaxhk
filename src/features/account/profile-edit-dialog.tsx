import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidPhone } from "@/features/settings/types";
import { supabase } from "@/integrations/supabase/client";

/**
 * #501: the Account home edit-profile dialog. Display name and phone edit
 * here on /account now; Settings no longer hosts personal profile editing.
 * Same profiles-row fields the old Settings Profile tab edited.
 */
export function ProfileEditDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["account", "profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, phone")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as { display_name: string | null; phone: string | null } | null;
    },
    enabled: open && Boolean(userId),
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    setDisplayName(profileQuery.data.display_name ?? "");
    setPhone(profileQuery.data.phone ?? "");
  }, [profileQuery.data]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = displayName.trim();
    if (!nextName) {
      toast.error(t("account.profile_edit.name_required"));
      return;
    }
    const nextPhone = phone.trim();
    if (nextPhone && !isValidPhone(nextPhone)) {
      toast.error(t("account.profile_edit.phone_invalid"));
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: nextName, phone: nextPhone || null })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["account", "profile", userId] });
    toast.success(t("account.profile_edit.saved"));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("account.profile_edit.title")}</DialogTitle>
          <DialogDescription>{t("account.profile_edit.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="account-name" className="text-[color:var(--ink)]">
              {t("account.profile_edit.name")}
            </Label>
            <Input
              id="account-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={t("account.profile_edit.name_placeholder")}
              maxLength={80}
              disabled={!profileQuery.data || saving}
              autoComplete="name"
              className="bg-[color:var(--surface)]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-phone" className="text-[color:var(--ink)]">
              {t("account.profile_edit.phone")}
            </Label>
            <Input
              id="account-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder={t("account.profile_edit.phone_placeholder")}
              maxLength={20}
              disabled={!profileQuery.data || saving}
              autoComplete="tel"
              className="bg-[color:var(--surface)]"
            />
            <p className="text-xs text-[color:var(--ink)]/55">
              {t("account.profile_edit.phone_hint")}
            </p>
          </div>
          <Button type="submit" disabled={!profileQuery.data || saving} className="font-bold">
            {saving ? t("account.profile_edit.saving") : t("account.profile_edit.save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
