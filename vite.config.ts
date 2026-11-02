import { cpSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Manual replacement for @lovable.dev/vite-tanstack-config.
//
// That package additionally handled, for free, inside the Lovable editor:
//   - TanStack Router devtools (dev-only) — not installed in this project, skipped
//   - VITE_* env var injection — Vite already does this natively via import.meta.env
//   - the "@" -> "src" path alias — now provided by tsConfigPaths() reading tsconfig.json
//   - React/TanStack package dedupe — only needed if you hit duplicate-instance errors
//   - Lovable's own error-logger plugin and sandbox port/host detection — editor-only,
//     not needed outside Lovable
//
// This config targets Cloudflare via Nitro's default detection, matching the original
// comment ("nitro (build-only using cloudflare as a default target)"). If you deploy
// elsewhere (Vercel, Node, Netlify), Nitro auto-detects most platforms at build time;
// see https://nitro.build for explicit preset configuration if auto-detection doesn't
// pick the right one.
// Notes: pdfjs renders many real PDFs only with its CMap (CJK), standard
// font, ICC and wasm (JPEG 2000 / colour profile) data. Copy them from the
// installed pdfjs-dist into public/pdfjs (gitignored) so they are served
// from our own origin and always match the bundled pdfjs version.
function copyPdfjsAssets() {
  return {
    name: "matchmax-copy-pdfjs-assets",
    buildStart() {
      const from = fileURLToPath(new URL("./node_modules/pdfjs-dist/", import.meta.url));
      const to = fileURLToPath(new URL("./public/pdfjs/", import.meta.url));
      for (const dir of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
        if (existsSync(`${from}${dir}`))
          cpSync(`${from}${dir}`, `${to}${dir}`, { recursive: true });
      }
    },
  };
}

export default defineConfig({
  resolve: {
    alias: [
      // pdf-lib (server-side note watermark / stamping) imports tslib. Its
      // CJS/UMD entry bundles to an undefined default in the Worker, so every
      // server function that loads pdf-lib crashed with "Cannot destructure
      // property '__extends'". The pure ESM build has named exports only.
      {
        find: /^tslib$/,
        replacement: fileURLToPath(new URL("./node_modules/tslib/tslib.es6.mjs", import.meta.url)),
      },
    ],
  },
  plugins: [
    copyPdfjsAssets(),
    tanstackStart({
      server: { entry: "server" },
    }),
    viteReact(),
    tailwindcss(),
    tsConfigPaths(),
    nitro({
      // Issue #112: daily FX rate refresh. experimental.tasks enables the
      // tasks/ directory; the cloudflare-module preset then exports a
      // scheduled() handler that runs fx-refresh on the Worker's cron trigger.
      // TanStack Start leaves Nitro's scanDirs empty, so the root is added
      // explicitly for the tasks/ scan to find anything.
      experimental: { tasks: true },
      scanDirs: ["."],
      scheduledTasks: {
        // 06:00 HKT — after the ECB reference-rate fix.
        "0 22 * * *": "fx-refresh",
        // #543: hourly materials checkout hold release (72h cut-off).
        "15 * * * *": "materials-release",
        // #561: daily Action Required reminder sweep, 09:00 HKT.
        "0 1 * * *": "action-reminders",
      },
    }),
  ],
});
