/**
 * #671 optional WhatsApp summary (MAY channel, V1): a paste-ready bilingual
 * digest. Desk ops (or the user) copy it from the bell menu and paste it into
 * an existing WhatsApp thread — there is NO continuous WA delivery, no WA
 * Business API push (parked), and no send-side SLA. Pure builder: the caller
 * resolves labels via i18n and HKT date formatting, this only shapes text.
 */

export type WaSummaryLine = {
  /** English line (EN first — the desk works in EN). */
  en: string;
  /** Traditional Chinese line (繁中). */
  zh: string;
};

export type WaSummaryInput = {
  /** e.g. "7 Nov 2026, 14:30 HKT" (caller formats with Asia/Hong_Kong). */
  generatedEn: string;
  /** e.g. "2026年11月7日 14:30 (香港時間)". */
  generatedZh: string;
  lines: WaSummaryLine[];
  /** Keep the digest short enough to paste; older items collapse into a count. */
  maxLines?: number;
  /** Shown when lines is empty (i18n-resolved by the caller). */
  emptyEn: string;
  emptyZh: string;
};

export const WA_SUMMARY_MAX_LINES = 10;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function buildWaSummary(input: WaSummaryInput): string {
  const max = input.maxLines ?? WA_SUMMARY_MAX_LINES;
  const shown = input.lines.slice(0, max);
  const overflow = input.lines.length - shown.length;

  const headerEn = `📋 MatchMax update — ${input.generatedEn}`;
  const headerZh = `📋 MatchMax 更新 — ${input.generatedZh}`;
  const numbered = shown.map((l, i) => `${pad(i + 1)}. ${l.en}\n    ${l.zh}`);
  if (overflow > 0) {
    numbered.push(`${pad(shown.length + 1)}. (+${overflow} more / 另有 ${overflow} 項)`);
  }

  const bodyLines = shown.length === 0 ? [input.emptyEn, input.emptyZh] : numbered;

  return [
    headerEn,
    headerZh,
    "",
    ...bodyLines,
    "",
    "— MatchMax.hk · V1 desk summary / V1 桌面摘要",
  ].join("\n");
}

/**
 * HKT timestamp formatting for the digest header. Kept beside the builder so
 * every WA digest carries an explicit HKT stamp (issue: "HKT timestamps").
 */
export function waSummaryTimestamp(now: Date = new Date()): { en: string; zh: string } {
  const parts = new Intl.DateTimeFormat("en-HK", {
    timeZone: "Asia/Hong_Kong",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const en = `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")} HKT`;

  const zhParts = new Intl.DateTimeFormat("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const zhGet = (type: string) => zhParts.find((p) => p.type === type)?.value ?? "";
  const zh = `${zhGet("year")}年${zhGet("month")}月${zhGet("day")}日 ${zhGet("hour")}:${zhGet("minute")}（香港時間）`;
  return { en, zh };
}
