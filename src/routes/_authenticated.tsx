import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { AcceptTermsGate } from "@/features/auth/AcceptTermsGate";
import { supabase } from "@/integrations/supabase/client";
import { PageSkeleton } from "@/components/layout/PageSkeleton";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [acceptedFor, setAcceptedFor] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

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

  if (loading || !user || checking) {
    return <PageSkeleton />;
  }

  if (acceptedFor !== user.id) {
    return (
      <AcceptTermsGate
        userId={user.id}
        onAccepted={() => setAcceptedFor(user.id)}
        onDecline={() => void signOut()}
      />
    );
  }

  return <Outlet />;
}
