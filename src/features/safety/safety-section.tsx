import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsCard } from "@/features/settings/option-card";
import { supabase } from "@/integrations/supabase/client";
import { deleteTrustedContact, saveTrustedContact } from "@/features/safety/safety.functions";
import {
  TRUSTED_CONTACT_NAME_MAX,
  TRUSTED_CONTACT_PHONE_MAX,
  validateTrustedContact,
  type TrustedContact,
} from "@/features/safety/safety-share";

/**
 * Issue #650 Account → Safety: the parent may save ONE trusted contact
 * (CEO lock, max 1 in V1) — display name + phone, PDPO-minimised, editable
 * and deletable anytime, never required to book.
 *
 * Writes go through the service-role server fns (safety.functions.ts) — the
 * table has zero client-write grants. Reads use the owner-SELECT RLS policy.
 * Pre-migration tolerance: the trusted_contacts table may not exist yet, so
 * a failed read renders the empty state instead of breaking the settings
 * page; a failed save surfaces a toast, never a 500.
 */

const CONTACT_QUERY_KEY = "safety-trusted-contact";

export function SafetySection({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const contactQuery = useQuery({
    queryKey: [CONTACT_QUERY_KEY, userId],
    queryFn: async (): Promise<TrustedContact | null> => {
      try {
        const { data, error } = await supabase
          .from("trusted_contacts")
          .select("id, parent_id, display_name, phone, created_at, updated_at")
          .eq("parent_id", userId)
          .maybeSingle();
        if (error) return null; // Missing table / RLS change: empty state, no crash.
        return (data as TrustedContact | null) ?? null;
      } catch {
        return null;
      }
    },
  });

  const contact = contactQuery.data ?? null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [CONTACT_QUERY_KEY, userId] });

  const save = useMutation({
    mutationFn: () => saveTrustedContact({ data: { displayName: name, phone } }),
    onSuccess: async () => {
      toast.success(t("safety.saved"));
      setName("");
      setPhone("");
      setEditing(false);
      await invalidate();
    },
    onError: (e) => {
      if (e.message === "SAFETY_NAME_REQUIRED") toast.error(t("safety.name_required"));
      else if (e.message === "SAFETY_PHONE_INVALID") toast.error(t("safety.invalid_phone"));
      else toast.error(t("safety.save_error"));
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteTrustedContact(),
    onSuccess: async () => {
      toast.success(t("safety.deleted"));
      setName("");
      setPhone("");
      setEditing(false);
      await invalidate();
    },
    onError: () => toast.error(t("safety.delete_error")),
  });

  const startEdit = (existing: TrustedContact) => {
    setName(existing.display_name);
    setPhone(existing.phone);
    setEditing(true);
  };

  const resetForm = () => {
    setName("");
    setPhone("");
    setEditing(false);
  };

  const submit = () => {
    // Client-side pre-check mirrors the server fn (same shared validator);
    // the server re-validates fail-closed.
    const validated = validateTrustedContact(name, phone);
    if (!validated.ok) {
      toast.error(
        validated.reason === "name_required"
          ? t("safety.name_required")
          : t("safety.invalid_phone"),
      );
      return;
    }
    save.mutate();
  };

  return (
    <SettingsCard title={t("safety.contact_title")} description={t("safety.contact_helper")}>
      {contactQuery.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : contact && !editing ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-[color:var(--ink)]/10 p-4">
            <p className="text-sm font-semibold text-[color:var(--ink)]">{contact.display_name}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{contact.phone}</p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => startEdit(contact)}
              className="gap-2 border-[color:var(--ink)]/15 font-bold text-[color:var(--ink)] hover:bg-[color:var(--ink)]/5"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {t("safety.edit")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(t("safety.delete_confirm"))) remove.mutate();
              }}
              className="gap-2 font-bold text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {t("safety.delete")}
            </Button>
          </div>
        </div>
      ) : !contact && !editing ? (
        <EmptyState
          icon={ShieldCheck}
          title={t("safety.empty_title")}
          description={t("safety.empty_desc")}
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(true)}
              className="border-[color:var(--ink)]/15 font-bold text-[color:var(--ink)] hover:bg-[color:var(--ink)]/5"
            >
              {t("safety.add_contact")}
            </Button>
          }
        />
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="safety-contact-name">{t("safety.name_label")}</Label>
            <Input
              id="safety-contact-name"
              value={name}
              maxLength={TRUSTED_CONTACT_NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("safety.name_ph")}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="safety-contact-phone">{t("safety.phone_label")}</Label>
            <Input
              id="safety-contact-phone"
              value={phone}
              maxLength={TRUSTED_CONTACT_PHONE_MAX}
              inputMode="tel"
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("safety.phone_ph")}
              autoComplete="off"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending} className="font-bold">
              {save.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t("safety.save")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={resetForm}
              className="font-bold text-muted-foreground"
            >
              {t("safety.cancel")}
            </Button>
          </div>
        </form>
      )}
    </SettingsCard>
  );
}
