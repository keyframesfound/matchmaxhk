import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureFreshRates } from "@/lib/fx.server";

export type ExchangeRateEntry = {
  sourceCurrency: string;
  targetCurrency: string;
  rate: number;
  updatedAt: string;
};

const GetExchangeRatesInput = z
  .object({
    // Hours after which a rate row triggers a Frankfurter refresh; defaults to
    // 24. Exposed for smoke-testing the engine without waiting a day.
    maxAgeHours: z
      .number()
      .positive()
      .max(24 * 30)
      .optional(),
  })
  .optional();

/**
 * Daily exchange rates relative to the HKD base (issue #112). Public: rates
 * are open data and the table is world-readable; the lazy refresh inside
 * ensureFreshRates is idempotent and safe to trigger from any request.
 */
export const getExchangeRates = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => GetExchangeRatesInput.parse(data))
  .handler(async ({ data }) => {
    const { rows, refreshed } = await ensureFreshRates(data?.maxAgeHours ?? 24);
    const entries: ExchangeRateEntry[] = rows.map((row) => ({
      sourceCurrency: row.source_currency,
      targetCurrency: row.target_currency,
      rate: row.rate,
      updatedAt: row.updated_at,
    }));
    return { entries, refreshed };
  });
