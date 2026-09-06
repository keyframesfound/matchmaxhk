import type { CSSProperties, ReactNode } from "react";
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
import { cn } from "@/lib/utils";

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
  /** Lock the shell to the viewport height so only the content area scrolls. */
  fitViewport?: boolean;
  /** "comfortable" scales the console UI up (business console). */
  size?: "default" | "comfortable";
  className?: string;
  children: ReactNode;
};

function ConsoleNavItemButton({
  item,
  pathname,
  buttonSize,
}: {
  item: ConsoleNavItem;
  pathname: string;
  buttonSize: "default" | "lg";
}) {
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
      <SidebarMenuButton asChild isActive={active} tooltip={item.label} size={buttonSize}>
        <Link to={item.to}>{content}</Link>
      </SidebarMenuButton>
    );
  }
  return (
    <SidebarMenuButton
      isActive={active}
      tooltip={item.label}
      onClick={item.onSelect}
      type="button"
      size={buttonSize}
    >
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
  fitViewport = false,
  size = "default",
  className,
  children,
}: ConsoleShellProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const comfortable = size === "comfortable";
  const accountInitial =
    account.name
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("") || "MM";

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      className={cn(className, fitViewport && "h-svh overflow-hidden")}
      style={comfortable ? ({ "--sidebar-width": "20rem" } as CSSProperties) : undefined}
    >
      <Sidebar collapsible={collapsible}>
        <SidebarHeader>
          <div className={cn("flex items-center gap-2.5 px-2", comfortable ? "h-12" : "h-10")}>
            <span className="flex size-6 shrink-0 items-center justify-center text-primary [&>svg]:size-6">
              {brandMark}
            </span>
            <span
              className={cn(
                "truncate font-bold tracking-tight group-data-[collapsible=icon]:hidden",
                comfortable ? "text-base" : "text-sm",
              )}
            >
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
                      <ConsoleNavItemButton
                        item={item}
                        pathname={pathname}
                        buttonSize={comfortable ? "lg" : "default"}
                      />
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
          <div className={cn("flex items-center gap-3", comfortable ? "p-2" : "p-1")}>
            <Avatar className={cn("shrink-0", comfortable ? "size-10" : "size-8")}>
              {account.avatarUrl ? (
                <AvatarImage src={account.avatarUrl} alt={account.name} />
              ) : null}
              <AvatarFallback
                className={cn(
                  "bg-[color:var(--foreground)] text-[color:var(--background)]",
                  comfortable ? "text-sm" : "text-xs",
                )}
              >
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

      <SidebarInset className={fitViewport ? "h-svh overflow-hidden" : undefined}>
        <header
          className={cn(
            "flex shrink-0 items-center gap-4 border-b border-border",
            comfortable ? "h-16 px-6" : "h-14 px-5",
          )}
        >
          <SidebarTrigger className="-ml-1" />
          <div>
            <h1 className={cn("font-bold tracking-tight", comfortable ? "text-lg" : "text-sm")}>
              {title}
            </h1>
          </div>
          {headerExtra ? (
            <div className="ml-auto flex items-center gap-2">{headerExtra}</div>
          ) : null}
        </header>

        <div
          id="main-content"
          className={cn(
            "min-h-0 flex-1 overflow-y-auto",
            comfortable ? "p-6 sm:p-8" : "p-5 sm:p-7",
          )}
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
