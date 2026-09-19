import { ChevronLeft } from "lucide-react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

/**
 * Mobile-only back button for pages without a top bar. Uses browser history
 * when available, otherwise falls back to the given route (default: home).
 */
export function PageBackButton({
  className,
  fallbackTo = "/",
}: {
  className?: string;
  fallbackTo?: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const navigate = useNavigate();

  return (
    <button
      type="button"
      aria-label={t("nav.back")}
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.history.back();
        } else {
          void navigate({ to: fallbackTo });
        }
      }}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-[color:var(--ink)] transition-colors hover:bg-[color:var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 lg:hidden",
        className,
      )}
    >
      <ChevronLeft className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
