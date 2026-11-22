/**
 * #815 §2.8 (was #256): a partner centre sends ONE named student per request.
 * A request that asks for a pool / team of tutors is a staffing request, not
 * an introduction, and is rejected (AC-C1-1). Pure for vitest and the server.
 */

export const CENTRE_CASE_STUDENTS = 1;

export const TUTOR_POOL_MESSAGE =
  "Each request is for one named student and one tutor. To find several tutors at once, send one request per student. / 每個申請只限一位指定學生及一位導師。如需多位導師，請為每位學生分開提交申請。";

const TUTOR_POOL_PATTERNS: RegExp[] = [
  /\b(?:[2-9]|\d{2,}|two|three|four|five|six|several|multiple|many|some)\s+(?:different\s+|more\s+)?tutors\b/i,
  /\b(?:a|our)\s+(?:pool|team|bank|roster|panel|list)\s+of\s+tutors\b/i,
  /\btutor\s+(?:pool|bank|roster|panel)\b/i,
  /(?:[2-9]|\d{2,}|兩|两|三|四|五|六|幾|几|多|數|数)\s*(?:位|個|个|名)\s*(?:導師|导师|老師|老师)/,
  /(?:導師|导师)(?:團隊|团队|庫|库|名單|名单)/,
  /一班(?:導師|导师|老師|老师)/,
];

/** True when the free text asks for several tutors instead of one introduction. */
export function isTutorPoolRequest(...texts: (string | null | undefined)[]): boolean {
  const haystack = texts.filter(Boolean).join("\n");
  return TUTOR_POOL_PATTERNS.some((pattern) => pattern.test(haystack));
}
