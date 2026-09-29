import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The repo's #1 silent-failure bug class (see scripts/check-i18n.mjs): t()
// returning the raw key or "" when a key is missing from a locale file.
// check-i18n covers key parity statically; these tests cover the runtime
// resolution contract the app actually depends on.

const LOCALES_DIR = join(
  fileURLToPath(new URL("../../src/features/i18n/locales", import.meta.url)),
);

function flatten(obj: unknown, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  if (obj === null || typeof obj !== "object") return out;
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object") {
      Object.assign(out, flatten(value, path));
    } else {
      out[path] = String(value);
    }
  }
  return out;
}

const en = JSON.parse(readFileSync(join(LOCALES_DIR, "en.json"), "utf8"));
const zh = JSON.parse(readFileSync(join(LOCALES_DIR, "zh-HK.json"), "utf8"));
const enFlat = flatten(en);
const zhFlat = flatten(zh);

describe("locale files", () => {
  it("en and zh-HK expose exactly the same key tree", () => {
    expect(Object.keys(zhFlat).sort()).toEqual(Object.keys(enFlat).sort());
  });

  it("no locale value is empty or whitespace-only (t() would render nothing)", () => {
    for (const [file, flat] of [
      ["en.json", enFlat],
      ["zh-HK.json", zhFlat],
    ] as const) {
      for (const [key, value] of Object.entries(flat)) {
        expect(value.trim().length, `${file}:${key} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it("no locale value still contains a raw interpolation-only placeholder", () => {
    for (const [file, flat] of [
      ["en.json", enFlat],
      ["zh-HK.json", zhFlat],
    ] as const) {
      for (const [key, value] of Object.entries(flat)) {
        expect(value, `${file}:${key} is only a placeholder`).not.toMatch(/^\{\{\w+\}\}$/);
      }
    }
  });

  it("nested key depth stays within i18next's configured depth (sanity: <= 6)", () => {
    for (const key of Object.keys(enFlat)) {
      expect(key.split(".").length, `key ${key} is unusually deep`).toBeLessThanOrEqual(6);
    }
  });
});
