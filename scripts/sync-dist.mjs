// Mirrors the Nitro static output (.output/public) into ./dist so tooling that
// expects a conventional dist/index.html can find the built client assets.
import { cp, rm, access } from "node:fs/promises";
import { resolve } from "node:path";

const source = resolve(process.cwd(), ".output/public");
const target = resolve(process.cwd(), "dist");

try {
  await access(source);
} catch {
  console.warn("[sync-dist] .output/public not found, skipping.");
  process.exit(0);
}

await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });
console.log("[sync-dist] Copied .output/public -> dist");
