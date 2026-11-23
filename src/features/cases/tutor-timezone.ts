/**
 * #798: the tutor's own timezone.
 *
 * Availability is entered as a weekly grid without dates, so the grid means
 * nothing until it is anchored to a zone. Lesson rows are timestamptz (already
 * absolute); this decides how the grid and any zone label are read.
 *
 * The database is the enforcement point: tutors.timezone carries a CHECK
 * against pg_timezone_names, and every row defaults to Asia/Hong_Kong, so the
 * pre-existing HKT behaviour is unchanged for tutors who never touch it.
 */

export const DEFAULT_TUTOR_TIMEZONE = "Asia/Hong_Kong";

/** Zones offered in settings. HK-first, then the regions HK tutors actually work from. */
export const TUTOR_TIMEZONE_OPTIONS = [
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Taipei",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Bangkok",
  "Asia/Kuala_Lumpur",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Toronto",
  "America/Vancouver",
  "America/Los_Angeles",
  "UTC",
] as const;

export type TutorTimezone = (typeof TUTOR_TIMEZONE_OPTIONS)[number];

export function isSupportedTimezone(zone: string | null | undefined): zone is TutorTimezone {
  return typeof zone === "string" && (TUTOR_TIMEZONE_OPTIONS as readonly string[]).includes(zone);
}

/**
 * A stored zone is only usable if the runtime knows it; anything else falls
 * back to HK rather than throwing deep inside a formatter.
 */
export function resolveTutorTimezone(zone: string | null | undefined): string {
  if (isSupportedTimezone(zone)) return zone;
  try {
    if (zone) new Intl.DateTimeFormat("en-GB", { timeZone: zone });
  } catch {
    return DEFAULT_TUTOR_TIMEZONE;
  }
  return zone ?? DEFAULT_TUTOR_TIMEZONE;
}

/** "Asia/Hong_Kong" -> "Hong Kong" for a compact label. */
export function timezoneCity(zone: string): string {
  const tail = zone.split("/").pop() ?? zone;
  return tail.replace(/_/g, " ");
}

/**
 * The zone's current offset as "GMT+8" / "GMT-4", which is what a parent
 * compares against without knowing tz database names.
 */
export function timezoneOffsetLabel(zone: string, at: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: resolveTutorTimezone(zone),
      timeZoneName: "shortOffset",
    }).formatToParts(at);
    const name = parts.find((part) => part.type === "timeZoneName")?.value;
    return name ?? "";
  } catch {
    return "";
  }
}

/** "Hong Kong (GMT+8)" — the label the availability grid shows. */
export function timezoneLabel(zone: string, at: Date = new Date()): string {
  const offset = timezoneOffsetLabel(zone, at);
  const city = timezoneCity(resolveTutorTimezone(zone));
  return offset ? `${city} (${offset})` : city;
}

/**
 * Renders an absolute instant (a lesson, a window edge) in the tutor's zone.
 * Distinct from the HKT formatters elsewhere: those describe MatchMax's own
 * cut-offs, this describes the tutor's schedule.
 */
export function formatInTutorZone(
  iso: string,
  zone: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  },
  locale = "en-HK",
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: resolveTutorTimezone(zone),
      ...options,
    }).format(date);
  } catch {
    return "";
  }
}
