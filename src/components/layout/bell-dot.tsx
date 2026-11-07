import { cn } from "@/lib/utils";

/** #292 red dot for unread; #561 amber when an action is still open. */
export function BellDot({
  unread,
  openActions,
  className,
}: {
  unread: number;
  openActions: number;
  className?: string;
}) {
  if (unread <= 0 && openActions <= 0) return null;
  return (
    <span
      className={cn(
        "absolute h-2.5 w-2.5 rounded-full",
        openActions > 0 ? "bg-amber-500" : "bg-red-500",
        className,
      )}
      aria-hidden="true"
    />
  );
}
