import { useEffect, useState } from "react";

/**
 * #798: the reader's own IANA zone, resolved on the client only.
 *
 * SSR has no trustworthy device zone, and the first client render must match
 * the server markup, so the value lands after mount. Callers treat null as
 * "unknown" and fall back to naming the tutor's zone alone.
 */
export function useViewerTimezone(): string | null {
  const [zone, setZone] = useState<string | null>(null);

  useEffect(() => {
    try {
      setZone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? null);
    } catch {
      setZone(null);
    }
  }, []);

  return zone;
}
