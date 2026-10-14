// Local-only: slim vitest config for the git worktree, whose node_modules is a
// symlink to the main checkout. The full vite.config.ts pulls in the nitro +
// TanStack Router plugins, which refuse to load packages through the symlink
// (vite fs.allow). Pure-helper tests don't need them — just the "@" alias.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
