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

export const ROLE_DISPLAY_NAMES: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  staff: "Staff",
  tutor: "Tutor",
  parent: "Parent / Client",
};

export const ROLE_BADGE_STYLES: Record<AppRole, string> = {
  super_admin:
    "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20 hover:bg-indigo-500/15",
  admin: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20 hover:bg-blue-500/15",
  staff:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/15",
  tutor:
    "bg-[color:var(--foreground)]/[0.06] text-[color:var(--foreground)] border-[color:var(--foreground)]/15 hover:bg-[color:var(--foreground)]/[0.08]",
  parent:
    "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20 hover:bg-slate-500/15",
};

export type RoleDefinition = {
  role: AppRole;
  title: string;
  description: string;
  badgeStyle: string;
  capabilities: string[];
};

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    role: "super_admin",
    title: "Super Admin",
    description:
      "Full, unrestricted platform access including system permissions, user roles management, and destructive operations.",
    badgeStyle: ROLE_BADGE_STYLES.super_admin,
    capabilities: [
      "Grant and revoke user roles across all levels",
      "Permanently delete user accounts and linked records",
      "Access all administrative areas (cases, tutors, R2, settings)",
      "Manage environment variables and global parameters",
    ],
  },
  {
    role: "admin",
    title: "Admin",
    description: "Full management of core operations, tutor catalog, student cases, and content.",
    badgeStyle: ROLE_BADGE_STYLES.admin,
    capabilities: [
      "Review, edit, and publish tutor profiles",
      "Manage and match student tutoring cases",
      "Access Cloudflare R2 media storage & assets",
      "View platform settings and user analytics",
    ],
  },
  {
    role: "staff",
    title: "Staff",
    description: "Operational support role for day-to-day case processing and tutor matching.",
    badgeStyle: ROLE_BADGE_STYLES.staff,
    capabilities: [
      "Inspect incoming case applications",
      "Communicate with parents and tutors",
      "Update case status workflow",
      "Read tutor application records",
    ],
  },
  {
    role: "tutor",
    title: "Tutor",
    description:
      "Verified tutor account authorized to create profile listings and express interest in open cases.",
    badgeStyle: ROLE_BADGE_STYLES.tutor,
    capabilities: [
      "Manage personal public tutor profile",
      "Browse available tuition cases",
      "Submit case application interests",
      "Update availability and pricing",
    ],
  },
  {
    role: "parent",
    title: "Parent / Client",
    description: "Standard account for parents and students seeking tutoring services.",
    badgeStyle: ROLE_BADGE_STYLES.parent,
    capabilities: [
      "Post new tuition case requests",
      "Browse public tutor directory",
      "Track status of active case requests",
      "Manage basic profile settings",
    ],
  },
];

export function primaryRole(roles: AppRole[]): AppRole {
  const order: AppRole[] = ["super_admin", "admin", "staff", "tutor", "parent"];
  return order.find((r) => roles.includes(r)) ?? "parent";
}
