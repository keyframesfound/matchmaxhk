import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { PageSkeleton } from "@/components/layout/PageSkeleton";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // Without an explicit head this shell inherits the root's indexable title.
  // The private tree is noindex; robots.txt leaves it crawlable so Google can
  // actually read this tag and drop the URLs.
  head: () => ({
    meta: [
      { title: "MatchMax account | MatchMax" },
      { name: "description", content: "Sign in to view your MatchMax account." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
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
