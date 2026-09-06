import { cn } from "@/lib/utils";
import type { ReactNode, HTMLAttributes } from "react";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Content to wrap; when loading, its dimensions are preserved beneath the overlay. */
  children?: ReactNode;
  /** Additional Tailwind classes for the skeleton container. */
  className?: string;
  /** Controls whether the skeleton overlay is rendered. */
  loading?: boolean;
}

function Skeleton({ loading = true, children, className, ...props }: SkeletonProps) {
  if (!loading && children) {
    return <>{children}</>;
  }

  if (loading && children) {
    return (
      <div aria-busy="true" aria-live="polite" className={cn("relative", className)} {...props}>
        <div className="invisible">{children}</div>
        <div
          aria-hidden="true"
          className="absolute inset-0 animate-pulse rounded-[inherit] bg-muted-foreground/20"
        />
      </div>
    );
  }

  return (
    <div
      aria-busy="true"
      aria-label="Loading content"
      className={cn("animate-pulse rounded-md bg-muted-foreground/20", className)}
      {...props}
    />
  );
}

export { Skeleton };
export default Skeleton;
