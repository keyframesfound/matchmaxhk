import { useCallback } from "react";
import { useRouter } from "@tanstack/react-router";

import { setLocale } from "./config";
import { buildLocalePath, segmentOfLocale } from "./routing";
import type { SeoLocale } from "./seo";

/**
 * Switch language end-to-end: change the i18n language, persist the choice,
 * and move the URL to the new locale prefix (same page, search and hash
 * kept) so the address bar, sharing and reloads all agree.
 */
export function useSwitchLocale() {
  const router = useRouter();

  return useCallback(
    (lng: string) => {
      const next: SeoLocale = lng?.startsWith("zh") ? "zh-HK" : "en";
      setLocale(next);
      const { pathname, searchStr, hash } = router.state.location;
      const target = buildLocalePath(segmentOfLocale(next), pathname);
      void router.navigate({
        href: `${target}${searchStr}${hash ? `#${hash}` : ""}`,
        resetScroll: false,
      });
    },
    [router],
  );
}
