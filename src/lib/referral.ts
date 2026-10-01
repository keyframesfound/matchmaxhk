export const REFERRAL_CODE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const REFERRAL_STORAGE_KEY = "matchmax.ref";
const REFERRAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Reads the referral code remembered from an earlier ?ref= visit (30-day
 * window, last click wins). Empty string when absent, expired, or malformed.
 */
export function readStoredReferralCode(): string {
  try {
    const raw = window.localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { code?: unknown; ts?: unknown };
    if (typeof parsed.code !== "string" || !REFERRAL_CODE_PATTERN.test(parsed.code)) return "";
    if (typeof parsed.ts !== "number" || Date.now() - parsed.ts > REFERRAL_WINDOW_MS) {
      window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
      return "";
    }
    return parsed.code;
  } catch {
    return "";
  }
}

/** Remembers a referral code from a ?ref= landing (last click overwrites). */
export function storeReferralCode(code: string): void {
  try {
    window.localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify({ code, ts: Date.now() }));
  } catch {
    // Storage unavailable (private mode etc.) — attribution just won't persist.
  }
}
