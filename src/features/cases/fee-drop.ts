/**
 * Issue #536 — the shared Fee & Drop state machine (single SoT).
 *
 * Every fee/drop/trust rule from the #537 cluster resolves through ONE pure
 * function, resolveCaseFee, so #520 (Drop-Protection + promos), #525 (full
 * drop rules), #508 (6-Month Ownership Boundary ladder), #528 (tutor L1 quit)
 * and #529 (hostile parent / flake) can never drift. The desk server fns, the
 * admin panel and the vitest suite all call it; docs/fee-drop-state-machine.md
 * carries the same table as a Mermaid diagram. Change a rule HERE (and on
 * #536) first, then the children.
 *
 * Units: every multiplier is "× R", where R is the case's locked
 * hourly_rate_hkd, the same rate basis the #385 match-fee panel
 * (fee-breakdown.ts) invoices 1.5× on (CEO 2026-10-30: the lesson price is
 * the hourly rate). Amounts scale by student count and round once to whole
 * HKD (#385 / #391 precedent).
 *
 * CEO locks encoded (do not reopen):
 *   * Default split 100_50: 1.0×R after L1 + 0.5×R after L2 = 1.5×R. 75_75 is
 *     an opt-in A/B only; Drop-Protection still cuts only the L1 portion.
 *   * Drop-Protection (tutor keeps half of the first paid lesson) needs a
 *     PARENT or CENTRE verification. Tutor word alone never reduces the fee.
 *   * Protected fee = min(base, 0.5×R): the #508 platform floor, so a Tier 3
 *     case stays at 0.5×R (never 0.25) and a $0 tier stays $0.
 *   * Clear tutor fault, suspected bypass, rejected verification and repeat
 *     quality drops VOID protection: the L1 portion stays due.
 *   * Hostile parent (admin-verified) → tutor keeps the 0.5×R protection,
 *     parent blacklisted, no tutor penalty (#529).
 *   * Tutor flake → L1 portion due + 30-day shadowban + strike; never chase
 *     the extra 0.5 to force 1.5 (#529 A1). Emergency with proof → no
 *     shadowban, strike still counted (#528).
 *   * No parent refund anywhere. Rematch is the parent remedy.
 *   * Day 181+ of the tutor×counterparty window → $0, not a MatchMax case.
 */

export const STANDARD_TOTAL_MULTIPLIER = 1.5;
export const DROP_PROTECTED_MULTIPLIER = 0.5;
export const SHADOWBAN_DAYS = 30;
/** #525 repeat pattern: this many prior quality-complaint drops voids protection. */
export const REPEAT_QUALITY_DROP_THRESHOLD = 2;

export const PROMO_TYPES = ["standard", "free_online_trial", "discounted_first"] as const;
export type PromoType = (typeof PROMO_TYPES)[number];

export const SPLIT_MODES = ["100_50", "75_75"] as const;
export type SplitMode = (typeof SPLIT_MODES)[number];

export const DROP_INITIATORS = ["parent", "centre", "tutor", "admin"] as const;
export type DropInitiator = (typeof DROP_INITIATORS)[number];

/** Admin case view states (#525 "Product / data notes"). */
export const DROP_VERIFICATIONS = [
  "none",
  "pending",
  "verified",
  "rejected_tutor_fault",
  "rejected_bypass",
] as const;
export type DropVerification = (typeof DROP_VERIFICATIONS)[number];

/** What the one "ask why" reply (or the tutor's evidence) came back as. */
export const DROP_REASON_CLASSES = [
  "vague",
  "tutor_fault",
  "serious_misconduct",
  "hostile_parent",
  "tutor_flake",
  "tutor_emergency",
] as const;
export type DropReasonClass = (typeof DROP_REASON_CLASSES)[number];

export const BYPASS_FLAGS = ["none", "suspected", "confirmed"] as const;
export type BypassFlag = (typeof BYPASS_FLAGS)[number];

/** #508 retained tier. "primary" is a parent's first private match (normal 1.5). */
export type SecondaryTier = "primary" | 1 | 2 | 3 | 4;

/** Ownership window relative to the tutor×counterparty first paid L1. */
export type OwnershipState = "not_started" | "inside" | "closed";

export type CaseOutcome =
  /** L1 not done yet; nothing is final. */
  | { kind: "in_progress" }
  /** Match rejected / cancelled before any lesson. Opens no window. */
  | { kind: "pre_l1_reject" }
  /** Free 15–20 min online intro (Lesson 0) only; family did not continue. */
  | { kind: "trial_only_stop" }
  /** Parent no-show or cancel < 24 h before L1: L1 counts as delivered. */
  | { kind: "l1_no_show" }
  /** Reached Lesson 2 or beyond. */
  | { kind: "continued" }
  /** Stopped after exactly one full paid lesson. */
  | {
      kind: "stopped_after_l1";
      initiator: DropInitiator;
      verification: DropVerification;
      reasonClass: DropReasonClass;
    };

export type FeeResolutionInput = {
  /** R: standard lesson value in HKD (hourly × standard duration). */
  lessonValueHkd: number;
  studentCount?: number;
  promoType?: PromoType;
  /** Tutor-funded discount on the first paid lesson, 0–100. */
  firstLessonDiscountPct?: number;
  splitMode?: SplitMode;
  packageType?: string | null;
  tier?: SecondaryTier;
  ownership?: OwnershipState;
  bypass?: BypassFlag;
  /** Prior early drops by this tutor with quality complaints (#525 repeat rule). */
  priorQualityDrops?: number;
  outcome: CaseOutcome;
};

export type FeeRuleId =
  | "IN_PROGRESS"
  | "PRO_BONO"
  | "OWNERSHIP_EXPIRED"
  | "PRE_L1_REJECT"
  | "FREE_TRIAL_STOP"
  | "NO_SHOW_L1_DUE"
  | "CONTINUED_FULL"
  | "BYPASS_CONFIRMED_FULL"
  | "BYPASS_SUSPECTED_VOID"
  | "VERIFICATION_PENDING"
  | "UNVERIFIED_VOID"
  | "TUTOR_FAULT_VOID"
  | "SERIOUS_MISCONDUCT_VOID"
  | "REPEAT_PATTERN_VOID"
  | "DROP_PROTECTED"
  | "HOSTILE_PARENT_PROTECTED"
  | "TUTOR_FLAKE_VOID"
  | "TUTOR_EMERGENCY_VOID";

export type FeeConsequences = {
  blacklistParent: boolean;
  banTutor: boolean;
  shadowbanTutorDays: number;
  strikeTutor: boolean;
  priorityRematch: boolean;
  /** Flag the tutor for ranking / hours review (#459), no investigation. */
  flagTutorForReview: boolean;
};

export type FeeResolution = {
  ruleId: FeeRuleId;
  /** × R before student scaling; null while nothing is final. */
  multiplier: number | null;
  /** Whole HKD due to MatchMax; null while nothing is final. */
  finalCommissionDueHkd: number | null;
  /** Base fee of this case's tier if it continues (× R). */
  baseMultiplier: number;
  protectionApplied: boolean;
  /** A completed paid L1 starts the #508 6-month window. */
  opensOwnershipWindow: boolean;
  /** Retained-Only: only a case past L2 advances the counterparty tier. */
  advancesRetainedTier: boolean;
  consequences: FeeConsequences;
};

const NO_CONSEQUENCES: FeeConsequences = {
  blacklistParent: false,
  banTutor: false,
  shadowbanTutorDays: 0,
  strikeTutor: false,
  priorityRematch: false,
  flagTutorForReview: false,
};

/** #508 ladder: base admin fee per retained tier (× R). */
export function tierBaseMultiplier(tier: SecondaryTier): number {
  if (tier === "primary" || tier === 1) return STANDARD_TOTAL_MULTIPLIER;
  if (tier === 2) return 1.0;
  if (tier === 3) return 0.5;
  return 0;
}

/** The L1 slice of a 1.5 case under the split mode (100_50 → 1.0, 75_75 → 0.75). */
export function lessonOnePortion(splitMode: SplitMode): number {
  return splitMode === "75_75" ? 0.75 : 1.0;
}

/**
 * R from the case's locked hourly_rate_hkd (the #385 rate basis). Null when
 * no positive rate is locked, so callers show "inputs incomplete" instead of
 * a fee that lies.
 */
export function lessonValueFromRate(hourlyRateHkd: number | null | undefined): number | null {
  if (hourlyRateHkd == null) return null;
  const rate = Number(hourlyRateHkd);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function normalizeCount(studentCount: number | undefined): number {
  return Number.isInteger(studentCount) && (studentCount as number) >= 1
    ? (studentCount as number)
    : 1;
}

function clampPct(pct: number | undefined): number {
  const n = Number(pct);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100, n);
}

type Draft = Omit<FeeResolution, "finalCommissionDueHkd" | "baseMultiplier">;

type DraftOverrides = {
  protectionApplied?: boolean;
  opensOwnershipWindow?: boolean;
  advancesRetainedTier?: boolean;
  consequences?: Partial<FeeConsequences>;
};

function draft(
  ruleId: FeeRuleId,
  multiplier: number | null,
  overrides: DraftOverrides = {},
): Draft {
  return {
    ruleId,
    multiplier,
    protectionApplied: overrides.protectionApplied ?? false,
    opensOwnershipWindow: overrides.opensOwnershipWindow ?? false,
    advancesRetainedTier: overrides.advancesRetainedTier ?? false,
    consequences: { ...NO_CONSEQUENCES, ...overrides.consequences },
  };
}

type StopContext = {
  /** L1 portion due when protection is void (tier-, split- and discount-adjusted). */
  voidFee: number;
  /** Floor-capped Drop-Protection amount. */
  protectedFee: number;
  bypass: BypassFlag;
  priorQualityDrops: number;
};

/** Tutor-initiated L1 quit (#528 / #529): flake by default, two narrow exceptions. */
function resolveTutorStop(
  outcome: Extract<CaseOutcome, { kind: "stopped_after_l1" }>,
  ctx: StopContext,
): Draft {
  const isVerified = outcome.verification === "verified";
  if (outcome.reasonClass === "hostile_parent" && isVerified) {
    return draft("HOSTILE_PARENT_PROTECTED", ctx.protectedFee, {
      opensOwnershipWindow: true,
      protectionApplied: ctx.protectedFee < ctx.voidFee,
      consequences: { blacklistParent: true },
    });
  }
  if (outcome.reasonClass === "tutor_emergency" && isVerified) {
    return draft("TUTOR_EMERGENCY_VOID", ctx.voidFee, {
      opensOwnershipWindow: true,
      consequences: { strikeTutor: true, priorityRematch: true },
    });
  }
  // An unproven hostile claim is treated as a flake (#529 A2 step 5).
  return draft("TUTOR_FLAKE_VOID", ctx.voidFee, {
    opensOwnershipWindow: true,
    consequences: { strikeTutor: true, priorityRematch: true, shadowbanTutorDays: SHADOWBAN_DAYS },
  });
}

/** Parent / centre / admin-reported stop: protection only after verification. */
function resolveClientStop(
  outcome: Extract<CaseOutcome, { kind: "stopped_after_l1" }>,
  ctx: StopContext,
): Draft {
  const opened = { opensOwnershipWindow: true };
  const { verification, reasonClass } = outcome;
  if (verification === "none" || verification === "pending") {
    return draft("VERIFICATION_PENDING", null, opened);
  }
  if (verification === "rejected_bypass") {
    return draft("UNVERIFIED_VOID", ctx.voidFee, {
      ...opened,
      consequences: { flagTutorForReview: true },
    });
  }
  if (reasonClass === "serious_misconduct") {
    return draft("SERIOUS_MISCONDUCT_VOID", ctx.voidFee, {
      ...opened,
      consequences: { banTutor: true, priorityRematch: true },
    });
  }
  if (verification === "rejected_tutor_fault" || reasonClass === "tutor_fault") {
    return draft("TUTOR_FAULT_VOID", ctx.voidFee, {
      ...opened,
      consequences: { priorityRematch: true },
    });
  }
  // A hostile parent is never the tutor's quality problem, so it wins over
  // the repeat-pattern rule, which only voids vague drops.
  if (reasonClass === "hostile_parent") {
    return draft("HOSTILE_PARENT_PROTECTED", ctx.protectedFee, {
      ...opened,
      protectionApplied: ctx.protectedFee < ctx.voidFee,
      consequences: { blacklistParent: true },
    });
  }
  if (ctx.priorQualityDrops >= REPEAT_QUALITY_DROP_THRESHOLD) {
    return draft("REPEAT_PATTERN_VOID", ctx.voidFee, {
      ...opened,
      consequences: { flagTutorForReview: true },
    });
  }
  return draft("DROP_PROTECTED", ctx.protectedFee, {
    ...opened,
    protectionApplied: ctx.protectedFee < ctx.voidFee,
  });
}

function resolveStopAfterL1(
  input: FeeResolutionInput,
  outcome: Extract<CaseOutcome, { kind: "stopped_after_l1" }>,
  base: number,
): Draft {
  const bypass = input.bypass ?? "none";
  if (bypass === "confirmed") {
    return draft("BYPASS_CONFIRMED_FULL", base, {
      opensOwnershipWindow: true,
      consequences: { banTutor: true },
    });
  }
  // A tutor-funded discount shrinks what was actually paid for L1; both the
  // void fee and the protection apply to the PAID amount (#520).
  const paidShare =
    input.promoType === "discounted_first" ? 1 - clampPct(input.firstLessonDiscountPct) / 100 : 1;
  const ctx: StopContext = {
    voidFee: Math.min(base, lessonOnePortion(input.splitMode ?? "100_50")) * paidShare,
    protectedFee: Math.min(base, DROP_PROTECTED_MULTIPLIER) * paidShare,
    bypass,
    priorQualityDrops: input.priorQualityDrops ?? 0,
  };
  if (bypass === "suspected") {
    return draft("BYPASS_SUSPECTED_VOID", ctx.voidFee, {
      opensOwnershipWindow: true,
      consequences: { flagTutorForReview: true },
    });
  }
  return outcome.initiator === "tutor"
    ? resolveTutorStop(outcome, ctx)
    : resolveClientStop(outcome, ctx);
}

function resolveMultiplier(input: FeeResolutionInput, base: number): Draft {
  const { outcome } = input;
  if (input.packageType === "pro_bono") return draft("PRO_BONO", 0);
  if (input.ownership === "closed") return draft("OWNERSHIP_EXPIRED", 0);

  switch (outcome.kind) {
    case "in_progress":
      return draft("IN_PROGRESS", null);
    case "pre_l1_reject":
      return draft("PRE_L1_REJECT", 0);
    case "trial_only_stop":
      return draft("FREE_TRIAL_STOP", 0);
    case "l1_no_show":
      return draft("NO_SHOW_L1_DUE", Math.min(base, lessonOnePortion(input.splitMode ?? "100_50")));
    case "continued":
      return input.bypass === "confirmed"
        ? draft("BYPASS_CONFIRMED_FULL", base, {
            opensOwnershipWindow: true,
            advancesRetainedTier: true,
            consequences: { banTutor: true },
          })
        : draft("CONTINUED_FULL", base, {
            opensOwnershipWindow: true,
            advancesRetainedTier: true,
          });
    case "stopped_after_l1":
      return resolveStopAfterL1(input, outcome, base);
  }
}

/** The one entry point: which rule fires, what is due, what follows. */
export function resolveCaseFee(input: FeeResolutionInput): FeeResolution {
  const baseMultiplier = tierBaseMultiplier(input.tier ?? "primary");
  const resolved = resolveMultiplier(input, baseMultiplier);
  const value = Number(input.lessonValueHkd);
  const finalCommissionDueHkd =
    resolved.multiplier === null || !Number.isFinite(value) || value < 0
      ? null
      : Math.round(value * normalizeCount(input.studentCount) * resolved.multiplier);
  return { ...resolved, baseMultiplier, finalCommissionDueHkd };
}

/** Desk copy for each rule (admin-only surface, English like the other panels). */
export const FEE_RULE_LABELS: Record<FeeRuleId, string> = {
  IN_PROGRESS: "In progress: nothing final yet",
  PRO_BONO: "Pro-bono: $0",
  OWNERSHIP_EXPIRED: "Past the 6-month window: $0, tutor-owned",
  PRE_L1_REJECT: "Rejected before Lesson 1: $0, no window opened",
  FREE_TRIAL_STOP: "Free online intro only: $0",
  NO_SHOW_L1_DUE: "No-show or late cancel: Lesson 1 portion due",
  CONTINUED_FULL: "Continued past Lesson 2: full tier fee",
  BYPASS_CONFIRMED_FULL: "Confirmed bypass: full fee due, ban tutor",
  BYPASS_SUSPECTED_VOID: "Suspected bypass: protection void",
  VERIFICATION_PENDING: "Waiting for parent or centre verification",
  UNVERIFIED_VOID: "Verification rejected: protection void",
  TUTOR_FAULT_VOID: "Clear tutor fault: protection void",
  SERIOUS_MISCONDUCT_VOID: "Serious misconduct: protection void, ban tutor",
  REPEAT_PATTERN_VOID: "Repeat early-drop pattern: protection void",
  DROP_PROTECTED: "Verified drop: Drop-Protection applied",
  HOSTILE_PARENT_PROTECTED: "Hostile parent: protection kept, blacklist parent",
  TUTOR_FLAKE_VOID: "Tutor quit: Lesson 1 portion due, 30-day shadowban",
  TUTOR_EMERGENCY_VOID: "Tutor emergency with proof: Lesson 1 portion due, no shadowban",
};

export const OUTCOME_KINDS = [
  "in_progress",
  "pre_l1_reject",
  "trial_only_stop",
  "l1_no_show",
  "continued",
  "stopped_after_l1",
] as const;
export type OutcomeKind = (typeof OUTCOME_KINDS)[number];

/** Minimal lesson row the suggestion reads (case_lessons). */
export type OutcomeLesson = { sequence: number; status: string };

/**
 * The desk's default outcome from the lesson rows + whether the case has
 * ended. Admin can always override; this only pre-selects the likely kind.
 */
export function suggestOutcomeKind(input: {
  lessons: readonly OutcomeLesson[];
  caseEnded: boolean;
}): OutcomeKind {
  const l1 = input.lessons.find((l) => l.sequence === 1);
  const l2 = input.lessons.find((l) => l.sequence === 2);
  if (l2?.status === "done") return "continued";
  if (l1?.status === "no_show" || l1?.status === "late_cancel") return "l1_no_show";
  if (l1?.status === "done") return input.caseEnded ? "stopped_after_l1" : "in_progress";
  return input.caseEnded ? "pre_l1_reject" : "in_progress";
}

/** Assemble the engine outcome from flat desk fields (DB columns or form state). */
export function buildOutcome(input: {
  kind: OutcomeKind;
  initiator?: DropInitiator | null;
  verification?: DropVerification | null;
  reasonClass?: DropReasonClass | null;
}): CaseOutcome {
  if (input.kind !== "stopped_after_l1") return { kind: input.kind };
  return {
    kind: "stopped_after_l1",
    initiator: input.initiator ?? "parent",
    verification: input.verification ?? "pending",
    reasonClass: input.reasonClass ?? "vague",
  };
}

/** The per-case tutor counters a rule contributes to tutor_trust_state. */
export type TrustCounters = {
  strikes: number;
  tutorDrops: number;
  qualityDrops: number;
  shadowbanDays: number;
};

const ZERO_COUNTERS: TrustCounters = {
  strikes: 0,
  tutorDrops: 0,
  qualityDrops: 0,
  shadowbanDays: 0,
};

/**
 * Counters derive from the RESOLVED rule only (never raw form input), so a
 * pending save counts nothing and a hostile-parent stop costs the tutor
 * nothing. Null (no rule applied yet) counts as zero.
 */
export function trustCountersFor(ruleId: string | null): TrustCounters {
  switch (ruleId) {
    case "TUTOR_FLAKE_VOID":
      return { strikes: 1, tutorDrops: 1, qualityDrops: 0, shadowbanDays: SHADOWBAN_DAYS };
    case "TUTOR_EMERGENCY_VOID":
      return { strikes: 1, tutorDrops: 1, qualityDrops: 0, shadowbanDays: 0 };
    case "TUTOR_FAULT_VOID":
    case "SERIOUS_MISCONDUCT_VOID":
      return { ...ZERO_COUNTERS, qualityDrops: 1 };
    default:
      return ZERO_COUNTERS;
  }
}

/**
 * Change to apply when a case's decision moves from the rule whose counters
 * were applied (`appliedRuleId`) to `nextRuleId`. Re-saving the same rule is
 * a zero delta; correcting a flake to an emergency removes the shadowban.
 */
export function trustCounterDelta(
  appliedRuleId: string | null,
  nextRuleId: string,
): TrustCounters & { shadowban: "set" | "clear" | "keep" } {
  const prev = trustCountersFor(appliedRuleId);
  const next = trustCountersFor(nextRuleId);
  const shadowban =
    next.shadowbanDays > 0 && prev.shadowbanDays === 0
      ? "set"
      : next.shadowbanDays === 0 && prev.shadowbanDays > 0
        ? "clear"
        : "keep";
  return {
    strikes: next.strikes - prev.strikes,
    tutorDrops: next.tutorDrops - prev.tutorDrops,
    qualityDrops: next.qualityDrops - prev.qualityDrops,
    shadowbanDays: next.shadowbanDays,
    shadowban,
  };
}

/** Who confirmed the stop: parent or centre WA reply, or admin-reviewed tutor evidence. */
export const DROP_VERIFIED_BY = ["parent_wa", "centre_wa", "admin_evidence"] as const;
export type DropVerifiedBy = (typeof DROP_VERIFIED_BY)[number];
export const DROP_PROOF_NOTE_MIN = 10;

export type DropRecordError =
  | "VERIFIED_BY_REQUIRED"
  | "PROOF_NOTE_REQUIRED"
  | "CLIENT_CONFIRMATION_REQUIRED"
  | "DISCOUNT_PCT_REQUIRED";

/**
 * The desk gate before a drop decision is saved. A "verified" stop needs a
 * named source and the pasted reply. When the parent or centre reported the
 * stop, only THEIR confirmation counts (tutor word alone never reduces the
 * fee); admin-reviewed evidence is accepted only for the tutor-initiated
 * hostile-parent / emergency paths (#529 A2, #528).
 */
export function dropRecordError(input: {
  kind: OutcomeKind;
  initiator: DropInitiator | null;
  verification: DropVerification | null;
  verifiedBy: DropVerifiedBy | null;
  proofNote: string | null;
  promoType: PromoType;
  discountPct: number | null;
}): DropRecordError | null {
  if (input.promoType === "discounted_first" && !(Number(input.discountPct) > 0)) {
    return "DISCOUNT_PCT_REQUIRED";
  }
  if (input.kind !== "stopped_after_l1" || input.verification !== "verified") return null;
  if (!input.verifiedBy) return "VERIFIED_BY_REQUIRED";
  if ((input.proofNote ?? "").trim().length < DROP_PROOF_NOTE_MIN) return "PROOF_NOTE_REQUIRED";
  if (input.initiator !== "tutor" && input.verifiedBy === "admin_evidence") {
    return "CLIENT_CONFIRMATION_REQUIRED";
  }
  return null;
}

function oneOf<T extends string>(values: readonly T[], value: unknown, fallback: T): T {
  return (values as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

/** Coercers for DB values: junk or pre-migration rows fall back to safe defaults. */
export const normalizePromoType = (v: unknown): PromoType => oneOf(PROMO_TYPES, v, "standard");
export const normalizeSplitMode = (v: unknown): SplitMode => oneOf(SPLIT_MODES, v, "100_50");
export const normalizeBypassFlag = (v: unknown): BypassFlag => oneOf(BYPASS_FLAGS, v, "none");
export const normalizeDropVerification = (v: unknown): DropVerification =>
  oneOf(DROP_VERIFICATIONS, v, "none");
