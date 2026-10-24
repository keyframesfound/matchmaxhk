import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Circle, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";
import {
  dismissSignupChecklist,
  getSignupChecklist,
  type ChecklistStepId,
} from "./signup-checklist.functions";

/**
 * Issue #141: post-signup checklist, rendered as the first block on the
 * Account page. Everything lives server-side (role + live ticks +
 * dismissal), so this is a thin view: hidden entirely once dismissed or
 * once every step is done. Keys go through this key map (not literals)
 * because the locale files are extended by the integrator.
 */

const KEYS = {
  title: "account.checklist.title",
  dismiss: "account.checklist.dismiss",
  dismiss_failed: "account.checklist.dismiss_failed",
  step_tutor_card: "account.checklist.step_tutor_card",
  step_tutor_verify: "account.checklist.step_tutor_verify",
  step_tutor_capacity: "account.checklist.step_tutor_capacity",
  step_tutor_listing: "account.checklist.step_tutor_listing",
  step_parent_save: "account.checklist.step_parent_save",
  step_parent_case: "account.checklist.step_parent_case",
  step_parent_bought: "account.checklist.step_parent_bought",
} as const;

/** Where each open step links to. Plain anchors, matching the page's Edit links. */
const STEP_HREF: Record<ChecklistStepId, string> = {
  tutor_card: "/settings#my-tutor",
  tutor_verify: "/guide",
  tutor_capacity: "/settings#availability",
  tutor_listing: "/account/notes/new",
  parent_save: "/tutors",
  parent_case: "/tutor-requests?post=true",
  parent_bought: "/tutors?view=materials",
};

const STEP_KEYS: Record<ChecklistStepId, string> = {
  tutor_card: KEYS.step_tutor_card,
  tutor_verify: KEYS.step_tutor_verify,
  tutor_capacity: KEYS.step_tutor_capacity,
  tutor_listing: KEYS.step_tutor_listing,
  parent_save: KEYS.step_parent_save,
  parent_case: KEYS.step_parent_case,
  parent_bought: KEYS.step_parent_bought,
};

export function SignupChecklistCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const checklistQuery = useQuery({
    queryKey: ["account", "checklist", user?.id],
    queryFn: () => getSignupChecklist(),
    enabled: Boolean(user),
  });

  const dismissMutation = useMutation({
    mutationFn: () => dismissSignupChecklist(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["account", "checklist"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t(KEYS.dismiss_failed)),
  });

  if (!user || checklistQuery.isLoading || checklistQuery.isError) return null;

  const checklist = checklistQuery.data;
  if (!checklist || checklist.dismissedAt) return null;
  if (checklist.steps.every((step) => step.done)) return null;

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-medium text-[color:var(--ink)]">{t(KEYS.title)}</h2>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t(KEYS.dismiss)}
          disabled={dismissMutation.isPending}
          onClick={() => dismissMutation.mutate()}
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <ul className="mt-3 space-y-2">
        {checklist.steps.map((step) => (
          <li key={step.id} className="flex items-center gap-3 text-sm">
            {step.done ? (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
              </span>
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            )}
            {step.done ? (
              <span className="text-muted-foreground">{t(STEP_KEYS[step.id])}</span>
            ) : (
              <a
                href={STEP_HREF[step.id]}
                className="font-medium text-[color:var(--ink)] hover:underline"
              >
                {t(STEP_KEYS[step.id])}
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
