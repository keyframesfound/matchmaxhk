import { useRouterState } from "@tanstack/react-router";
import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

export function BackToTopButton() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setIsVisible(window.scrollY > 300);

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });

    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  if (pathname === "/join" || !isVisible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className="fixed bottom-20 right-4 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--brand-navy)] text-white shadow-[0_14px_28px_rgba(0,0,0,0.24)] transition-transform duration-200 hover:scale-105 hover:bg-[color:var(--brand-royal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-navy)] focus-visible:ring-offset-2 sm:bottom-24 sm:right-6"
    >
      <ArrowUp className="h-7 w-7" aria-hidden="true" />
      <span className="sr-only">Back to top</span>
    </button>
  );
}
