import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// i18n guards: this project keeps every locale under i18next's single default
// "translation" namespace (no fallbackNS). Passing a namespace to
// useTranslation() or referencing a key missing from a locale file makes t()
// silently render raw key text — see scripts/check-i18n.mjs for the
// repo-wide version of these checks.
const localesDir = new URL("./src/features/i18n/locales/", import.meta.url);
function loadLocale(name) {
  try {
    return JSON.parse(readFileSync(fileURLToPath(new URL(name, localesDir)), "utf8"));
  } catch {
    return null;
  }
}
const i18nLocaleFiles = ["en.json", "zh-HK.json"];
const i18nLocales = Object.fromEntries(i18nLocaleFiles.map((name) => [name, loadLocale(name)]));

function i18nKeyExists(locale, key) {
  if (!locale) return false;
  return (
    key.split(".").reduce((acc, part) => (acc == null ? undefined : acc[part]), locale) !==
    undefined
  );
}

const i18nGuards = {
  rules: {
    "valid-translation-key": {
      meta: {
        messages: {
          missing:
            'i18n: t("{{key}}") has no entry in {{locales}} — the raw key text will render instead of a translation. Add the key to both src/features/i18n/locales files or fix the path.',
        },
        schema: [],
      },
      create(context) {
        const source = context.sourceCode.text;
        // Only files that actually set up the translator use `t` as the i18next
        // translate function; elsewhere `t(` may be an unrelated helper.
        if (!source.includes("useTranslation")) return {};
        return {
          CallExpression(node) {
            if (node.callee.type !== "Identifier" || node.callee.name !== "t") return;
            const arg = node.arguments[0];
            if (!arg || arg.type !== "Literal" || typeof arg.value !== "string") return;
            const missingIn = i18nLocaleFiles.filter(
              (name) => !i18nKeyExists(i18nLocales[name], arg.value),
            );
            if (missingIn.length > 0) {
              context.report({
                node: arg,
                messageId: "missing",
                data: { key: arg.value, locales: missingIn.join(", ") },
              });
            }
          },
        };
      },
    },
    "no-translation-namespace": {
      meta: {
        messages: {
          namespace:
            'i18n: this project has a single default "translation" namespace with no fallback. Call useTranslation() with no arguments and prefix keys with their JSON subtree (e.g. t("settings.title")). Passing a namespace makes every t() return raw key text.',
        },
        schema: [],
      },
      create(context) {
        return {
          CallExpression(node) {
            if (node.callee.type !== "Identifier" || node.callee.name !== "useTranslation") return;
            if (node.arguments.length > 0) {
              context.report({ node: node.arguments[0], messageId: "namespace" });
            }
          },
        };
      },
    },
  },
};

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/\\bshadow-|\\bdrop-shadow|\\bbox-shadow\\b/], TemplateElement[value.raw=/\\bshadow-|\\bdrop-shadow|\\bbox-shadow\\b/]",
          message:
            "No shadows: this design system is flat and border-based. Remove shadow-*/drop-shadow/box-shadow; use borders, surface colors, or ring-* (focus only) instead.",
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "i18n-guards": i18nGuards },
    rules: {
      "i18n-guards/valid-translation-key": "error",
      "i18n-guards/no-translation-namespace": "error",
    },
  },
  eslintPluginPrettier,
);
