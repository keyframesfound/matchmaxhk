/**
 * Issue #308: account suspend / ban / restore — pure helpers shared by the
 * admin server functions, the admin UI and tests (no server-only imports).
 *
 * Statuses live on the profile row (`profiles.account_status`):
 *   active | suspended | banned
 * The tutor card mirror column (`tutors.owner_account_status`) is kept in
 * sync by a trigger in the migration; ban additionally unpublishes the card.
 */

export const ACCOUNT_STATUSES = ["active", "suspended", "banned"] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export type StatusAction = "suspend" | "ban" | "restore";

/** Reason list for the suspend/ban form (mirrors the report-reason spirit). */
export const STATUS_CHANGE_REASONS = [
  "contact_details",
  "inappropriate_photo",
  "spam",
  "fake_identity",
  "other",
] as const;

export type StatusChangeReason = (typeof STATUS_CHANGE_REASONS)[number];

/** Roles allowed to SUSPEND an account (concierge/staff and above). */
const SUSPEND_ROLES = ["staff", "admin", "super_admin"] as const;

/** Only admins (and super admins) may ban or restore — never staff. */
const ADMIN_ONLY_ROLES = ["admin", "super_admin"] as const;

/**
 * Role gate for a status action. Enforced again server-side in every server
 * function; this helper is shared so the UI can hide controls it would not
 * be allowed to use.
 */
export function canPerformStatusAction(roles: readonly string[], action: StatusAction): boolean {
  const allowed =
    action === "suspend"
      ? (SUSPEND_ROLES as readonly string[])
      : (ADMIN_ONLY_ROLES as readonly string[]);
  return roles.some((role) => allowed.includes(role));
}

/** True when the account status refuses all mutating participation. */
export function accountStatusBlocksParticipation(
  status: string | null | undefined,
): status is "suspended" | "banned" {
  return status === "suspended" || status === "banned";
}

/** Human label used in the admin table badge and the notification email. */
export function accountStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "suspended":
      return "Suspended";
    case "banned":
      return "Banned";
    default:
      return "Active";
  }
}

/** Badge styling for the admin users table — borders/bg only, no shadows. */
export function accountStatusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case "suspended":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
    case "banned":
      return "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20";
    default:
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
  }
}

/**
 * The one-line email copy for a status change. The reporter is NEVER named
 * and the note is NOT included — only the status and the community-commitment
 * pointer, per the issue decision.
 */
export function statusChangeEmailLine(action: StatusAction): string {
  switch (action) {
    case "suspend":
      return "Your MatchMax account has been suspended. See the community commitment.";
    case "ban":
      return "Your MatchMax account has been banned. See the community commitment.";
    case "restore":
      return "Your MatchMax account has been restored. See the community commitment.";
  }
}
