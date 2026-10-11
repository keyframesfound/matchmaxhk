// Shared money module (issue #112): the single source of truth for supported
// currencies, HKD normalization/conversion and currency formatting. Before
// this existed, every surface rolled its own Intl.NumberFormat("en-HK") call
// and hardcoded HK$ templates.
//
// Exchange rates are HKD→X rows (units of X per 1 HKD) fetched daily by the
// FX engine (src/lib/fx.server.ts) into the exchange_rates table; conversion
// between any two currencies crosses through HKD.

export const SUPPORTED_CURRENCIES = [
  "HKD",
  "CNY",
  "USD",
  "GBP",
  "EUR",
  "CAD",
  "AUD",
  "SGD",
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: CurrencyCode = "HKD";

const CURRENCY_SET: ReadonlySet<string> = new Set(SUPPORTED_CURRENCIES);

export function isSupportedCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string" && CURRENCY_SET.has(value);
}

/** Coerces arbitrary input (form fields, DB text columns) to a supported code. */
export function toCurrencyCode(value: unknown): CurrencyCode {
  return isSupportedCurrency(value) ? value : DEFAULT_CURRENCY;
}

/** One exchange_rates row, e.g. { source_currency: "HKD", target_currency: "USD", rate: 0.1285 }. */
export type ExchangeRateRow = {
  source_currency: string;
  target_currency: string;
  rate: number;
};

/** Rates indexed by target currency: 1 HKD buys `rate` units of that currency. */
export type HkdRates = Partial<Record<CurrencyCode, number>>;

export function toHkdRates(rows: ExchangeRateRow[]): HkdRates {
  const rates: HkdRates = {};
  for (const row of rows) {
    if (row.source_currency !== DEFAULT_CURRENCY) continue;
    const code = toCurrencyCode(row.target_currency);
    if (code !== DEFAULT_CURRENCY && Number.isFinite(row.rate) && row.rate > 0) {
      rates[code] = row.rate;
    }
  }
  return rates;
}

/**
 * Normalizes a native-currency amount to HKD. Returns NaN when no rate is
 * available for the currency — callers fall back to native values.
 */
export function normalizeToHkd(amount: number, from: CurrencyCode, rates: HkdRates): number {
  if (from === DEFAULT_CURRENCY) return amount;
  const rate = rates[from];
  if (!rate) return Number.NaN;
  return amount / rate;
}

/** Cross-currency conversion through the HKD base. Returns NaN on missing rates. */
export function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: HkdRates,
): number {
  const hkd = normalizeToHkd(amount, from, rates);
  if (Number.isNaN(hkd)) return Number.NaN;
  if (to === DEFAULT_CURRENCY) return hkd;
  const rate = rates[to];
  if (!rate) return Number.NaN;
  return hkd * rate;
}

const CURRENCY_FORMATTER_DEFAULTS = {
  locale: "en-HK",
  // 0 digits for whole amounts ("HK$300"), 2 for decimals ("HK$300.25");
  // minimumFractionDigits clamps to the maximum per ECMA-402, matching the
  // output of the per-surface formatters this module replaced.
  maximumFractionDigits: (amount: number) => (Number.isInteger(amount) ? 0 : 2),
} as const;

/** "HK$300" / "US$1,234.5" → "US$1,234.50" — dollars in, display string out. */
export function formatMoney(amount: number, currency: string = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat(CURRENCY_FORMATTER_DEFAULTS.locale, {
    style: "currency",
    currency: toCurrencyCode(currency),
    maximumFractionDigits: CURRENCY_FORMATTER_DEFAULTS.maximumFractionDigits(amount),
  }).format(amount);
}

/** Cents-first flavor for cent-denominated ledgers (match fees, bounties). */
export function formatMoneyFromCents(cents: number, currency: string = DEFAULT_CURRENCY): string {
  return formatMoney(cents / 100, currency);
}
