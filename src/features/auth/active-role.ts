import type { AppRole } from "@/features/auth/useAuth";

export type AccountType = "parent" | "tutor";

/**
 * Issue #459: roles are additive, so a user can hold both parent and tutor.
 * profiles.active_role is the account type they last chose; it only wins
 * while they still hold that role. Without one, tutors default to tutor
 * (the pre-#459 behaviour of `hasRole("tutor") ? "tutor" : "parent"`).
 */
export function resolveActiveRole(
  stored: AccountType | null | undefined,
  roles: readonly AppRole[],
): AccountType {
  if (stored === "parent") return "parent";
  if (stored === "tutor" && roles.includes("tutor")) return "tutor";
  return roles.includes("tutor") ? "tutor" : "parent";
}
