import { Bell, Bookmark, CircleUserRound, Compass, Plus, type LucideIcon } from "lucide-react";

export type MobileNavSlot = {
  key: "explore" | "saved" | "post" | "notifications" | "account";
  to: "/tutors" | "/saved-posts" | "/account/notes/new" | "/notifications" | "/me";
  labelKey: string;
  icon: LucideIcon;
};

/**
 * #674: the five phone bottom-bar slots, left to right. Post and Notifications
 * live behind the _authenticated guard, which sends guests to /auth and back.
 */
export const MOBILE_NAV_SLOTS: readonly MobileNavSlot[] = [
  { key: "explore", to: "/tutors", labelKey: "nav_mobile.explore", icon: Compass },
  { key: "saved", to: "/saved-posts", labelKey: "nav_mobile.saved_posts", icon: Bookmark },
  { key: "post", to: "/account/notes/new", labelKey: "nav_mobile.post", icon: Plus },
  { key: "notifications", to: "/notifications", labelKey: "nav_mobile.notifications", icon: Bell },
  { key: "account", to: "/me", labelKey: "nav_mobile.account", icon: CircleUserRound },
];

export function isMobileNavSlotActive(pathname: string, to: MobileNavSlot["to"]): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}
