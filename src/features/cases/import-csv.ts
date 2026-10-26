/**
 * Issue #201, one-time case import.
 *
 * CSV columns (header row required, order-insensitive):
 *   parent name, phone, tutor, subject, rate, lesson dates, fee paid
 *
 * Accepts the issue's plain headers plus a few obvious aliases. Parsing is
 * pure; the admin server fn resolves names to tutor/parent rows and reuses
 * organisations on rerun (no duplicate org, slug, or owner row, enforced by
 * admin_create_sor_case + the unique organisation_members pair).
 */

export type ParsedImportRow = {
  parentName: string;
  phone: string;
  tutor: string;
  subject: string;
  rateHkd: number;
  lessonDates: string[]; // ISO dates as written (validated, not resolved)
  feePaid: boolean;
};

export type ImportRowError = { row: number; field: string; message: string };

export type ParseCaseImportResult = {
  rows: ParsedImportRow[];
  errors: ImportRowError[];
};

const HEADER_ALIASES: Record<string, string> = {
  "parent name": "parentName",
  parent: "parentName",
  parent_name: "parentName",
  phone: "phone",
  "phone number": "phone",
  "parent phone": "phone",
  tutor: "tutor",
  "tutor name": "tutor",
  subject: "subject",
  rate: "rate",
  "hourly rate": "rate",
  "rate hkd": "rate",
  "lesson dates": "lessonDates",
  "lesson date": "lessonDates",
  lessons: "lessonDates",
  "lesson dates (1 and 2)": "lessonDates",
  "fee paid": "feePaid",
  "fee paid?": "feePaid",
  fee: "feePaid",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLASH_DATE = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;
const DASH_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/; // D/M/YYYY, HK order

/** Normalise a lesson date to YYYY-MM-DD; null when unparseable. */
export function normalizeLessonDate(raw: string): string | null {
  const v = raw.trim();
  if (ISO_DATE.test(v)) return v;
  const slash = SLASH_DATE.exec(v);
  if (slash) {
    const [, y, m, d] = slash;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const dmy = DASH_DATE.exec(v);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function parseRate(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseFeePaid(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (["yes", "y", "true", "paid", "1"].includes(v)) return true;
  if (["no", "n", "false", "unpaid", "0", ""].includes(v)) return false;
  return null;
}

/** Minimal CSV splitter handling quoted cells; no multi-line records (import rows are flat). */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export function parseCaseImportCsv(csv: string): ParseCaseImportResult {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: ParsedImportRow[] = [];
  const errors: ImportRowError[] = [];

  if (lines.length === 0) {
    return { rows, errors: [{ row: 0, field: "csv", message: "empty file" }] };
  }

  const headerCells = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const fieldByIndex = headerCells.map((h) => {
    const mapped = HEADER_ALIASES[h];
    if (!mapped) errors.push({ row: 0, field: h, message: `unknown column "${h}"` });
    return mapped ?? null;
  });

  const required = ["parentName", "phone", "tutor", "subject", "rate", "lessonDates", "feePaid"];
  for (const req of required) {
    if (!fieldByIndex.includes(req)) {
      errors.push({ row: 0, field: req, message: `missing required column "${req}"` });
    }
  }
  if (errors.length > 0) return { rows, errors };

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const rec: Partial<Record<string, string>> = {};
    cells.forEach((c, idx) => {
      const field = fieldByIndex[idx];
      if (field) rec[field] = c;
    });

    const rate = parseRate(rec.rate ?? "");
    if (rate === null) {
      errors.push({ row: i, field: "rate", message: `invalid hourly rate "${rec.rate ?? ""}"` });
    }

    const datesRaw = (rec.lessonDates ?? "")
      .split(/[;|]|(?: and )|(?: & )/i)
      .map((d) => d.trim())
      .filter(Boolean);
    const dates: string[] = [];
    for (const d of datesRaw) {
      const norm = normalizeLessonDate(d);
      if (norm === null) {
        errors.push({ row: i, field: "lessonDates", message: `invalid date "${d}"` });
      } else {
        dates.push(norm);
      }
    }
    if (dates.length === 0) {
      errors.push({ row: i, field: "lessonDates", message: "no lesson dates given" });
    }

    const feePaid = parseFeePaid(rec.feePaid ?? "");
    if (feePaid === null) {
      errors.push({
        row: i,
        field: "feePaid",
        message: `fee paid must be yes/no, got "${rec.feePaid ?? ""}"`,
      });
    }

    if (!rec.parentName)
      errors.push({ row: i, field: "parentName", message: "missing parent name" });
    if (!rec.phone) errors.push({ row: i, field: "phone", message: "missing phone" });
    if (!rec.tutor) errors.push({ row: i, field: "tutor", message: "missing tutor" });
    if (!rec.subject) errors.push({ row: i, field: "subject", message: "missing subject" });

    if (
      rate !== null &&
      dates.length > 0 &&
      feePaid !== null &&
      rec.parentName &&
      rec.phone &&
      rec.tutor &&
      rec.subject
    ) {
      rows.push({
        parentName: rec.parentName,
        phone: rec.phone,
        tutor: rec.tutor,
        subject: rec.subject,
        rateHkd: rate,
        lessonDates: dates,
        feePaid,
      });
    }
  }

  return { rows, errors };
}
