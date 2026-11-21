/**
 * Issue #798 (AC-8 / AC-9 storage half): the tutor join form captures a city /
 * locality and a CONFIRMED IANA time zone. Zone resolution is a pure function
 * so the country default, the browser hint and "no suggestion" stay testable
 * without React. The browser zone is a hint only — callers must never let it
 * overwrite a value the tutor has confirmed.
 */

/** Countries whose single time zone is unambiguous, keyed by form country. */
export const COUNTRY_DEFAULT_TIME_ZONE: Record<string, string> = {
  "Hong Kong": "Asia/Hong_Kong",
  "Mainland China": "Asia/Shanghai",
  Macau: "Asia/Macau",
  Singapore: "Asia/Singapore",
  "United Kingdom": "Europe/London",
};

export type TimeZoneSource = "country" | "browser" | "none";

/** True when `Intl` accepts the string as an IANA zone (rejects blanks). */
export function isValidIanaTimeZone(zone: string): boolean {
  if (!zone.trim()) return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the suggested zone: the country default wins, otherwise the browser
 * zone when it is a valid IANA name, otherwise nothing. `source` lets the form
 * disclose when the value is only a browser guess.
 */
export function suggestTimeZone({
  country,
  browserZone,
}: {
  country: string;
  browserZone?: string | null;
}): { zone: string | null; source: TimeZoneSource } {
  const countryZone = COUNTRY_DEFAULT_TIME_ZONE[country];
  if (countryZone) return { zone: countryZone, source: "country" };

  const browser = (browserZone ?? "").trim();
  if (browser && isValidIanaTimeZone(browser)) return { zone: browser, source: "browser" };

  return { zone: null, source: "none" };
}
