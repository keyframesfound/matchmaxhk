import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { SettingsCard } from "@/features/settings/option-card";
import type { SettingsSectionProps } from "@/features/settings/types";
import { useAuth } from "@/features/auth/useAuth";
import { deleteMyAccount } from "@/lib/account.functions";

export function DangerZoneSection(_props: SettingsSectionProps) {
  const { t } = useTranslation("settings");
  const { signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);

  async function deleteAccount() {
    setDeleting(true);
    try {
      await deleteMyAccount({ data: {} });
      toast.success(t("danger.deleted"));
      await signOut();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("danger.delete_error"));
      setDeleting(false);
    }
  }

  return (
    <SettingsCard
      title={t("danger.title")}
      description={t("danger.description")}
      className="border-[color:var(--destructive)]/40"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm leading-6 text-[color:var(--ink)]/70">{t("danger.body")}</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              disabled={deleting}
              className="shrink-0 bg-destructive font-bold text-[color:var(--destructive-foreground)] hover:bg-destructive/90"
            >
              {t("danger.delete")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-[color:var(--ink)]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[color:var(--ink)]">
                {t("danger.confirm_title")}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[color:var(--ink)]/70">
                {t("danger.confirm_desc")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>{t("danger.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void deleteAccount();
                }}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? t("danger.deleting") : t("danger.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SettingsCard>
  );
}
