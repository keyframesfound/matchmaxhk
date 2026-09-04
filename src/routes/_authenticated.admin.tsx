import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Building2,
  ClipboardList,
  ExternalLink,
  GraduationCap,
  Image as ImageIcon,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";

import { ConsoleShell, type ConsoleNavGroup } from "@/components/layout/console-shell";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const ADMIN_TITLES: { prefix: string; title: string }[] = [
  { prefix: "/admin/tutors", title: "Manage tutors" },
  { prefix: "/admin/cases", title: "Cases" },
  { prefix: "/admin/users", title: "Users" },
  { prefix: "/admin/organizations", title: "Organizations" },
  { prefix: "/admin/r2", title: "R2 images" },
  { prefix: "/admin/settings", title: "Settings" },
];

const ADMIN_GROUPS: ConsoleNavGroup[] = [
  {
    label: "Menu",
    items: [
      { label: "Overview", to: "/admin", icon: LayoutDashboard },
      { label: "Tutors", to: "/admin/tutors", icon: GraduationCap },
      { label: "Cases", to: "/admin/cases", icon: ClipboardList },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Users", to: "/admin/users", icon: Users },
      { label: "Organizations", to: "/admin/organizations", icon: Building2 },
      { label: "R2 Images", to: "/admin/r2", icon: ImageIcon },
      { label: "Settings", to: "/admin/settings", icon: Settings },
    ],
  },
];

function AdminLayout() {
  const { user, signOut, hasAnyRole, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    if (!loading && !hasAnyRole(["admin", "super_admin"])) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, hasAnyRole, navigate]);

  const title =
    ADMIN_TITLES.find((entry) => pathname.startsWith(entry.prefix))?.title ?? "Admin overview";

  const accountName =
    user?.user_metadata.display_name?.trim() || user?.email?.split("@")[0] || "Admin";

  if (loading) return null;

  return (
    <ConsoleShell
      defaultOpen={false}
      collapsible="offcanvas"
      brandMark={<Logo className="h-5 w-auto" />}
      brandLabel="MatchMax Admin"
      groups={ADMIN_GROUPS}
      title={title}
      headerExtra={
        <Button asChild variant="outline" size="sm">
          <a href="/" target="_blank" rel="noreferrer">
            <ExternalLink className="mr-1.5 h-4 w-4" />
            View site
          </a>
        </Button>
      }
      account={{
        name: accountName,
        email: user?.email ?? "",
        avatarUrl: (user?.user_metadata.avatar_url as string | undefined) ?? null,
      }}
      onSignOut={() => void signOut()}
    >
      <Outlet />
    </ConsoleShell>
  );
}
