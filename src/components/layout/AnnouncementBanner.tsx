import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "mm_banner_dismissed_v1";

export function AnnouncementBanner() {
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    setIsDismissed(window.localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  if (isDismissed) return null;

  const handleDismiss = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    window.localStorage.setItem(STORAGE_KEY, "true");
    setIsDismissed(true);
  };

  return (
    <div
      role="region"
      aria-label="Announcement"
      className="relative flex w-full items-center justify-center bg-[#0D1B2A] px-4 py-2 text-white sm:px-6 sm:py-2.5"
    >
      <Link
        to="/how-it-works"
        className="pr-8 text-center text-[12px] font-medium leading-snug text-white underline underline-offset-2 sm:pr-10 sm:text-sm"
      >
        Free for parents. Fair for tutors. Keep more with a low 1.5-lesson commission.
      </Link>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss banner"
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-white opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
