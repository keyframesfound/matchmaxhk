import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/features/auth/useAuth";
import { committedToCurrentVersion } from "@/features/auth/commitment-version";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { COMMUNITY_COMMITMENT_VERSION } from "@/features/auth/commitment-version";

/**
 * Issue #141: Airbnb-style "everyone belongs here" commitment, shown once per
 * account after signup. Sits inside the ToS gate so the flow is onboarding →
 * ToS → commitment; declining signs the user out like the ToS dialog does.
 * Fails closed — a missing profile row or a read error re-prompts.
 *
 * Issue #306: the agreement is versioned. The dialog re-prompts once when
 * COMMUNITY_COMMITMENT_VERSION changes (stored NULL counts as "1", so
 * pre-versioning accounts are not asked again until the text actually
 * changes). Never shown logged-out; existing users answer on their next
 * login, not on a public page.
 */
export function CommunityCommitmentGate({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const [agreedFor, setAgreedFor] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!user) {
      setAgreedFor(null);
      return;
    }
    if (agreedFor === user.id) return;
    let active = true;
    setChecking(true);
    void supabase
      .from("profiles")
      .select("community_commitment_at, community_commitment_version")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const agreed =
          Boolean(data?.community_commitment_at) &&
          committedToCurrentVersion(data?.community_commitment_version);
        setAgreedFor(agreed ? user.id : null);
        setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [user, agreedFor]);

  if (loading || !user || checking || agreedFor === user.id) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <CommunityCommitmentDialog
        userId={user.id}
        onAgreed={() => setAgreedFor(user.id)}
        onDecline={() => void signOut()}
      />
    </>
  );
}

function CommunityCommitmentDialog({
  userId,
  onAgreed,
  onDecline,
}: {
  userId: string;
  onAgreed: () => void;
  onDecline: () => void;
}) {
  const { t } = useTranslation();
  const [agreeing, setAgreeing] = useState(false);

  async function agree() {
    setAgreeing(true);
    // Upsert mirrors AcceptTermsGate: it repairs a missing profile row too.
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      community_commitment_at: new Date().toISOString(),
      community_commitment_version: COMMUNITY_COMMITMENT_VERSION,
    });
    if (error) {
      toast.error(t("auth.commitment_error"));
      setAgreeing(false);
      return;
    }
    onAgreed();
  }

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="top-auto bottom-0 left-1/2 w-full max-w-[460px] translate-x-[-50%] translate-y-0 gap-0 rounded-t-3xl border-0 bg-[color:var(--surface)] p-6 pb-8 text-center data-[state=open]:slide-in-from-bottom-1/2 data-[state=closed]:slide-out-to-bottom-full sm:top-1/2 sm:bottom-auto sm:translate-y-[-50%] sm:rounded-3xl sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95"
      >
        <DialogTitle className="text-2xl font-bold tracking-tight text-[color:var(--ink)]">
          {t("auth.commitment_title")}
        </DialogTitle>
        <DialogDescription className="mt-3 text-base leading-relaxed text-muted-foreground">
          {t("auth.commitment_intro")}
        </DialogDescription>
        <p className="mt-4 rounded-2xl border border-border bg-[color:var(--surface-subtle)] px-4 py-3 text-sm leading-relaxed text-[color:var(--ink)]">
          {t("auth.commitment_pledge")}
        </p>
        <div className="mt-6 space-y-3">
          <Button
            variant="solid"
            color="neutral"
            loading={agreeing}
            onClick={agree}
            className="h-12 w-full rounded-xl text-base font-bold"
          >
            {t("auth.commitment_agree")}
          </Button>
          <Button
            variant="ghost"
            onClick={onDecline}
            disabled={agreeing}
            className="h-10 w-full rounded-xl font-bold text-[color:var(--ink)] underline underline-offset-4"
          >
            {t("auth.commitment_decline")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
