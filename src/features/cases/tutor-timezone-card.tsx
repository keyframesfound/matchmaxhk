import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  resolveTutorTimezone,
  timezoneLabel,
  TUTOR_TIMEZONE_OPTIONS,
} from "@/features/cases/tutor-timezone";

/**
 * #798: the zone the tutor's weekly availability grid is read in.
 *
 * Only the zone is stored; lesson rows are timestamptz and stay absolute.
 * Default is Asia/Hong_Kong, so a tutor who never opens this keeps today's
 * behaviour exactly.
 */
export function TutorTimezoneCard({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ["settings", "tutor-timezone", userId] as const;

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutors")
        .select("timezone" as never)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return resolveTutorTimezone((data as { timezone?: string | null } | null)?.timezone ?? null);
    },
  });

  const save = useMutation({
    mutationFn: async (zone: string) => {
      const { error } = await supabase
        .from("tutors")
        .update({ timezone: zone } as never)
        .eq("user_id", userId);
      if (error) throw error;
      return zone;
    },
    onSuccess: (zone) => {
      queryClient.setQueryData(queryKey, zone);
      void queryClient.invalidateQueries({ queryKey: ["tutors", "published"] });
      toast.success(t("settings.my_tutor.timezone_saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const current = query.data ?? resolveTutorTimezone(null);

  return (
    <div className="rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label
            htmlFor="tutor-timezone"
            className="flex items-center gap-1.5 text-sm font-bold text-[color:var(--ink)]"
          >
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {t("settings.my_tutor.timezone_label")}
          </Label>
          <p className="mt-0.5 text-xs leading-5 text-[color:var(--ink)]/60">
            {t("settings.my_tutor.timezone_hint")}
          </p>
        </div>
        <select
          id="tutor-timezone"
          value={current}
          disabled={query.isLoading || save.isPending}
          onChange={(event) => save.mutate(event.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {TUTOR_TIMEZONE_OPTIONS.map((zone) => (
            <option key={zone} value={zone}>
              {timezoneLabel(zone)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
