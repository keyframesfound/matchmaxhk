/**
 * #552: parent trust pills on case cards. They only ever show real data past
 * the same threshold as the tutor rating (#649), so one review can never single
 * out a parent. Everything is aggregated server-side; parent ids stay private.
 */

export const MIN_TRUST_SAMPLES = 3;
/** A month's tuition counts as on time when settled within a week of month end. */
export const STATEMENT_GRACE_DAYS = 7;
const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ParentTrust = {
  /** One decimal, from tutors' visible reviews. Null below the threshold. */
  rating: number | null;
  ratingCount: number;
  onTime: boolean;
};

type TrustQuery = PromiseLike<{ data: unknown }> & {
  eq: (column: string, value: string) => TrustQuery;
  in: (column: string, values: string[]) => TrustQuery;
};
export type TrustDb = { from: (table: string) => { select: (columns: string) => TrustQuery } };

export type StatementPayment = { paidAt: string | null; dueAt: string | null };

export function computeParentTrust(
  ratings: readonly number[],
  statements: readonly StatementPayment[],
): ParentTrust | null {
  const rated = ratings.length >= MIN_TRUST_SAMPLES;
  const settled = statements.filter((s) => s.paidAt && s.dueAt);
  const onTime =
    settled.length >= MIN_TRUST_SAMPLES &&
    settled.every((s) => Date.parse(s.paidAt as string) <= Date.parse(s.dueAt as string));
  if (!rated && !onTime) return null;
  const mean = ratings.reduce((sum, rating) => sum + rating, 0) / (ratings.length || 1);
  return {
    rating: rated ? Math.round(mean * 10) / 10 : null,
    ratingCount: ratings.length,
    onTime,
  };
}

/** End of the grace period for a "YYYY-MM" statement, in HKT. */
export function statementDueAt(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const nextMonthStart = Date.UTC(year, monthNumber, 1) - HKT_OFFSET_MS;
  return new Date(nextMonthStart + STATEMENT_GRACE_DAYS * DAY_MS).toISOString();
}

/** Bulk read for the board. Trust is decoration: a failed read just shows no pills. */
export async function parentTrustByCase(
  db: TrustDb,
  caseIds: readonly string[],
): Promise<Map<string, ParentTrust>> {
  if (caseIds.length === 0) return new Map();
  const { data: cases } = await db
    .from("tutoring_cases")
    .select("id, parent_id")
    .in("id", [...caseIds]);
  const rows = (cases ?? []) as { id: string; parent_id: string | null }[];
  const parentIds = [...new Set(rows.flatMap((c) => (c.parent_id ? [c.parent_id] : [])))];
  if (parentIds.length === 0) return new Map();
  const { data: owned } = await db
    .from("tutoring_cases")
    .select("id, parent_id")
    .in("parent_id", parentIds);
  const parentOf = new Map(
    ((owned ?? []) as { id: string; parent_id: string }[]).map((c) => [c.id, c.parent_id]),
  );
  const allCaseIds = [...parentOf.keys()];
  const [reviews, statements] = await Promise.all([
    db
      .from("case_reviews")
      .select("case_id, rating")
      .eq("direction", "tutor_to_parent")
      .eq("status", "visible")
      .in("case_id", allCaseIds),
    db
      .from("case_statement_months")
      .select("case_id, month, marked_at")
      .eq("status", "paid")
      .eq("marked_by_role", "tutor")
      .in("case_id", allCaseIds),
  ]);
  const ratings = new Map<string, number[]>();
  for (const row of (reviews.data ?? []) as { case_id: string; rating: number }[]) {
    const parent = parentOf.get(row.case_id);
    if (parent) ratings.set(parent, [...(ratings.get(parent) ?? []), row.rating]);
  }
  const payments = new Map<string, StatementPayment[]>();
  for (const row of (statements.data ?? []) as {
    case_id: string;
    month: string;
    marked_at: string | null;
  }[]) {
    const parent = parentOf.get(row.case_id);
    if (!parent) continue;
    const payment = { paidAt: row.marked_at, dueAt: statementDueAt(row.month) };
    payments.set(parent, [...(payments.get(parent) ?? []), payment]);
  }
  const result = new Map<string, ParentTrust>();
  for (const row of rows) {
    if (!row.parent_id) continue;
    const trust = computeParentTrust(
      ratings.get(row.parent_id) ?? [],
      payments.get(row.parent_id) ?? [],
    );
    if (trust) result.set(row.id, trust);
  }
  return result;
}
