// Generates per-chunk SQL files from batch JSON data.
// Usage: node scripts/tutor-import/gen-chunks.mjs
import { readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const sqlDir = join(dir, "sql");
const JSONB_COLS = new Set(["exam_results", "achievements"]);

const cols = [
  "tutor_code",
  "display_name",
  "headline",
  "subjects",
  "district",
  "stations",
  "hourly_rate",
  "badge",
  "is_published",
  "experience_years",
  "languages",
  "exam_results",
  "lesson_mode",
  "gender",
  "university",
  "target_students",
  "qualifications_summary",
  "achievements",
  "ia_ee_tok_support",
  "ia_ee_tok_notes",
  "academic_headline",
  "secondary_school",
  "card_highlights",
];

function esc(col, v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) {
    const isJsonb = JSONB_COLS.has(col) || (v.length > 0 && v.some((x) => typeof x !== "string"));
    if (isJsonb) return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
    if (v.length === 0) return "'{}'::text[]";
    return `ARRAY[${v.map((x) => `'${String(x).replace(/'/g, "''")}'`).join(", ")}]::text[]`;
  }
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

for (const f of readdirSync(sqlDir)) {
  if (f.startsWith("chunk-")) rmSync(join(sqlDir, f));
}

const ROWS_PER_CHUNK = 4;
let chunk = 0;
let stmts = [];

const flush = () => {
  if (!stmts.length) return;
  chunk += 1;
  const sql = `INSERT INTO public.tutors (${cols.join(", ")}) VALUES\n${stmts.join(",\n")}\nON CONFLICT (tutor_code) DO NOTHING;`;
  writeFileSync(join(sqlDir, `chunk-${String(chunk).padStart(2, "0")}.sql`), `${sql}\n`, "utf8");
  stmts = [];
};

const batchFiles = readdirSync(dir)
  .filter((f) => /^batch-\d+\.json$/.test(f))
  .sort();
for (const file of batchFiles) {
  const rows = JSON.parse(readFileSync(join(dir, file), "utf8"));
  for (const t of rows) {
    if (stmts.length >= ROWS_PER_CHUNK) flush();
    stmts.push(`  (${cols.map((c) => esc(c, t[c] ?? null)).join(", ")})`);
  }
}
flush();
console.log(`Generated ${chunk} chunk files`);
