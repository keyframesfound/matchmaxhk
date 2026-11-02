/**
 * Issue #454 — Brain-Dead Matching Cockpit, pure half.
 *
 * Fee display (#443 locks), market-band check, the net-new desk macros and
 * the Parallel Ping (max 2) rule. Macro bodies for Matching Speed stay in
 * #451 (quick-replies.ts); the seven here are #454-owned. Everything is
 * INSERT-ONLY: the desk copies a filled line and sends it themselves.
 */

import { fullAdminFeeAmount } from "@/features/cases/fee-breakdown";
import { MATCHMAX_FPS, fpsMemoForCase } from "@/features/cases/fee-desk";
import { SHORT_CASE_FEE_RATE } from "@/features/cases/short-case";

export const GROUP_SIZES = ["1_ON_1", "GROUP_2_3"] as const;
export type GroupSize = (typeof GROUP_SIZES)[number];

export const DECLINE_REASONS = ["SCHEDULE", "RATE", "OTHER"] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

/** Parallel Ping P1: at most two tutors pinged at once (wave ≤3 overall). */
export const PARALLEL_PING_MAX = 2;
export const WAVE_MAX = 3;
/** Budget more than 20% below the band bottom → Rate Reality Check. */
export const MARKET_LOW_RATIO = 0.8;

export type CockpitFeeInput = {
  rateHkd: number | null | undefined;
  studentCount?: number | null;
  isShortCase?: boolean;
  sessionLengthMinutes?: number | null;
  scheduledLessonCount?: number | null;
};

export type CockpitFeeQuote =
  | { ok: true; mode: "standard" | "short"; amountHkd: number }
  | { ok: false; reason: "RATE_MISSING" | "SHORT_INPUT_MISSING" };

/**
 * #443 lock: standard = fullAdminFeeAmount(rate, students) = rate × 1.5 ×
 * students (never rate × duration × 1.5); short = 20% of the scheduled
 * package (rate × hours × lessons).
 */
export function cockpitFeeQuote(input: CockpitFeeInput): CockpitFeeQuote {
  const rate = Number(input.rateHkd);
  if (!Number.isFinite(rate) || rate <= 0) return { ok: false, reason: "RATE_MISSING" };
  if (!input.isShortCase) {
    return {
      ok: true,
      mode: "standard",
      amountHkd: fullAdminFeeAmount(rate, input.studentCount ?? undefined),
    };
  }
  const minutes = Number(input.sessionLengthMinutes);
  const lessons = Number(input.scheduledLessonCount);
  if (!Number.isFinite(minutes) || minutes <= 0 || !Number.isInteger(lessons) || lessons < 1) {
    return { ok: false, reason: "SHORT_INPUT_MISSING" };
  }
  return {
    ok: true,
    mode: "short",
    amountHkd: Math.round(rate * (minutes / 60) * lessons * SHORT_CASE_FEE_RATE),
  };
}

export type MarketVerdict = "unknown" | "ok" | "low";

/** Budget > 20% below the Master Sheet band bottom flags the ratecheck macro. */
export function marketVerdict(
  budgetHkd: number | null | undefined,
  bandMinHkd: number | null | undefined,
): MarketVerdict {
  const budget = Number(budgetHkd);
  const min = Number(bandMinHkd);
  if (!budgetHkd || !bandMinHkd || !Number.isFinite(budget) || !Number.isFinite(min)) {
    return "unknown";
  }
  return budget < min * MARKET_LOW_RATIO ? "low" : "ok";
}

/** Send-both guard: 1–2 tutors selected, never more. */
export function canSendBoth(selectedCount: number): boolean {
  return selectedCount >= 1 && selectedCount <= PARALLEL_PING_MAX;
}

export type MacroVarKey =
  | "case_id"
  | "rate"
  | "fee"
  | "tutor"
  | "status_url"
  | "l1_time"
  | "market_min"
  | "market_max"
  | "group_size"
  | "status"
  | "slots";

export type MacroVars = Partial<Record<MacroVarKey, string>>;

/** Fill {{var}} placeholders; a missing value stays visible as [var?]. */
export function fillMacro(template: string, vars: MacroVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    const value = (vars as Record<string, string | undefined>)[key];
    return value && value.trim() ? value : `[${key}?]`;
  });
}

export type DeskMacro = { key: string; label: string; text: string };

/** #454 §4 net-new macros (繁中-first desk copy, insert-only). */
export const COCKPIT_MACROS: readonly DeskMacro[] = [
  {
    key: "strike2",
    label: "/strike2",
    text: "明白！為了即時幫您配對，想確認：1) 每小時預算約多少？2) 每堂多長時間？3) 一對一定小組（{{group_size}}）？4) 請提供兩個方便的首堂時間。",
  },
  {
    key: "ratecheck",
    label: "/ratecheck",
    text: "溫馨提示：此科目市場價大約 ${{market_min}}–${{market_max}}/hr。目前預算 ${{rate}}/hr 較難配對到合適導師，可考慮稍為調整預算或轉為網上課堂，配對成功率會高好多。",
  },
  {
    key: "dispatch",
    label: "/dispatch",
    text: "【新個案 {{case_id}}】{{tutor}} 您好！有個案時薪 ${{rate}}/hr，首堂時間：{{slots}}。如有興趣請回覆 YES（先回覆先得）；如不適合請回覆 1=時間 2=價錢 3=其他。",
  },
  {
    key: "noshow",
    label: "/noshow",
    text: "非常抱歉首堂未能如期進行。我們會即時為您免費重新配對導師，稍後會發新名單給您。個案：{{case_id}}",
  },
  {
    key: "release",
    label: "/release",
    text: "您好！我們 24 小時未收到回覆，個案 {{case_id}} 會先暫停配對。如仍需要導師，隨時回覆此訊息即可重新開始。",
  },
  {
    key: "status",
    label: "/status",
    text: "個案 {{case_id}} 目前狀態：{{status}}。詳情：{{status_url}}",
  },
  {
    key: "fps",
    label: "/fps",
    text: `平台行政費：HK\${{fee}}\n收款人：${MATCHMAX_FPS.payeeName}\n轉數快：${MATCHMAX_FPS.fpsNumber}\n銀行：${MATCHMAX_FPS.bankAccount}\n備註：{{case_id}}`,
  },
];

/** FPS block vars: the memo is MM-{case}; amount only from the fee display. */
export function fpsMacroVars(caseCode: string, quote: CockpitFeeQuote): MacroVars {
  return {
    case_id: fpsMemoForCase(caseCode),
    fee: quote.ok ? String(quote.amountHkd) : undefined,
  };
}
