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
export default defineConfig({
  plugins: [
    tanstackStart({
      server: { entry: "server" },
    }),
    viteReact(),
    tailwindcss(),
    tsConfigPaths(),
    nitro(),
  ],
});
