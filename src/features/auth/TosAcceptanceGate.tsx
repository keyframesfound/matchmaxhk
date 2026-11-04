import { useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { AcceptTermsDialog, TOS_VERSION } from "@/features/auth/AcceptTermsGate";
import { GateOverlayContext } from "@/features/auth/gate-overlay";
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
  // #609: the user id whose ToS check has FINISHED. Until it matches, the
  // dialog stays closed — otherwise it flashes for one frame on every page
  // load (user known, check not started yet) and then disappears.
  const [checkedFor, setCheckedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setAcceptedFor(null);
      setCheckedFor(null);
      return;
    }
    if (acceptedFor === user.id) return;
    let active = true;
    setChecking(true);
    void supabase
      .from("profiles")
      .select("tos_accepted_at, tos_version")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        // Missing row or error counts as not accepted (fail closed); accepting
        // upserts the profile row, which repairs a missing profile too.
        // #412: an accepted row only satisfies the gate at the CURRENT
        // TOS_VERSION, bumping the constant re-prompts everyone once.
        setAcceptedFor(data?.tos_accepted_at && data?.tos_version === TOS_VERSION ? user.id : null);
        setChecking(false);
        setCheckedFor(user.id);
      });
    return () => {
      active = false;
    };
  }, [user, acceptedFor]);

  const inheritedPending = useContext(GateOverlayContext);
  const checkDone = Boolean(user && (acceptedFor === user.id || checkedFor === user.id));
  const pending = loading || Boolean(user && (checking || !checkDone || acceptedFor !== user.id));
  // #609: hold off while an outer gate (onboarding) is still deciding or
  // showing its own dialog, so the two stay strictly sequential.
  const showDialog = Boolean(
    user && !loading && !checking && checkDone && !inheritedPending && acceptedFor !== user.id,
  );

  return (
    <GateOverlayContext.Provider value={inheritedPending || pending}>
      {children}
      {showDialog && user && (
        <AcceptTermsDialog
          userId={user.id}
          onAccepted={() => setAcceptedFor(user.id)}
          onDecline={() => void signOut()}
        />
      )}
    </GateOverlayContext.Provider>
  );
}
