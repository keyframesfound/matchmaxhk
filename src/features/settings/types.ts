import type { User } from "@supabase/supabase-js";

export type NotificationPrefs = {
  case_updates: boolean;
  match_suggestions: boolean;
  tutor_leads: boolean;
  product_news: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  case_updates: true,
  match_suggestions: true,
  tutor_leads: true,
  product_news: false,
};

const NOTIFICATION_PREF_KEYS = [
  "case_updates",
  "match_suggestions",
  "tutor_leads",
  "product_news",
] as const;

/**
 * Profiles store notification preferences as free-form JSONB, so anything
 * read back must be merged over the defaults before use.
 */
export function sanitizeNotificationPrefs(value: unknown): NotificationPrefs {
  if (typeof value !== "object" || value === null) return { ...DEFAULT_NOTIFICATION_PREFS };
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS };
  for (const key of NOTIFICATION_PREF_KEYS) {
    const stored = (value as Record<string, unknown>)[key];
    if (typeof stored === "boolean") prefs[key] = stored;
  }
  return prefs;
}

/** Fields the settings page reads/writes on the profiles row. */
export type SettingsProfile = {
  display_name: string | null;
  phone: string | null;
  locale: string;
  notification_preferences: unknown;
  tos_accepted_at: string | null;
};

export type SettingsCategory =
  "general" | "profile" | "account" | "security" | "notifications" | "privacy" | "danger-zone";

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  "general",
  "profile",
  "account",
  "security",
  "notifications",
  "privacy",
  "danger-zone",
];

/** Legacy in-page anchors that used to scroll the old single-page settings. */
const HASH_ALIASES: Record<string, SettingsCategory> = {
  appearance: "general",
  "account-type": "account",
};

export function categoryFromHash(hash: string): SettingsCategory {
  const normalized = hash.replace(/^#/, "").toLowerCase();
  if (HASH_ALIASES[normalized]) return HASH_ALIASES[normalized];
  return (SETTINGS_CATEGORIES as string[]).includes(normalized)
    ? (normalized as SettingsCategory)
    : "general";
}

/** Fields the settings page may write back to the profiles row. */
export type SettingsProfileUpdate = {
  display_name?: string;
  phone?: string | null;
  locale?: string;
  notification_preferences?: NotificationPrefs;
};

/** Contract every settings section receives from the page shell. */
export type SettingsSectionProps = {
  user: User;
  profile: SettingsProfile | undefined;
  updateProfile: (fields: SettingsProfileUpdate) => Promise<boolean>;
};

/** Loose Hong Kong phone check: 8 digits starting 2/3/9, optional +852 prefix. */
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/[\s()-]/g, "").replace(/^\+?852/, "");
  return /^[2-9]\d{7}$/.test(digits);
}
