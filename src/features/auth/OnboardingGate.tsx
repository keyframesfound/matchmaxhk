import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, GraduationCap, Search, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/useAuth";
import { TosAcceptanceGate } from "@/features/auth/TosAcceptanceGate";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type OnboardingChoice = "parent" | "tutor";

/**
 * Blocks the entire app behind a Fiverr-style "What brings you to MatchMax?"
 * role-selection dialog for any signed-in user who has not completed
 * onboarding yet. Internal roles (admins/staff) skip straight to the Terms
 * gate. Once the choice is recorded the ToS acceptance gate takes over, so
 * first-time users see onboarding first, then the ToS dialog.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { user, loading, hasAnyRole } = useAuth();
  const [onboardedFor, setOnboardedFor] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!user) {
      setOnboardedFor(null);
      setDisplayName(null);
      return;
    }
    if (onboardedFor === user.id) return;
    let active = true;
    setChecking(true);
    void supabase
      .from("profiles")
      .select("onboarding_completed_at, display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        // Missing row or error counts as not onboarded (fail closed); the
        // dialog's RPC sets the flag, which repairs a missing profile too.
        setOnboardedFor(data?.onboarding_completed_at ? user.id : null);
        setDisplayName(data?.display_name ?? null);
        setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [user, onboardedFor]);

  if (
    loading ||
    !user ||
    checking ||
    onboardedFor === user.id ||
    hasAnyRole(["admin", "staff", "super_admin"])
  ) {
    return <TosAcceptanceGate>{children}</TosAcceptanceGate>;
  }

  return (
    <>
      {children}
      <OnboardingRoleDialog displayName={displayName} onDone={() => setOnboardedFor(user.id)} />
    </>
  );
}

function OnboardingRoleDialog({
  displayName,
  onDone,
}: {
  displayName: string | null;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { refreshRoles } = useAuth();
  const [choice, setChoice] = useState<OnboardingChoice | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    if (!choice || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("complete_onboarding", { _choice: choice });
    if (error) {
      toast.error(t("auth.onboarding_error"));
      setSubmitting(false);
      return;
    }
    await refreshRoles();
    onDone();
  }

  const options: { value: OnboardingChoice; icon: LucideIcon; label: string; desc: string }[] = [
    {
      value: "parent",
      icon: Search,
      label: t("auth.onboarding_parent_label"),
      desc: t("auth.onboarding_parent_desc"),
    },
    {
      value: "tutor",
      icon: GraduationCap,
      label: t("auth.onboarding_tutor_label"),
      desc: t("auth.onboarding_tutor_desc"),
    },
  ];

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="top-auto bottom-0 left-1/2 w-full max-w-[520px] translate-x-[-50%] translate-y-0 gap-0 rounded-t-3xl border-0 bg-[color:var(--surface)] p-6 pb-8 data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-1/2 sm:top-1/2 sm:bottom-auto sm:translate-y-[-50%] sm:rounded-3xl sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95"
      >
        <DialogTitle className="text-2xl font-bold tracking-tight text-[color:var(--ink)]">
          {displayName
            ? t("auth.onboarding_title_named", { name: displayName })
            : t("auth.onboarding_title")}
        </DialogTitle>
        <DialogDescription className="mt-2 text-base leading-relaxed text-muted-foreground">
          {t("auth.onboarding_subtitle")}
        </DialogDescription>
        <div
          role="radiogroup"
          aria-label={t("auth.onboarding_subtitle")}
          className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {options.map((option) => {
            const selected = choice === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={submitting}
                onClick={() => setChoice(option.value)}
                className={`relative flex flex-col items-start gap-3 rounded-2xl border-2 bg-[color:var(--surface)] p-4 pr-9 text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/40 focus-visible:outline-none disabled:cursor-not-allowed ${
                  selected
                    ? "border-[color:var(--ink)]"
                    : "border-border hover:border-[color:var(--ink)]/50"
                }`}
              >
                <span
                  aria-hidden
                  className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center"
                >
                  {selected ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--ink)]">
                      <Check className="h-3 w-3 text-[color:var(--surface)]" strokeWidth={3} />
                    </span>
                  ) : (
                    <span className="h-5 w-5 rounded-full border-2 border-[color:var(--muted-foreground)]/40" />
                  )}
                </span>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--primary)]/10 text-[color:var(--primary)]">
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-bold text-[color:var(--ink)]">{option.label}</span>
                  <span className="text-sm leading-snug text-muted-foreground">{option.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
        <Button
          variant="solid"
          color="neutral"
          loading={submitting}
          disabled={!choice}
          onClick={confirm}
          className="mt-6 h-12 w-full rounded-xl text-base font-bold"
        >
          {t("auth.onboarding_next")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
