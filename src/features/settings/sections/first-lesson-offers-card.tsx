import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

/**
 * Issue #520: tutor-set first-lesson offers. Toggles write the PUBLIC
 * tutors columns (owner RLS, like the is_published toggle); the badges on
 * the public card read the same columns. The admin fee is never discounted.
 */

const DISCOUNT_OPTIONS = [50, 30, 20] as const;

type Offers = {
  offers_free_trial: boolean;
  offers_first_lesson_discount: boolean;
  first_lesson_discount_pct: number;
};

const COLUMNS = "offers_free_trial, offers_first_lesson_discount, first_lesson_discount_pct";

export function FirstLessonOffersCard({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ["settings", "first-lesson-offers", userId];

  const { data: offers } = useQuery({
    queryKey,
    queryFn: async (): Promise<Offers | null> => {
      const { data, error } = await supabase
        .from("tutors")
        .select(COLUMNS)
        .eq("user_id", userId)
        .maybeSingle();
      // Pre-migration the columns do not exist: hide the card, never crash settings.
      if (error) return null;
      const row = data as unknown as Partial<Offers> | null;
      if (!row) return null;
      return {
        offers_free_trial: row.offers_free_trial === true,
        offers_first_lesson_discount: row.offers_first_lesson_discount === true,
        first_lesson_discount_pct: Number(row.first_lesson_discount_pct) || 50,
      };
    },
  });

  const save = useMutation({
    mutationFn: async (patch: Partial<Offers>) => {
      const { error } = await supabase
        .from("tutors")
        .update(patch as never)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("settings.my_tutor.promo_saved"));
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ["tutors", "published"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!offers) return null;

  return (
    <div className="space-y-3 rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] px-4 py-3">
      <div>
        <Label className="text-sm font-bold text-[color:var(--ink)]">
          {t("settings.my_tutor.promo_title")}
        </Label>
        <p className="mt-0.5 text-xs text-[color:var(--ink)]/60">
          {t("settings.my_tutor.promo_hint")}
        </p>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[color:var(--ink)]">
            {t("settings.my_tutor.free_trial_label")}
          </p>
          <p className="text-xs text-[color:var(--ink)]/60">
            {t("settings.my_tutor.free_trial_hint")}
          </p>
        </div>
        <Switch
          checked={offers.offers_free_trial}
          disabled={save.isPending}
          onCheckedChange={(checked) => save.mutate({ offers_free_trial: checked })}
          aria-label={t("settings.my_tutor.free_trial_label")}
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[color:var(--ink)]">
            {t("settings.my_tutor.discount_label")}
          </p>
          <p className="text-xs text-[color:var(--ink)]/60">
            {t("settings.my_tutor.discount_hint")}
          </p>
        </div>
        <Switch
          checked={offers.offers_first_lesson_discount}
          disabled={save.isPending}
          onCheckedChange={(checked) => save.mutate({ offers_first_lesson_discount: checked })}
          aria-label={t("settings.my_tutor.discount_label")}
        />
      </div>
      {offers.offers_first_lesson_discount ? (
        <div>
          <Label className="text-xs font-medium text-[color:var(--ink)]/70">
            {t("settings.my_tutor.discount_pct_label")}
          </Label>
          <select
            value={offers.first_lesson_discount_pct}
            disabled={save.isPending}
            onChange={(e) => save.mutate({ first_lesson_discount_pct: Number(e.target.value) })}
            className="mt-1 h-9 w-full rounded-xl border border-input bg-transparent px-2 text-sm"
            aria-label={t("settings.my_tutor.discount_pct_label")}
          >
            {DISCOUNT_OPTIONS.map((pct) => (
              <option key={pct} value={pct}>
                {pct}%
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <p className="text-xs text-[color:var(--ink)]/60">
        {t("settings.my_tutor.drop_protection_note")}
      </p>
    </div>
  );
}
