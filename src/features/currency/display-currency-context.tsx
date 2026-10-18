// Issue #114 — global display-currency context. One provider at the app root
// holds the parent's chosen display currency (persisted in localStorage) plus
// the shared HKD→X rate table (fetched once from the FX server fn and cached
// by React Query). Consumers read it through useDisplayCurrency(); surfaces
// outside the provider (SSR pass, isolated trees) get the null-safe default
// — HKD with no rates — which makes every conversion helper a no-op, so no
// caller needs its own guard.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { getExchangeRates } from "@/lib/fx.functions";
import {
  DEFAULT_CURRENCY,
  isSupportedCurrency,
  type CurrencyCode,
  type HkdRates,
} from "@/lib/money";
import { DISPLAY_CURRENCY_STORAGE_KEY, readStoredCurrency } from "@/features/currency/convert";

type DisplayCurrencyValue = {
  currency: CurrencyCode;
  rates: HkdRates;
  setCurrency: (next: CurrencyCode) => void;
};

const DisplayCurrencyContext = createContext<DisplayCurrencyValue>({
  currency: DEFAULT_CURRENCY,
  rates: {},
  setCurrency: () => {},
});

/** Fetches the HKD→X rate rows once per page; never throws to the tree. */
async function fetchHkdRates(): Promise<HkdRates> {
  try {
    const { entries } = await getExchangeRates();
    const rates: HkdRates = {};
    for (const entry of entries) {
      if (entry.sourceCurrency !== DEFAULT_CURRENCY) continue;
      const code = isSupportedCurrency(entry.targetCurrency) ? entry.targetCurrency : null;
      if (code && code !== DEFAULT_CURRENCY && Number.isFinite(entry.rate) && entry.rate > 0) {
        rates[code] = entry.rate;
      }
    }
    return rates;
  } catch (error) {
    console.warn("[currency] exchange rates unavailable; prices stay HKD", error);
    return {};
  }
}

export function DisplayCurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(DEFAULT_CURRENCY);

  const queryClient = useQueryClient();
  const { data: rates } = useQuery({
    queryKey: ["exchange-rates"],
    queryFn: fetchHkdRates,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    retry: false,
  });

  // Hydrate the persisted choice after mount — SSR always renders HKD so the
  // server HTML matches the default and hydration never disagrees.
  useEffect(() => {
    setCurrencyState(readStoredCurrency(window.localStorage));
    // Warm the rate table in the background so the first switch is instant.
    void queryClient.ensureQueryData({
      queryKey: ["exchange-rates"],
      queryFn: fetchHkdRates,
    });
  }, [queryClient]);

  const setCurrency = (next: CurrencyCode) => {
    setCurrencyState(next);
    try {
      window.localStorage.setItem(DISPLAY_CURRENCY_STORAGE_KEY, next);
    } catch {
      // Private mode / storage disabled — the in-memory choice still works.
    }
  };

  const value = useMemo<DisplayCurrencyValue>(
    () => ({ currency, rates: rates ?? {}, setCurrency }),
    [currency, rates],
  );

  return <DisplayCurrencyContext.Provider value={value}>{children}</DisplayCurrencyContext.Provider>;
}

/**
 * Null-safe accessor: surfaces rendered without the provider (SSR, admin
 * shells) read HKD + empty rates and every conversion helper returns null.
 */
export function useDisplayCurrency(): DisplayCurrencyValue {
  return useContext(DisplayCurrencyContext);
}
