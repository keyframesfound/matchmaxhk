#!/usr/bin/env node
// i18n guard: catches the recurring "text does not show" bug class.
//
// This project registers all locales under i18next's single default
// `translation` namespace with no fallbackNS, so there are exactly two ways
// translations silently break (t() returns the raw key, or an empty string):
//
//   1. Calling useTranslation("someNamespace") — no such namespace exists.
//      Always call useTranslation() bare and prefix keys with their JSON
//      subtree, e.g. t("settings.general.language_en").
//   2. Referencing a t("key") path that is missing from either
//      src/features/i18n/locales/en.json or zh-HK.json.
//
// Run via `npm run check:i18n`. Also enforced live by the eslint i18n-guards
// rules in eslint.config.js; this script additionally checks full key-tree
// parity between the two locale files, which lint cannot do.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(root, "src");
const LOCALES_DIR = join(root, "src", "features", "i18n", "locales");
const LOCALE_FILES = ["en.json", "zh-HK.json"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".output", ".vinxi", ".zcode"]);

const problems = [];

function loadLocale(name) {
  return JSON.parse(readFileSync(join(LOCALES_DIR, name), "utf8"));
}

function flatten(value, prefix = "", out = new Map()) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child === null || child === undefined || typeof child !== "object") {
      out.set(path, child);
    } else {
      flatten(child, path, out);
    }
  }
  return out;
}

function walkSources(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkSources(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full);
  }
  return out;
}

function lineOf(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (source[i] === "\n") line += 1;
  }
  return line;
}

// --- 1. Locale files: every value present and non-empty -------------------

const locales = Object.fromEntries(LOCALE_FILES.map((name) => [name, loadLocale(name)]));
const flattened = Object.fromEntries(LOCALE_FILES.map((name) => [name, flatten(locales[name])]));

for (const name of LOCALE_FILES) {
  for (const [key, value] of flattened[name]) {
    if (typeof value !== "string" || value.trim() === "") {
      problems.push(`${name}: "${key}" has an empty or non-string value — text will not render.`);
    }
  }
}

// --- 2. Locale parity: both files define the exact same key set -----------

const [enName, zhName] = LOCALE_FILES;
for (const key of flattened[enName].keys()) {
  if (!flattened[zhName].has(key)) {
    problems.push(`"${key}" exists in ${enName} but is missing from ${zhName}.`);
  }
}
for (const key of flattened[zhName].keys()) {
  if (!flattened[enName].has(key)) {
    problems.push(`"${key}" exists in ${zhName} but is missing from ${enName}.`);
  }
}

// --- 3. Sources: no namespace args, and every t("key") resolves -----------

for (const file of walkSources(SRC)) {
  const source = readFileSync(file, "utf8");
  const display = relative(root, file);

  for (const match of source.matchAll(/useTranslation\(\s*["']([^"']+)["']/g)) {
    problems.push(
      `${display}:${lineOf(source, match.index)}: useTranslation("${match[1]}") passes a namespace. ` +
        `Only the default "translation" namespace exists — call useTranslation() bare and ` +
        `prefix keys with their subtree (e.g. t("settings.title")).`,
    );
  }

  for (const match of source.matchAll(/\bt\(\s*["']([a-zA-Z][a-zA-Z0-9_.]*)["']/g)) {
    const key = match[1];
    for (const name of LOCALE_FILES) {
      if (!flattened[name].has(key)) {
        problems.push(
          `${display}:${lineOf(source, match.index)}: t("${key}") is missing from ${name} — ` +
            `raw key text will render instead of a translation.`,
        );
      }
    }
  }
}

// --- Report ---------------------------------------------------------------

if (problems.length > 0) {
  console.error(`i18n check failed with ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    "\nFix the keys in src/features/i18n/locales/{en,zh-HK}.json (both files, " +
      "or drop the namespace argument from useTranslation). See scripts/check-i18n.mjs.",
  );
  process.exit(1);
}

console.log(
  `i18n check OK: ${flattened[enName].size} keys in ${enName} and ${flattened[zhName].size} in ${zhName}, ` +
    `all source t() keys resolve, no namespace args.`,
);
