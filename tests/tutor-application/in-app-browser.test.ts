import { describe, expect, it } from "vitest";

import { isInAppBrowser } from "../../src/features/tutor-application/in-app-browser";

// Issue #798 (AC-4): these are the families that actually reach /join from a
// chat app in HK. Google rejects their webviews with `disallowed_useragent`,
// so the form intercepts before the OAuth redirect.
const IN_APP_USER_AGENTS: Array<[string, string]> = [
  [
    "WhatsApp iOS",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/2.24.12.21",
  ],
  [
    "Instagram in-app",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.34.101 (iPhone14,5; iOS 17_5; en_HK; en; scale=3.00; 1170x2532; 560472280)",
  ],
  [
    "Facebook in-app",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/469.0.0.40.109;FBBV/570410215;FB_IAB/FB4A;FBMF/469.0.0.40.109]",
  ],
  [
    "Messenger",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/469.0.0.32.108;FBBV/570410215]",
  ],
  [
    "Line",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/14.6.0",
  ],
  [
    "WeChat",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49(0x18003129) NetType/WIFI Language/zh_HK",
  ],
  [
    "Threads",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Threads/314.0.0.20.114",
  ],
];

const REAL_BROWSERS: Array<[string, string]> = [
  [
    "Safari iOS",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  ],
  [
    "Chrome Android",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  ],
  [
    "Firefox desktop",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0",
  ],
];

describe("isInAppBrowser", () => {
  it.each(IN_APP_USER_AGENTS)("detects %s", (_label, userAgent) => {
    expect(isInAppBrowser(userAgent)).toBe(true);
  });

  it.each(REAL_BROWSERS)("allows %s", (_label, userAgent) => {
    expect(isInAppBrowser(userAgent)).toBe(false);
  });

  it("treats a missing user agent as a real browser", () => {
    // A scrubbed header must never block a legitimate guest behind the gate.
    expect(isInAppBrowser("")).toBe(false);
  });

  it("ignores casing", () => {
    expect(isInAppBrowser("... microMESSENGER/8.0.49 ...")).toBe(true);
    expect(isInAppBrowser("... line/14.6.0 ...")).toBe(true);
  });
});
