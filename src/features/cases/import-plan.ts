/**
 * Issue #201 — one-time case import: pure planning half.
 *
 * parseCaseImportCsv (import-csv.ts) turns the CSV into rows; this module
 * turns rows into concrete creation ops given lookups into the live DB. The
 * admin server fn (import.functions.ts) is a thin wrapper: resolve lookups,
 * build ops, execute. Keeping the plan pure makes rerun-dedupe and the
 * fee-paid mapping vitest-testable without a DB.
 */

import type { ParsedImportRow } from "@/features/cases/import-csv";

export type ImportTutor = {
  id: string;
  user_id: string | null;
  display_name: string;
  tutor_code: string | null;
};

export type ImportParent = { id: string };

export type ImportLookup = {
  findTutor: (nameOrCode: string) => ImportTutor | null;
  findParentByPhone: (phone: string) => ImportParent | null;
};

export type ImportOp = {
  rowNumber: number;
  parentName: string;
  phone: string;
  tutorId: string;
  parentAccountId: string | null;
  hourlyRateHkd: number;
  subject: string;
  /** Lesson dates in CSV order; sequence = position (1-based). */
  lessonDateKeys: string[];
  feePaid: boolean;
};

export type PlanResult = {
  ops: ImportOp[];
  errors: { row: number; message: string }[];
};

/**
 * Digits-only phone normalization for parent matching. A +852 country code is
 * stripped when the remainder is an 8-digit HK number, so "+852 9123 4567"
 * and "9123-4567" land on the same key.
 */
export function normalizePhone(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length >= 10 && digits.length <= 11 && digits.startsWith("852")) {
    return digits.slice(3);
  }
  return digits;
}

/**
 * Resolve each CSV row to a creation op. A row with an unresolvable tutor
 * becomes an error (never a guess); parents are optional (phone-only rows
 * have no account — #201 import).
 */
export function buildImportOps(rows: ParsedImportRow[], lookup: ImportLookup): PlanResult {
  const ops: ImportOp[] = [];
  const errors: PlanResult["errors"] = [];

  rows.forEach((row, idx) => {
    const rowNumber = idx + 1; // human-facing (header is line 0)
    const tutor = lookup.findTutor(row.tutor);
    if (!tutor) {
      errors.push({ row: rowNumber, message: `tutor "${row.tutor}" not found` });
      return;
    }
    const parent = row.phone ? lookup.findParentByPhone(row.phone) : null;
    ops.push({
      rowNumber,
      parentName: row.parentName,
      phone: row.phone,
      tutorId: tutor.id,
      parentAccountId: parent?.id ?? null,
      hourlyRateHkd: row.rateHkd,
      subject: row.subject,
      lessonDateKeys: [...row.lessonDates].sort(),
      feePaid: row.feePaid,
    });
  });

  return { ops, errors };
}
