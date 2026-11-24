/**
 * #798 AC-9 — where the join intake puts the confirmed IANA time zone.
 *
 * `tutors.timezone` is the canonical, CHECK-validated column
 * (`tutors_timezone_valid`) and the one every scheduling formatter, the
 * settings picker and the availability grid read. `tutors.time_zone` is a
 * legacy column the intake used to write by mistake, so a tutor who confirmed
 * a non-HK zone kept `Asia/Hong_Kong` everywhere scheduling looked.
 *
 * Pure so the mapping is testable without a database.
 */

export type LocalityInput = {
  city?: string | null;
  timeZone?: string | null;
};

export type LocalityPatch = {
  city?: string;
  timezone?: string;
};

export function localityPatch(input: LocalityInput): LocalityPatch {
  const patch: LocalityPatch = {};
  const city = (input.city ?? "").trim();
  if (city) patch.city = city;
  const timeZone = (input.timeZone ?? "").trim();
  if (timeZone) patch.timezone = timeZone;
  return patch;
}
