import { describe, expect, it } from "vitest";

import { RESUME_TTL_MS, generateResumeToken, hashResumeToken } from "../../src/lib/resume-token";

// Issue #798 (AC-4): only the pure token helpers are testable in isolation —
// the payload cap, insertion and expiry sweep are DB-bound and asserted by the
// server-fn handler itself.
describe("generateResumeToken", () => {
  it("returns a url-safe 32-byte token", () => {
    const token = generateResumeToken();
    // 32 bytes base64url, no padding: 43 characters.
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("never repeats", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateResumeToken()));
    expect(tokens.size).toBe(50);
  });
});

describe("hashResumeToken", () => {
  it("is deterministic SHA-256 hex", () => {
    const hash = hashResumeToken("fixed-token");
    expect(hash).toBe(hashResumeToken("fixed-token"));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs per token, so one hash cannot address another draft", () => {
    expect(hashResumeToken(generateResumeToken())).not.toBe(hashResumeToken(generateResumeToken()));
  });

  it("does not echo the raw token", () => {
    const raw = generateResumeToken();
    expect(hashResumeToken(raw)).not.toContain(raw);
  });
});

describe("RESUME_TTL_MS", () => {
  it("is two hours", () => {
    expect(RESUME_TTL_MS).toBe(2 * 60 * 60 * 1000);
  });
});
