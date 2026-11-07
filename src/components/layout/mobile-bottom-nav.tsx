import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";

import { BellDot } from "@/components/layout/bell-dot";
import { useBellQuery } from "@/components/layout/use-bell-query";
import {
  isMobileNavSlotActive,
  MOBILE_NAV_SLOTS,
  type MobileNavSlot,
} from "@/components/layout/mobile-nav-slots";
import { cn } from "@/lib/utils";

// Equal 20% columns; 10px labels so "Notifications" stays on one line at 320px.
const slotClass =
  "relative flex min-w-0 flex-1 basis-0 flex-col items-center justify-end gap-1 whitespace-nowrap pb-2 pt-1.5 text-[10px] leading-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring min-[375px]:text-[11px]";

function PostSlot({ slot, active }: { slot: MobileNavSlot; active: boolean }) {
  const { t } = useTranslation();
  const Icon = slot.icon;
  return (
    <Link
      to={slot.to}
      aria-label={t("nav_mobile.post_aria")}
      aria-current={active ? "page" : undefined}
      className={cn(slotClass, "font-semibold text-[color:var(--ink)]")}
    >
      <span
        aria-hidden="true"
        className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#1d9bf0] text-white"
      >
        <Icon className="h-6 w-6" strokeWidth={2.5} />
      </span>
      {t(slot.labelKey)}
    </Link>
  );
}

function TabSlot({ slot, active }: { slot: MobileNavSlot; active: boolean }) {
  const { t } = useTranslation();
  // OS Reduce Motion must silence the sliding indicators too (#398 review):
  // layoutId springs are transform/layout animations, which motion plays
  // regardless of the media query unless gated here.
  const prefersReducedMotion = useReducedMotion();
  const { data: bell } = useBellQuery();
  const isNotifications = slot.key === "notifications";
  const unread = bell?.unread ?? 0;
  const Icon = slot.icon;
  return (
    <Link
      to={slot.to}
      aria-label={isNotifications ? t("sor.bell_aria", { count: unread }) : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        slotClass,
        active
          ? "font-semibold text-[color:var(--ink)]"
          : "font-medium text-[color:var(--ink)]/55 hover:text-[color:var(--ink)]",
      )}
    >
      {/* Sliding active indicator: the top bar springs between tabs instead of
          vanishing/reappearing on the active one. */}
      <span aria-hidden="true" className="absolute inset-x-3 top-0 h-0.5">
        {active ? (
          <motion.span
            layoutId="mobile-bottom-nav-indicator"
            className="block h-0.5 rounded-full bg-[color:var(--foreground)]"
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { type: "spring", bounce: 0.15, duration: 0.4 }
            }
          />
        ) : null}
      </span>
      <span className="relative">
        <Icon className="h-6 w-6" aria-hidden="true" />
        {isNotifications ? (
          <BellDot
            unread={unread}
            openActions={bell?.openActions ?? 0}
            className="-right-0.5 -top-0.5"
          />
        ) : null}
      </span>
      {t(slot.labelKey)}
    </Link>
  );
}

/**
 * #674: fixed five-slot phone bar (Explore, Saved, Post, Notifications,
 * Account). Account opens the Account hub page, /me (#594).
 * Hidden on lg+ where the desktop header takes over.
 */
export function MobileBottomNav() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <nav
      aria-label={t("nav.account_menu_label")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-[color:var(--surface)]/98 backdrop-blur-sm lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch pb-[env(safe-area-inset-bottom)]">
        {MOBILE_NAV_SLOTS.map((slot) => {
          const active = isMobileNavSlotActive(pathname, slot.to);
          return slot.key === "post" ? (
            <PostSlot key={slot.key} slot={slot} active={active} />
          ) : (
            <TabSlot key={slot.key} slot={slot} active={active} />
          );
        })}
      </div>
    </nav>
  );
}
