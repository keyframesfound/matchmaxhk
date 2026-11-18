import { beforeEach, describe, expect, it } from "vitest";

import {
  allowsNonEssential,
  getCookieConsent,
  resetCookieConsent,
  setCookieConsent,
} from "../../src/features/legal/cookie-consent";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

beforeEach(() => {
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    dispatchEvent: () => true,
  };
});

describe("#783 cookie consent", () => {
  it("defaults to no choice, which means essential only", () => {
    expect(getCookieConsent()).toBeNull();
    expect(allowsNonEssential()).toBe(false);
  });

  it("Accept all allows non-essential storage", () => {
    setCookieConsent("all");
    expect(getCookieConsent()).toBe("all");
    expect(allowsNonEssential()).toBe(true);
  });

  it("Essential only removes the persistent anonymous viewer key", () => {
    const w = (globalThis as unknown as { window: { localStorage: MemoryStorage } }).window;
    w.localStorage.setItem("matchmax.viewer_key", "abc");
    setCookieConsent("essential");
    expect(w.localStorage.getItem("matchmax.viewer_key")).toBeNull();
    expect(allowsNonEssential()).toBe(false);
  });

  it("#783: Essential only also removes the business analytics session id", () => {
    const w = (globalThis as unknown as { window: { localStorage: MemoryStorage } }).window;
    w.localStorage.setItem("mm-track-session", "s-1");
    setCookieConsent("essential");
    expect(w.localStorage.getItem("mm-track-session")).toBeNull();
    expect(allowsNonEssential()).toBe(false);
  });

  it("reset asks again", () => {
    setCookieConsent("all");
    resetCookieConsent();
    expect(getCookieConsent()).toBeNull();
  });
});
