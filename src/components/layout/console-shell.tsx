import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useRouterState } from "@tanstack/react-router";
import { LogOut, type LucideIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export type ConsoleNavItem = {
  label: string;
  /** TanStack route path, e.g. "/admin/users". Omit when using onSelect. */
  to?: string;
  icon: LucideIcon;
  badge?: string;
  /** Overrides automatic pathname matching (e.g. business console tabs). */
  active?: boolean;
  onSelect?: () => void;
};

export type ConsoleNavGroup = {
  label?: string;
  items: ConsoleNavItem[];
};

type ConsoleShellProps = {
  brandMark: ReactNode;
  brandLabel: string;
  groups: ConsoleNavGroup[];
  title: string;
  headerExtra?: ReactNode;
  sidebarExtra?: ReactNode;
  account: { name: string; email: string; avatarUrl?: string | null };
  onSignOut: () => void;
  /** Start with the sidebar expanded. */
  defaultOpen?: boolean;
  collapsible?: "icon" | "offcanvas";
  className?: string;
  children: ReactNode;
};

function ConsoleNavItemButton({ item, pathname }: { item: ConsoleNavItem; pathname: string }) {
  const autoActive = item.to
    ? item.to === "/admin"
      ? pathname === item.to
      : pathname === item.to || pathname.startsWith(`${item.to}/`)
    : false;
  const active = item.active ?? autoActive;
  const icon = <item.icon aria-hidden="true" />;
  const content = (
    <>
      {icon}
      <span>{item.label}</span>
    </>
  );

  if (item.to) {
    return (
      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
        <Link to={item.to}>{content}</Link>
      </SidebarMenuButton>
    );
  }
  return (
    <SidebarMenuButton isActive={active} tooltip={item.label} onClick={item.onSelect} type="button">
      {content}
    </SidebarMenuButton>
  );
}

/**
 * Application console shell modelled on the shadcn sidebar block: branded
 * collapsible sidebar with grouped nav + badges, avatar footer with sign out,
 * and an inset header with a sidebar trigger.
 */
export function ConsoleShell({
  brandMark,
  brandLabel,
  groups,
  title,
  headerExtra,
  sidebarExtra,
  account,
  onSignOut,
  defaultOpen = true,
  collapsible = "icon",
  className,
  children,
}: ConsoleShellProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const accountInitial =
    account.name
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("") || "MM";

  return (
    <SidebarProvider defaultOpen={defaultOpen} className={className}>
      <Sidebar collapsible={collapsible}>
        <SidebarHeader>
          <div className="flex h-10 items-center gap-2.5 px-2">
            <span className="flex size-6 shrink-0 items-center justify-center text-primary [&>svg]:size-6">
              {brandMark}
            </span>
            <span className="truncate text-sm font-bold tracking-tight group-data-[collapsible=icon]:hidden">
              {brandLabel}
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          {groups.map((group, groupIndex) => (
            <SidebarGroup key={group.label ?? groupIndex}>
              {group.label ? <SidebarGroupLabel>{group.label}</SidebarGroupLabel> : null}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.label}>
                      <ConsoleNavItemButton item={item} pathname={pathname} />
                      {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
          {sidebarExtra ? (
            <div className="mt-auto px-3 pb-3 group-data-[collapsible=icon]:hidden">
              {sidebarExtra}
            </div>
          ) : null}
        </SidebarContent>

        <SidebarFooter>
          <div className="flex items-center gap-3 p-1">
            <Avatar className="size-8 shrink-0">
              {account.avatarUrl ? (
                <AvatarImage src={account.avatarUrl} alt={account.name} />
              ) : null}
              <AvatarFallback className="bg-[#1FA8B6] text-xs font-bold text-white">
                {accountInitial}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold">{account.name}</p>
              <p className="truncate text-xs text-muted-foreground">{account.email}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground transition-colors duration-150 hover:text-foreground group-data-[collapsible=icon]:hidden"
              aria-label="Sign out"
              onClick={onSignOut}
            >
              <LogOut aria-hidden="true" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b border-border px-5">
          <SidebarTrigger className="-ml-1" />
          <div>
            <h1 className="text-sm font-bold tracking-tight">{title}</h1>
          </div>
          {headerExtra ? (
            <div className="ml-auto flex items-center gap-2">{headerExtra}</div>
          ) : null}
        </header>

        <div id="main-content" className="flex-1 overflow-y-auto p-5 sm:p-7">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
