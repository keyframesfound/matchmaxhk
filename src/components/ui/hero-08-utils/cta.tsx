import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CtaProps {
  ctaEnabled?: boolean;
  text?: string;
  link?: string;
  size?: "xs" | "sm" | "default" | "lg";
}

export function Cta({ cta, invert }: { cta: CtaProps; invert?: boolean }) {
  if (!cta?.ctaEnabled || !cta.text || !cta.link) return null;

  return (
    <Button
      asChild
      variant="solid"
      color="blue"
      size={cta.size ?? "default"}
      className={cn(
        invert && "[--btn:#ffffff] [--btn-fg:var(--ink)] [--btn-hover:#e2ecf5] shadow-md",
      )}
    >
      <Link to={cta.link as never}>{cta.text}</Link>
    </Button>
  );
}
