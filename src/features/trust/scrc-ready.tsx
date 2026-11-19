import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

/**
 * #782 §2.2 (was #755): optional SCRC Ready self-declaration. Only a boolean
 * is stored; MatchMax never collects the certificate, enquiry code or HKID.
 * Distinct from Blue Tick (#575): its own icon, colour and wording.
 */
export function ScrcReadyPill({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-violet-300 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-800 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-200 ${className}`}
      title={t("scrc.pill_hint")}
    >
      <ShieldCheck className="h-3 w-3" aria-hidden />
      {t("scrc.pill")}
    </span>
  );
}

/** Settings card: the tutor toggles SCRC Ready on their own card. */
export function ScrcReadyCard({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ["settings", "scrc-ready", userId] as const;

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutors")
        .select("scrc_ready" as never)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return (data as { scrc_ready?: boolean } | null)?.scrc_ready === true;
    },
  });

  const save = useMutation({
    mutationFn: async (checked: boolean) => {
      const { error } = await supabase
        .from("tutors")
        .update({ scrc_ready: checked } as never)
        .eq("user_id", userId);
      if (error) throw error;
      return checked;
    },
    onSuccess: (checked) => {
      queryClient.setQueryData(queryKey, checked);
      void queryClient.invalidateQueries({ queryKey: ["tutors", "published"] });
      toast.success(t(checked ? "scrc.on_toast" : "scrc.off_toast"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] px-4 py-3">
      <div>
        <Label htmlFor="scrc-ready" className="text-sm font-bold text-[color:var(--ink)]">
          {t("scrc.toggle_label")}
        </Label>
        <p className="mt-0.5 text-xs leading-5 text-[color:var(--ink)]/60">
          {t("scrc.toggle_hint")}
        </p>
      </div>
      <Switch
        id="scrc-ready"
        checked={query.data === true}
        disabled={query.isLoading || save.isPending}
        onCheckedChange={(checked) => save.mutate(checked)}
        aria-label={t("scrc.toggle_label")}
      />
    </div>
  );
}
