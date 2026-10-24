// Server-only FX engine (issue #112): fetches daily ECB reference rates via
// Frankfurter (free, no API key, covers every supported currency against the
// HKD base) and upserts them into the public.exchange_rates table through the
// service-role client. Only server code can write rates — the table has no
// INSERT/UPDATE policies — so callers can never poison conversions.
//
// The refresh is idempotent; concurrent runs just upsert the same values.
// When Frankfurter is unreachable the last stored rates keep serving (they
// only drift by a day), which is why ensureFreshRates never throws on fetch
// failure.
import type { Database } from "@/integrations/supabase/types";
import { toHkdRates, type ExchangeRateRow, type HkdRates } from "@/lib/money";

type RateUpsertRow = Database["public"]["Tables"]["exchange_rates"]["Insert"];

export const FX_BASE_CURRENCY = "HKD" as const;

// Frankfurter only returns the 7 non-base currencies; HKD->HKD stays at the
// seeded 1.0 and is never fetched.
const FX_TARGET_CURRENCIES = ["CNY", "USD", "GBP", "EUR", "CAD", "AUD", "SGD"] as const;

// Canonical host first, legacy api.frankfurter.app as fallback.
const FRANKFURTER_URLS = [
  `https://api.frankfurter.dev/v1/latest?base=${FX_BASE_CURRENCY}&symbols=${FX_TARGET_CURRENCIES.join(",")}`,
  `https://api.frankfurter.app/latest?base=${FX_BASE_CURRENCY}&symbols=${FX_TARGET_CURRENCIES.join(",")}`,
];

const FETCH_TIMEOUT_MS = 10_000;

type FrankfurterResponse = {
  base: string;
  date: string;
  rates: Record<string, number>;
};

async function fetchFrankfurterRates(): Promise<FrankfurterResponse> {
  let lastError: unknown = new Error("No FX endpoint was attempted.");
  for (const url of FRANKFURTER_URLS) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error(`FX API responded ${response.status}`);
      const data = (await response.json()) as FrankfurterResponse;
      if (data.base !== FX_BASE_CURRENCY) {
        throw new Error(`FX API returned base ${data.base}, expected ${FX_BASE_CURRENCY}`);
      }
      const missing = FX_TARGET_CURRENCIES.filter(
        (code) => !Number.isFinite(data.rates[code]) || data.rates[code] <= 0,
      );
      if (missing.length > 0)
        throw new Error(`FX API response missing rates for ${missing.join(", ")}`);
      return data;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export type ExchangeRateRowWithUpdatedAt = ExchangeRateRow & { updated_at: string };

async function readRateRows(): Promise<ExchangeRateRowWithUpdatedAt[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("exchange_rates")
    .select("source_currency, target_currency, rate, updated_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as ExchangeRateRowWithUpdatedAt[];
}

/**
 * Fetches current rates and upserts them. Throws only when the fetch or the
 * write fails — callers decide whether stale rates are acceptable.
 */
export async function refreshFxRates(): Promise<{ date: string }> {
  const data = await fetchFrankfurterRates();
  const rows: RateUpsertRow[] = [
    { source_currency: FX_BASE_CURRENCY, target_currency: FX_BASE_CURRENCY, rate: 1 },
    ...FX_TARGET_CURRENCIES.map((code) => ({
      source_currency: FX_BASE_CURRENCY,
      target_currency: code,
      rate: data.rates[code],
    })),
  ];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("exchange_rates").upsert(rows);
  if (error) throw new Error(`Failed to store exchange rates: ${error.message}`);
  return { date: data.date };
}

async function isStale(maxAgeMs: number): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("exchange_rates")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error || !data?.[0]?.updated_at) return true;
  const freshest = Date.parse(data[0].updated_at);
  if (Number.isNaN(freshest)) return true;
  return Date.now() - freshest > maxAgeMs;
}

/**
 * Returns the stored HKD rate rows, refreshing them first when older than
 * `maxAgeHours`. Fetch failures degrade to serving the stale rows — the
 * daily cron (or the next request) retries.
 */
export async function ensureFreshRates(
  maxAgeHours = 24,
): Promise<{ rows: ExchangeRateRowWithUpdatedAt[]; rates: HkdRates; refreshed: boolean }> {
  const stale = await isStale(maxAgeHours * 3_600_000).catch(() => true);
  let refreshed = false;
  if (stale) {
    try {
      await refreshFxRates();
      refreshed = true;
    } catch (error) {
      console.error("[fx] scheduled rate refresh failed, serving stored rates:", error);
    }
  }
  const rows = await readRateRows();
  return { rows, rates: toHkdRates(rows), refreshed };
}
