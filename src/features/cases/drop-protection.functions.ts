/**
 * Epic #537 — Drop-Protection desk server fns (#520 / #525 / #508 / #528 / #529).
 *
 * Admin-gated, service-role only (the drop columns have no authenticated
 * grant). Fee math is NEVER computed here: every number comes from the pure
 * #536 engine (resolveCaseFee) fed by the #508 ownership snapshot, so the
 * panel preview and the saved snapshot are the same function call.
 *
 *  - getDropProtectionState — one round-trip for the panel: R, tier, window,
 *    suggested outcome, saved decision, open risk flags, parent blacklist.
 *  - recordDropOutcome      — validate (dropRecordError), resolve, persist the
 *    decision + final_commission_due snapshot, audit, and apply the trust
 *    consequences (parent blacklist, tutor strike / 30-day shadowban) only
 *    when the rule changes, so a re-save never double-counts a strike.
 *
 * Bans stay a human action in the account tools: the result returns the
 * engine's `banTutor` hint and the panel points the operator there.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import {
  BYPASS_FLAGS,
  DROP_INITIATORS,
  DROP_REASON_CLASSES,
  DROP_VERIFICATIONS,
  DROP_VERIFIED_BY,
  OUTCOME_KINDS,
  PROMO_TYPES,
  SPLIT_MODES,
  buildOutcome,
  dropRecordError,
  normalizeBypassFlag,
  normalizeDropVerification,
  normalizePromoType,
  normalizeSplitMode,
  resolveCaseFee,
  standardLessonValueHkd,
  suggestOutcomeKind,
  trustCounterDelta,
  trustCountersFor,
  type BypassFlag,
  type DropInitiator,
  type DropReasonClass,
  type DropVerification,
  type DropVerifiedBy,
  type FeeResolution,
  type OutcomeKind,
  type PromoType,
  type SplitMode,
} from "@/features/cases/fee-drop";
import {
  ownershipSnapshot,
  type CounterpartyKind,
  type OwnershipSnapshot,
  type PriorCase,
} from "@/features/cases/ownership-window";
import { hashPhone } from "@/features/trust/trust";
import { insertAudit, requireAdmin, selectRows, type Db, type Row } from "@/features/cases/desk-db";

const DAY_MS = 24 * 60 * 60 * 1000;
const ENDED_SOR_STATUSES = new Set(["closed", "replaced", "waived"]);

type DropCaseRow = {
  id: string;
  case_code: string;
  hourly_rate_hkd: number | null;
  session_length_minutes: number | null;
  student_count: number;
  package_type: string | null;
  matched_tutor_id: string | null;
  parent_id: string | null;
  organisation_id: string | null;
  contact_phone: string | null;
  sor_status: string | null;
  ended_by_parent_at: string | null;
  ended_by_tutor_at: string | null;
  promo_type: string | null;
  first_lesson_discount_pct: number | null;
  commission_split_mode: string | null;
  drop_outcome: string | null;
  drop_initiator: string | null;
  drop_reason_class: string | null;
  drop_verification: string | null;
  drop_verified_by: string | null;
  drop_proof_note: string | null;
  drop_recorded_at: string | null;
  bypass_flag: string | null;
  fee_rule_id: string | null;
  consequences_rule_id: string | null;
  final_commission_due: number | null;
};

const CASE_COLS =
  "id, case_code, hourly_rate_hkd, session_length_minutes, student_count, package_type, matched_tutor_id, parent_id, organisation_id, contact_phone, sor_status, ended_by_parent_at, ended_by_tutor_at, promo_type, first_lesson_discount_pct, commission_split_mode, drop_outcome, drop_initiator, drop_reason_class, drop_verification, drop_verified_by, drop_proof_note, drop_recorded_at, bypass_flag, fee_rule_id, consequences_rule_id, final_commission_due";

type LessonRow = { case_id: string; sequence: number; status: string; done_at: string | null };

export type SavedDropDecision = {
  outcomeKind: OutcomeKind | null;
  initiator: DropInitiator | null;
  reasonClass: DropReasonClass | null;
  verification: DropVerification;
  verifiedBy: DropVerifiedBy | null;
  proofNote: string | null;
  recordedAt: string | null;
  bypass: BypassFlag;
  promoType: PromoType;
  discountPct: number | null;
  splitMode: SplitMode;
  feeRuleId: string | null;
  finalCommissionDueHkd: number | null;
};

export type DropProtectionState = {
  caseCode: string;
  lessonValueHkd: number | null;
  studentCount: number;
  packageType: string | null;
  counterparty: CounterpartyKind | null;
  ownership: OwnershipSnapshot;
  priorQualityDrops: number;
  suggestedOutcome: OutcomeKind;
  saved: SavedDropDecision;
  openRiskFlags: Array<{ id: string; flagType: string; source: string; note: string | null }>;
  parentBlacklisted: boolean;
};

function oneOfOrNull<T extends string>(values: readonly T[], value: unknown): T | null {
  return (values as readonly unknown[]).includes(value) ? (value as T) : null;
}

async function loadCase(db: Db, caseId: string): Promise<DropCaseRow> {
  const rows = await selectRows<DropCaseRow>(db, "tutoring_cases", CASE_COLS, [
    { col: "id", op: "eq", value: caseId },
  ]);
  if (!rows[0]) throw new Error("CASE_NOT_FOUND");
  return rows[0];
}

function counterpartyOf(
  c: DropCaseRow,
): { kind: CounterpartyKind; col: string; id: string } | null {
  if (c.organisation_id) return { kind: "centre", col: "organisation_id", id: c.organisation_id };
  if (c.parent_id) return { kind: "parent", col: "parent_id", id: c.parent_id };
  return null;
}

/**
 * Earlier cases between this tutor and this counterparty, as #508 PriorCase
 * rows. Only cases whose L1 landed BEFORE this case's own L1 count, so
 * re-saving an older case never picks up later siblings' tiers or window.
 */
async function loadPriorCases(
  db: Db,
  c: DropCaseRow,
  ownL1At: string | null,
): Promise<PriorCase[]> {
  const party = counterpartyOf(c);
  if (!party || !c.matched_tutor_id) return [];
  const siblings = await selectRows<{ id: string }>(db, "tutoring_cases", "id", [
    { col: "matched_tutor_id", op: "eq", value: c.matched_tutor_id },
    { col: party.col, op: "eq", value: party.id },
  ]);
  const ids = siblings.map((s) => s.id).filter((id) => id !== c.id);
  if (ids.length === 0) return [];
  const lessons = await selectRows<LessonRow>(
    db,
    "case_lessons",
    "case_id, sequence, status, done_at",
    [
      { col: "case_id", op: "in", value: ids },
      { col: "sequence", op: "in", value: [1, 2] },
    ],
  );
  const ownCutoff = ownL1At ? Date.parse(ownL1At) : Number.POSITIVE_INFINITY;
  return ids
    .map((id) => {
      const own = lessons.filter((l) => l.case_id === id);
      const l1 = own.find((l) => l.sequence === 1 && l.status === "done");
      const l2 = own.find((l) => l.sequence === 2 && l.status === "done");
      return { caseId: id, firstPaidL1At: l1?.done_at ?? null, retained: Boolean(l2) };
    })
    .filter((p) => p.firstPaidL1At !== null && Date.parse(p.firstPaidL1At) < ownCutoff);
}

async function isParentBlacklisted(db: Db, c: DropCaseRow): Promise<boolean> {
  const checks: Array<{ col: string; value: string }> = [];
  if (c.parent_id) checks.push({ col: "parent_id", value: c.parent_id });
  const hash = await hashPhone(c.contact_phone);
  if (hash) checks.push({ col: "phone_hash", value: hash });
  for (const check of checks) {
    const rows = await selectRows<{ id: string; lifted_at: string | null }>(
      db,
      "trust_blacklist",
      "id, lifted_at",
      [{ col: check.col, op: "eq", value: check.value }],
    );
    if (rows.some((r) => r.lifted_at === null)) return true;
  }
  return false;
}

function savedDecision(c: DropCaseRow): SavedDropDecision {
  return {
    outcomeKind: oneOfOrNull(OUTCOME_KINDS, c.drop_outcome),
    initiator: oneOfOrNull(DROP_INITIATORS, c.drop_initiator),
    reasonClass: oneOfOrNull(DROP_REASON_CLASSES, c.drop_reason_class),
    verification: normalizeDropVerification(c.drop_verification),
    verifiedBy: oneOfOrNull(DROP_VERIFIED_BY, c.drop_verified_by),
    proofNote: c.drop_proof_note,
    recordedAt: c.drop_recorded_at,
    bypass: normalizeBypassFlag(c.bypass_flag),
    promoType: normalizePromoType(c.promo_type),
    discountPct: c.first_lesson_discount_pct,
    splitMode: normalizeSplitMode(c.commission_split_mode),
    feeRuleId: c.fee_rule_id,
    finalCommissionDueHkd: c.final_commission_due == null ? null : Number(c.final_commission_due),
  };
}

type Context = {
  c: DropCaseRow;
  lessons: LessonRow[];
  ownership: OwnershipSnapshot;
  counterparty: CounterpartyKind | null;
  priorQualityDrops: number;
  lessonValueHkd: number | null;
};

async function loadContext(db: Db, caseId: string): Promise<Context> {
  const c = await loadCase(db, caseId);
  const lessons = await selectRows<LessonRow>(
    db,
    "case_lessons",
    "case_id, sequence, status, done_at",
    [{ col: "case_id", op: "eq", value: c.id }],
  );
  const ownL1 = lessons.find((l) => l.sequence === 1 && l.status === "done");
  const [priorCases, trust] = await Promise.all([
    loadPriorCases(db, c, ownL1?.done_at ?? null),
    c.matched_tutor_id
      ? selectRows<{ quality_drop_count: number }>(db, "tutor_trust_state", "quality_drop_count", [
          { col: "tutor_id", op: "eq", value: c.matched_tutor_id },
        ])
      : Promise.resolve([]),
  ]);
  const party = counterpartyOf(c);
  const ownership = ownershipSnapshot({
    kind: party?.kind ?? "parent",
    priorCases,
    asOf: ownL1?.done_at ? new Date(ownL1.done_at) : new Date(),
  });
  return {
    c,
    lessons,
    ownership,
    counterparty: party?.kind ?? null,
    // Exclude this case's own counted drop: the repeat rule looks at OTHER cases.
    priorQualityDrops: Math.max(
      0,
      (trust[0]?.quality_drop_count ?? 0) - trustCountersFor(c.consequences_rule_id).qualityDrops,
    ),
    lessonValueHkd: standardLessonValueHkd(c.hourly_rate_hkd, c.session_length_minutes),
  };
}

function caseEnded(c: DropCaseRow): boolean {
  return (
    ENDED_SOR_STATUSES.has(c.sor_status ?? "") ||
    c.ended_by_parent_at !== null ||
    c.ended_by_tutor_at !== null
  );
}

export const getDropProtectionState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<DropProtectionState> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const ctx = await loadContext(db, data.caseId);
    const [flags, parentBlacklisted] = await Promise.all([
      selectRows<{
        id: string;
        flag_type: string;
        source: string;
        note: string | null;
        resolved_at: string | null;
      }>(db, "case_risk_flags", "id, flag_type, source, note, resolved_at", [
        { col: "case_id", op: "eq", value: ctx.c.id },
      ]),
      isParentBlacklisted(db, ctx.c),
    ]);
    return {
      caseCode: ctx.c.case_code,
      lessonValueHkd: ctx.lessonValueHkd,
      studentCount: ctx.c.student_count,
      packageType: ctx.c.package_type,
      counterparty: ctx.counterparty,
      ownership: ctx.ownership,
      priorQualityDrops: ctx.priorQualityDrops,
      suggestedOutcome: suggestOutcomeKind({ lessons: ctx.lessons, caseEnded: caseEnded(ctx.c) }),
      saved: savedDecision(ctx.c),
      openRiskFlags: flags
        .filter((f) => f.resolved_at === null)
        .map((f) => ({ id: f.id, flagType: f.flag_type, source: f.source, note: f.note })),
      parentBlacklisted,
    };
  });

const recordInput = z.object({
  caseId: z.string().uuid(),
  outcomeKind: z.enum(OUTCOME_KINDS),
  initiator: z.enum(DROP_INITIATORS).nullable().optional(),
  reasonClass: z.enum(DROP_REASON_CLASSES).nullable().optional(),
  verification: z.enum(DROP_VERIFICATIONS).nullable().optional(),
  verifiedBy: z.enum(DROP_VERIFIED_BY).nullable().optional(),
  proofNote: z.string().max(2000).nullable().optional(),
  bypass: z.enum(BYPASS_FLAGS),
  promoType: z.enum(PROMO_TYPES),
  discountPct: z.number().int().min(1).max(100).nullable().optional(),
  splitMode: z.enum(SPLIT_MODES),
  /** Operator confirms the hostile-parent blacklist (default on in the UI). */
  confirmBlacklist: z.boolean().default(true),
});

type RecordInput = z.infer<typeof recordInput>;

/**
 * Apply only the DELTA between the rule whose counters this case already
 * contributed (consequences_rule_id) and the new rule, so re-saves, pending →
 * verified moves and A → B → A corrections never double-count.
 */
async function applyTutorConsequences(
  db: Db,
  tutorId: string,
  actorId: string,
  appliedRuleId: string | null,
  nextRuleId: string,
): Promise<void> {
  const delta = trustCounterDelta(appliedRuleId, nextRuleId);
  const hasChange =
    delta.strikes !== 0 ||
    delta.tutorDrops !== 0 ||
    delta.qualityDrops !== 0 ||
    delta.shadowban !== "keep";
  if (!hasChange) return;

  const existing = await selectRows<{
    strike_count: number;
    tutor_initiated_drop_count: number;
    quality_drop_count: number;
    shadowban_until: string | null;
  }>(
    db,
    "tutor_trust_state",
    "strike_count, tutor_initiated_drop_count, quality_drop_count, shadowban_until",
    [{ col: "tutor_id", op: "eq", value: tutorId }],
  );
  const prev = existing[0];
  const shadowbanUntil =
    delta.shadowban === "set"
      ? new Date(Date.now() + delta.shadowbanDays * DAY_MS).toISOString()
      : delta.shadowban === "clear"
        ? null
        : (prev?.shadowban_until ?? null);
  const floor0 = (n: number) => Math.max(0, n);
  const { error } = await db.from<Row>("tutor_trust_state").upsert(
    {
      tutor_id: tutorId,
      strike_count: floor0((prev?.strike_count ?? 0) + delta.strikes),
      tutor_initiated_drop_count: floor0(
        (prev?.tutor_initiated_drop_count ?? 0) + delta.tutorDrops,
      ),
      quality_drop_count: floor0((prev?.quality_drop_count ?? 0) + delta.qualityDrops),
      shadowban_until: shadowbanUntil,
      updated_at: new Date().toISOString(),
      updated_by: actorId,
    },
    { onConflict: "tutor_id" },
  );
  if (error) throw new Error(error.message);
}

async function blacklistParent(
  db: Db,
  c: DropCaseRow,
  actorId: string,
  note: string | null,
): Promise<void> {
  if (await isParentBlacklisted(db, c)) return;
  const phoneHash = await hashPhone(c.contact_phone);
  if (!phoneHash && !c.parent_id) throw new Error("NO_PARENT_KEY_TO_BLACKLIST");
  const { error } = await db
    .from<Row>("trust_blacklist")
    .insert({
      subject: "parent",
      phone_hash: phoneHash,
      parent_id: c.parent_id,
      reason: "HOSTILE_PARENT",
      evidence_note: note ? note.slice(0, 500) : null,
      source_case_id: c.id,
      created_by: actorId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
}

export const recordDropOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => recordInput.parse(input))
  .handler(async ({ context, data }): Promise<FeeResolution> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const gateError = dropRecordError({
      kind: data.outcomeKind,
      initiator: data.initiator ?? null,
      verification: data.verification ?? null,
      verifiedBy: data.verifiedBy ?? null,
      proofNote: data.proofNote ?? null,
      promoType: data.promoType,
      discountPct: data.discountPct ?? null,
    });
    if (gateError) throw new Error(gateError);

    const ctx = await loadContext(db, data.caseId);
    if (ctx.lessonValueHkd === null) throw new Error("NO_RATE_OR_DURATION");

    const isStop = data.outcomeKind === "stopped_after_l1";
    const resolution = resolveCaseFee({
      lessonValueHkd: ctx.lessonValueHkd,
      studentCount: ctx.c.student_count,
      promoType: data.promoType,
      firstLessonDiscountPct: data.discountPct ?? undefined,
      splitMode: data.splitMode,
      packageType: ctx.c.package_type,
      tier: ctx.ownership.tier,
      ownership: ctx.ownership.state,
      bypass: data.bypass,
      priorQualityDrops: ctx.priorQualityDrops,
      outcome: buildOutcome({
        kind: data.outcomeKind,
        initiator: data.initiator,
        verification: data.verification,
        reasonClass: data.reasonClass,
      }),
    });

    // Consequences run BEFORE the case row is saved: if a write throws, the
    // stored consequences_rule_id is unchanged and a retry applies them again.
    // Blacklisting is idempotent on its own (skips a live entry), so it runs
    // on every save where the rule calls for it and the operator ticked it.
    if (resolution.consequences.blacklistParent && data.confirmBlacklist) {
      await blacklistParent(db, ctx.c, context.userId, data.proofNote ?? null);
    }
    if (ctx.c.matched_tutor_id) {
      await applyTutorConsequences(
        db,
        ctx.c.matched_tutor_id,
        context.userId,
        ctx.c.consequences_rule_id,
        resolution.ruleId,
      );
    }

    const { error } = await db
      .from<Row>("tutoring_cases")
      .update({
        promo_type: data.promoType,
        first_lesson_discount_pct: data.promoType === "discounted_first" ? data.discountPct : null,
        commission_split_mode: data.splitMode,
        drop_outcome: data.outcomeKind,
        drop_initiator: isStop ? (data.initiator ?? "parent") : null,
        drop_reason_class: isStop ? (data.reasonClass ?? "vague") : null,
        drop_verification: isStop ? (data.verification ?? "pending") : "none",
        drop_verified_by: isStop ? (data.verifiedBy ?? null) : null,
        drop_proof_note: data.proofNote?.trim() || null,
        drop_recorded_at: new Date().toISOString(),
        drop_recorded_by: context.userId,
        bypass_flag: data.bypass,
        secondary_tier_applied: String(ctx.ownership.tier),
        fee_rule_id: resolution.ruleId,
        consequences_rule_id: resolution.ruleId,
        final_commission_due: resolution.finalCommissionDueHkd,
      })
      .eq("id", ctx.c.id);
    if (error) throw new Error(error.message);

    await insertAudit(
      db,
      ctx.c.id,
      context.userId,
      "drop_decision",
      `[#536 ${resolution.ruleId}] due=${resolution.finalCommissionDueHkd ?? "n/a"} tier=${ctx.ownership.tier} window=${ctx.ownership.state}`,
    );
    return resolution;
  });
