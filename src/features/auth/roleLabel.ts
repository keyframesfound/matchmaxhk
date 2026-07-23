import type { AppRole } from "./useAuth";

/**
 * Friendly labels — never surface raw role slugs to users.
 * i18n keys live under `roles.*` in the locale files.
 */
export const ROLE_LABEL_KEY: Record<AppRole, string> = {
  super_admin: "roles.administrator",
  admin: "roles.administrator",
  staff: "roles.team",
  tutor: "roles.tutor",
  parent: "roles.parent",
};

export function primaryRole(roles: AppRole[]): AppRole {
  const order: AppRole[] = ["super_admin", "admin", "staff", "tutor", "parent"];
  return order.find((r) => roles.includes(r)) ?? "parent";
}
