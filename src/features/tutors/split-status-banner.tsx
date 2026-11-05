import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";

import { SplitSquareHorizontal } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { isLegacyBundledStatus } from "@/features/tutors/status-taxonomy";
import { cn } from "@/lib/utils";

/**
 * Issue #658 §2.2: the 1-tap split banner for tutors whose card still stores
 * the legacy bundled Full/Part-Time value. Shown on the next login / profile
 * edit (mounted on the settings shell) until the tutor picks a side — the
 * pick writes the chosen code through the split_tutor_status RPC, which
 * clears the legacy bundling, and the banner disappears with it (visibility
 * IS the dismissal: non-blocking, no dead-end modal).
 */

export function TutorStatusSplitBanner({ tutorStatus }: { tutorStatus: string | null }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<"full_time" | "part_time" | null>(null);
  const [failed, setFailed] = useState(false);

  if (!isLegacyBundledStatus(tutorStatus)) return null;

  const choose = async (status: "full_time" | "part_time") => {
    setSaving(status);
    setFailed(false);
    const { error } = await supabase.rpc("split_tutor_status", { p_status: status });
    if (error) {
      console.error("[split-status] RPC failed:", error.message);
      setSaving(null);
      setFailed(true);
      return;
    }
    // The stored code changed; refetch the tutor-link query the banner is
    // driven from. The banner unmounts on its own (legacy value gone).
    await queryClient.invalidateQueries({ queryKey: ["settings", "tutor-link"] });
    setSaving(null);
  };

  const choiceButton = (status: "full_time" | "part_time", labelKey: string) => (
    <button
      key={status}
      type="button"
      disabled={saving !== null}
      onClick={() => void choose(status)}
      className={cn(
        "inline-flex h-9 items-center rounded-full border border-[color:var(--ink)]/20 bg-[color:var(--surface)] px-4 text-sm font-bold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--ink)]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
        saving !== null && "cursor-not-allowed opacity-60",
      )}
    >
      {saving === status ? t("tutor_status.banner_saving") : t(labelKey)}
    </button>
  );

  return (
    <section
      aria-label={t("tutor_status.banner_prompt")}
      className="rounded-xl border border-[color:var(--ink)]/15 bg-[color:var(--surface)] p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm font-semibold text-[color:var(--ink)]">
          <SplitSquareHorizontal
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          {t("tutor_status.banner_prompt")}
        </p>
        <div className="flex flex-wrap items-center gap-2 pl-6 sm:pl-0">
          {choiceButton("full_time", "tutor_status.banner_cta_full_time")}
          {choiceButton("part_time", "tutor_status.banner_cta_part_time")}
        </div>
      </div>
      {failed ? (
        <p className="mt-2 pl-6 text-xs font-semibold text-destructive">
          {t("tutor_status.banner_error")}
        </p>
      ) : null}
    </section>
  );
}
