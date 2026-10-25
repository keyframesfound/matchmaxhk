import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const STORAGE_KEY = "mm_banner_dismissed_session_v1";
const ROTATE_MS = 6000;

export function AnnouncementBanner() {
  const { t } = useTranslation();
  const [isDismissed, setIsDismissed] = useState(true);
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setIsDismissed(window.sessionStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  useEffect(() => {
    if (isDismissed || paused) return;
    const id = window.setInterval(() => {
      setSlide((current) => (current + 1) % 2);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [isDismissed, paused]);

  if (isDismissed) return null;

  const handleDismiss = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    window.sessionStorage.setItem(STORAGE_KEY, "true");
    setIsDismissed(true);
  };

  const slides = [
    {
      to: "/guide",
      text: t("banner.value_prop"),
      cta: null as string | null,
    },
    {
      to: "/guide/refer",
      text: t("banner.referral_promo"),
      cta: t("banner.referral_cta"),
    },
  ];

  return (
    <div
      role="region"
      aria-label="Announcement"
      className="relative flex w-full items-center justify-center bg-[color:var(--surface-header)] px-4 py-2 text-[color:var(--ink)] sm:px-6 sm:py-2.5"
    >
      <div
        className="relative grid flex-1"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {slides.map((item, index) => {
          const isActive = index === slide;
          return (
            <Link
              key={item.text}
              to={item.to}
              tabIndex={isActive ? 0 : -1}
              aria-hidden={!isActive}
              className={`col-start-1 row-start-1 flex items-center justify-center gap-2 pr-8 text-center text-[12px] font-medium leading-snug text-[color:var(--ink)] underline underline-offset-2 transition-opacity sm:pr-10 sm:text-sm motion-reduce:transition-none ${
                // Asymmetric crossfade: the outgoing slide fades fast (200ms)
                // while the incoming one waits 200ms then fades in, the old
                // symmetric 700ms crossfade had both texts readable on top of
                // each other mid-rotation.
                isActive
                  ? "opacity-100 delay-200 duration-500"
                  : "pointer-events-none opacity-0 duration-200"
              }`}
            >
              <span>{item.text}</span>
              {item.cta ? (
                <span className="whitespace-nowrap font-bold underline decoration-2">
                  {item.cta}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss banner"
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[color:var(--ink)] opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)]/40"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
