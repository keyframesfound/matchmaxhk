// Issue #113 + #114, display-currency helpers. Pure functions over the
// money.ts primitives so every surface (cards, profile rates, forms, case
// feeds) converts and formats the same way. The FX rates themselves come from
// the exchange_rates table (fx.server.ts refreshes them from Frankfurter);
// the provider in display-currency-context.tsx is the only fetcher.
import {
  convertCurrency,
  DEFAULT_CURRENCY,
  formatMoney,
  normalizeToHkd,
  toCurrencyCode,
  type CurrencyCode,
  type HkdRates,
} from "@/lib/money";

/** localStorage key for the parent display currency (#114). */
export const DISPLAY_CURRENCY_STORAGE_KEY = "matchmax.display_currency";

/** Safe localStorage read, returns DEFAULT_CURRENCY when unset/corrupt. */
export function readStoredCurrency(storage: Pick<Storage, "getItem"> | null): CurrencyCode {
  if (!storage) return DEFAULT_CURRENCY;
  try {
    return toCurrencyCode(storage.getItem(DISPLAY_CURRENCY_STORAGE_KEY));
  } catch {
    return DEFAULT_CURRENCY;
  }
}

/**
 * Converted display text for an HKD-denominated amount ("£30" for 233 HKD at
 * 0.128 GBP/HKD). Null when the display currency is HKD (caller keeps its
 * existing HKD rendering) or no rate is available, conversion must never
 * break a price that used to render.
 */
export function convertedTextFromHkd(
  amountHkd: number,
  display: CurrencyCode,
  rates: HkdRates,
): string | null {
  if (display === DEFAULT_CURRENCY) return null;
  const converted = convertCurrency(amountHkd, DEFAULT_CURRENCY, display, rates);
  if (!Number.isFinite(converted)) return null;
  return formatMoney(converted, display);
}

/**
 * Native-currency amount → display text for the profile Rates table
 * (#114): the tutor's stored rate is native, the viewer picked a display
 * currency. Null when either side is HKD (already native) or rates are
 * missing, callers then show the stored value unchanged.
 */
export function nativeToDisplayText(
  amount: number,
  from: CurrencyCode,
  display: CurrencyCode,
  rates: HkdRates,
): string | null {
  if (from === display) return null;
  const converted = convertCurrency(amount, from, display, rates);
  if (!Number.isFinite(converted)) return null;
  return formatMoney(converted, display);
}

/**
 * True only when the display switcher is actually converting, display ≠ HKD
 * AND a usable rate exists for it. Gates "viewing converted" chrome such as
 * the profile FX disclaimer (#380 review): when rates fail to load every
 * surface fail-softs back to HKD figures, and a disclaimer claiming prices
 * are shown converted would be false.
 */
export function hasActiveConversion(display: CurrencyCode, rates: HkdRates): boolean {
  if (display === DEFAULT_CURRENCY) return false;
  return Number.isFinite(convertCurrency(1, DEFAULT_CURRENCY, display, rates));
}

/**
 * Live ≈HK$ baseline for native-currency inputs (#113/#114 forms):
 * "≈ HK$3,129" for a £400/hr input. Null when the input currency is HKD or
 * no rate is available, the note simply does not render.
 */
export function approxHkdText(amount: number, from: CurrencyCode, rates: HkdRates): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (from === DEFAULT_CURRENCY) return null;
  const hkd = normalizeToHkd(amount, from, rates);
  if (!Number.isFinite(hkd)) return null;
  return formatMoney(hkd, DEFAULT_CURRENCY);
}
