import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { PageSkeleton } from "@/components/layout/PageSkeleton";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || user) return;
    // Carry the intended destination so sign-in returns the user here
    // (epic #280 P1: sign-in happens before the form, then resumes it).
    const target = `${window.location.pathname}${window.location.search}`;
    void navigate({
      to: "/auth",
      search: { redirect: target },
      replace: true,
    });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <PageSkeleton />;
  }
  return <Outlet />;
}
