import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";

import { REFERRAL_CODE_PATTERN, storeReferralCode } from "@/lib/referral";

/**
 * Captures ?ref= codes from any landing URL into localStorage (30-day
 * window, last click wins) so the tutor intake form can still attribute
 * applications when a prospect browses around and returns to /join without
 * the original link. Renders nothing.
 */
export function ReferralCapture() {
  const location = useLocation();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (code && REFERRAL_CODE_PATTERN.test(code)) {
      storeReferralCode(code);
    }
  }, [location]);

  return null;
}
