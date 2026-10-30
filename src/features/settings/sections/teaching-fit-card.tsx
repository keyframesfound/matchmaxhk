import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  FIT_TAG_COLUMNS,
  FIT_TAG_KEYS,
  FIT_TAG_OPTIONS,
  fitTagsFromRow,
  type FitTagKey,
  type FitTags,
} from "@/features/cases/fit-tags";

/**
 * Issue #528 Phase A: optional tutor soft tags (< 15s). Writes the PUBLIC
 * tutors columns under owner RLS, like the #520 offers card. The desk compares
 * them with the parent's tags as a soft hint; nothing here is a survey.
 */

const TAG_LABEL_KEY: Record<FitTagKey, string> = {
  teachingStyle: "settings.my_tutor.fit_teaching_style",
  materialsPolicy: "settings.my_tutor.fit_materials_policy",
  vibe: "settings.my_tutor.fit_vibe",
  homework: "settings.my_tutor.fit_homework",
};

const VALUE_LABEL_KEY: Record<string, string> = {
  EXAM_DRILLING: "settings.my_tutor.fit_EXAM_DRILLING",
  CONCEPT_PATIENCE: "settings.my_tutor.fit_CONCEPT_PATIENCE",
  HOMEWORK_COACHING: "settings.my_tutor.fit_HOMEWORK_COACHING",
  PROVIDES_OWN_NOTES: "settings.my_tutor.fit_PROVIDES_OWN_NOTES",
  USES_SCHOOL_MATERIALS: "settings.my_tutor.fit_USES_SCHOOL_MATERIALS",
  STRICT_DISCIPLINED: "settings.my_tutor.fit_STRICT_DISCIPLINED",
  WARM_ENCOURAGING: "settings.my_tutor.fit_WARM_ENCOURAGING",
  WEEKLY_EXTRA_HOMEWORK: "settings.my_tutor.fit_WEEKLY_EXTRA_HOMEWORK",
  IN_CLASS_ONLY: "settings.my_tutor.fit_IN_CLASS_ONLY",
};

const COLUMNS = FIT_TAG_KEYS.map((k) => FIT_TAG_COLUMNS[k].tutor).join(", ");

export function TeachingFitCard({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ["settings", "teaching-fit", userId];

  const { data: tags } = useQuery({
    queryKey,
    queryFn: async (): Promise<FitTags | null> => {
      const { data, error } = await supabase
        .from("tutors")
        .select(COLUMNS)
        .eq("user_id", userId)
        .maybeSingle();
      // Pre-migration the columns do not exist: hide the card, never crash settings.
      if (error || !data) return null;
      return fitTagsFromRow(data as unknown as Record<string, unknown>, "tutor");
    },
  });

  const save = useMutation({
    mutationFn: async (patch: Record<string, string | null>) => {
      const { error } = await supabase
        .from("tutors")
        .update(patch as never)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("settings.my_tutor.fit_saved"));
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!tags) return null;

  return (
    <div className="space-y-3 rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] px-4 py-3">
      <div>
        <Label className="text-sm font-bold text-[color:var(--ink)]">
          {t("settings.my_tutor.fit_title")}
        </Label>
        <p className="mt-0.5 text-xs text-[color:var(--ink)]/60">
          {t("settings.my_tutor.fit_hint")}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIT_TAG_KEYS.map((key) => (
          <div key={key}>
            <Label className="text-xs font-medium text-[color:var(--ink)]/70">
              {t(TAG_LABEL_KEY[key])}
            </Label>
            <select
              value={tags[key] ?? ""}
              disabled={save.isPending}
              onChange={(e) =>
                save.mutate({ [FIT_TAG_COLUMNS[key].tutor]: e.target.value || null })
              }
              className="mt-1 h-9 w-full rounded-xl border border-input bg-transparent px-2 text-sm"
              aria-label={t(TAG_LABEL_KEY[key])}
            >
              <option value="">{t("settings.my_tutor.fit_not_set")}</option>
              {FIT_TAG_OPTIONS[key].map((v) => (
                <option key={v} value={v}>
                  {t(VALUE_LABEL_KEY[v])}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
