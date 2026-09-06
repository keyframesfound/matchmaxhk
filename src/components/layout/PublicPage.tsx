import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

type PublicPageProps = {
  children: ReactNode;
  className?: string;
  mainClassName?: string;
};

export function PublicPage({ children, className, mainClassName }: PublicPageProps) {
  return (
    <div
      className={cn(
        "flex min-h-screen min-w-0 flex-col overflow-x-clip bg-background text-foreground",
        className,
      )}
    >
      <SiteHeader />
      <main className={cn("min-w-0 flex-1", mainClassName)}>{children}</main>
      <SiteFooter />
    </div>
  );
}
