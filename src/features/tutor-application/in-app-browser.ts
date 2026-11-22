/**
 * Issue #798 (AC-4): in-app browser detector for the tutor application.
 *
 * Google's OAuth endpoint rejects embedded webviews outright with
 * `disallowed_useragent` (it is a policy against credential phishing inside an
 * app's own chrome, not a bug), so a guest who opened /join from a chat app can
 * never finish "Continue with Google" there. `/join` uses this to intercept
 * BEFORE Google and offer a resume link that must be opened in Safari/Chrome.
 *
 * The families below are the ones that actually wrap /join traffic in Hong Kong
 * plus the global Meta/Twitter ones:
 *   - FBAN / FBAV / FB_IAB — Facebook app and its in-app browser (iOS + Android)
 *   - Instagram              — Instagram webview, same Meta IAB stack
 *   - Messenger             — Facebook Messenger's separate UA marker
 *   - WhatsApp               — WhatsApp in-app browser
 *   - MicroMessenger         — WeChat, the dominant messenger in HK
 *   - Line/                  — LINE (slash keeps it off the word "line" in
 *                              unrelated agents; LINE's UA writes "Line/12.0")
 *   - Twitter / Threads      — X and Threads in-app browsers
 *   - musical_ly             — TikTok (inherited from Musical.ly)
 *   - BytedanceWebview       — TikTok / ByteDance family webview marker
 *
 * Matching is case-insensitive because vendors are inconsistent about casing
 * ("Line/" vs "LINE/"), and an empty UA is treated as "not detected" so a
 * scrubbed header never blocks a real browser.
 */

const IN_APP_MARKERS = [
  "FBAN",
  "FBAV",
  "FB_IAB",
  "Instagram",
  "Messenger",
  "WhatsApp",
  "MicroMessenger",
  "Line/",
  "Twitter",
  "Threads",
  "musical_ly",
  "BytedanceWebview",
] as const;

export function isInAppBrowser(userAgent: string): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return IN_APP_MARKERS.some((marker) => ua.includes(marker.toLowerCase()));
}
