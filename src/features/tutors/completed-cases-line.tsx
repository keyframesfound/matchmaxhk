// Issue #503, completed-case count on the PUBLIC tutor profile (minimal
// profile-counts slice; the #459 hours ledger is a separate build).
//
// Reads the anon-executable SECURITY DEFINER RPC get_tutor_completed_case_count
// (migration 20261028120000) straight from the client — the same tolerant
// pattern as experience-badge / review-summary-block: any error (42P01 /
// PGRST202 on a pre-migration deploy) hides the component, never breaks the
// page. A case counts when it is closed AND its applicable admin fee was
// settled (paid/waived fee row — the #386 settled proof), so desk closures of
// abandoned pre-fee requests never inflate the number. Zero-state rule:
// 0 completed cases → render NOTHING.

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

function useCompletedCaseCount(tutorId: string | undefined): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!tutorId) return;
    let cancelled = false;
    (async () => {
      // Keep the rpc call BOUND to the client, extracting the method loses
      // `this` and supabase-js throws reading `this.rest`.
      const client = supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      };
      const { data, error } = await client.rpc("get_tutor_completed_case_count", {
        _tutor_id: tutorId,
      });
      if (cancelled || error || data == null) return;
      const n = Number(Array.isArray(data) ? data[0] : data);
      if (Number.isFinite(n)) setCount(n);
    })();
    return () => {
      cancelled = true;
    };
  }, [tutorId]);
  return count;
}

/** Profile-header line under the experience line; hides completely at zero. */
export function CompletedCasesLine({
  tutorId,
  className,
}: {
  tutorId: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const count = useCompletedCaseCount(tutorId);
  if (count == null || count <= 0) return null;
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      {t("experience.completed_cases", { count })}
    </p>
  );
}
