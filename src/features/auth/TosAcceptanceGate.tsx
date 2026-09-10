import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { AcceptTermsDialog } from "@/features/auth/AcceptTermsGate";
import { supabase } from "@/integrations/supabase/client";

/**
 * Blocks the entire app (public and authenticated routes alike) behind the
 * Terms of Service / Privacy Policy acceptance dialog for any signed-in user
 * who has not accepted yet. The page stays mounted behind the popup; the
 * modal overlay blocks interaction and Radix locks body scroll. Children
 * render untouched for visitors and users whose profile records an
 * acceptance.
 */
export function TosAcceptanceGate({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const [acceptedFor, setAcceptedFor] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!user) {
      setAcceptedFor(null);
      return;
    }
    if (acceptedFor === user.id) return;
    let active = true;
    setChecking(true);
    void supabase
      .from("profiles")
      .select("tos_accepted_at")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        // Missing row or error counts as not accepted (fail closed); accepting
        // upserts the profile row, which repairs a missing profile too.
        setAcceptedFor(data?.tos_accepted_at ? user.id : null);
        setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [user, acceptedFor]);

  if (loading || !user || checking || acceptedFor === user.id) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <AcceptTermsDialog
        userId={user.id}
        onAccepted={() => setAcceptedFor(user.id)}
        onDecline={() => void signOut()}
      />
    </>
  );
}
