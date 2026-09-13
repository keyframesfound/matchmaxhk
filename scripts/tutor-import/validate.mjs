// Validates curated tutor batches against DB constraints and generates SQL inserts.
// Usage: node scripts/tutor-import/validate.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const batchFiles = readdirSync(dir)
  .filter((f) => /^batch-\d+\.json$/.test(f))
  .sort();

const EXISTING_CODES = new Set([
  "MM-1000",
  "MM-T002",
  "MM-T005",
  "MM-T007",
  "MM-T023",
  "MM-T024",
  "MM-T032",
  "MM-T039",
  "MM-T040",
  "MM-T059",
  "MM-T073",
  "MM-T074",
  "MM-T090",
  "MM-T094",
]);

const DROPPED_DEDUPE = new Set(["MM-T009", "MM-T013", "MM-T018", "MM-T042", "MM-T067"]);

const HK_DISTRICTS = new Set([
  "Within Hong Kong Island",
  "Within Kowloon",
  "Within New Territories",
  "Central",
  "Sheung Wan",
  "Wan Chai",
  "Causeway Bay",
  "North Point",
  "Quarry Bay",
  "Tsim Sha Tsui",
  "Mong Kok",
  "Kowloon Tong",
  "Kowloon Bay",
  "Ho Man Tin",
  "Sha Tin",
  "Tai Po",
  "Tuen Mun",
  "Yuen Long",
  "Tseung Kwan O",
  "Tung Chung",
  "Discovery Bay",
  "Open to Discussion",
]);

const EXAM_SYSTEMS = new Set([
  "ib",
  "dse",
  "alevel",
  "igcse",
  "ap",
  "sat",
  "ielts",
  "isat",
  "ucat",
  "other",
]);
const CORE_SUPPORT = new Set(["IA", "EE", "TOK"]);
const GENDERS = new Set(["male", "female", "other"]);
const LESSON_MODES = new Set(["online", "in_person", "either"]);

const chars = (s) => Array.from(s).length;

const errors = [];
const warnings = [];
const all = [];
const seenCodes = new Set();

for (const file of batchFiles) {
  const rows = JSON.parse(readFileSync(join(dir, file), "utf8"));
  for (const t of rows) {
    const ctx = `${file}:${t.tutor_code}`;
    if (!t.tutor_code || !t.display_name) errors.push(`${ctx}: missing code/name`);
    if (seenCodes.has(t.tutor_code)) errors.push(`${ctx}: duplicate tutor_code`);
    seenCodes.add(t.tutor_code);
    if (EXISTING_CODES.has(t.tutor_code))
      errors.push(`${ctx}: conflicts with existing DB row`);
    if (DROPPED_DEDUPE.has(t.tutor_code))
      errors.push(`${ctx}: code was supposed to be dedupe-dropped`);

    if (!Number.isInteger(t.hourly_rate) || t.hourly_rate < 0)
      errors.push(`${ctx}: hourly_rate must be a non-negative integer`);
    if (!LESSON_MODES.has(t.lesson_mode)) errors.push(`${ctx}: bad lesson_mode`);
    if (t.gender !== null && !GENDERS_OK(t.gender))
      errors.push(`${ctx}: bad gender ${t.gender}`);
    if (t.district !== null && !HK_DISTRICTS.has(t.district))
      errors.push(`${ctx}: district '${t.district}' not in app vocabulary`);

    if (t.lesson_mode === "online" && (t.stations ?? []).length > 0)
      errors.push(`${ctx}: online tutor must have empty stations`);

    const ch = t.card_highlights ?? [];
    if (ch.length > 3) errors.push(`${ctx}: card_highlights has ${ch.length} rows (max 3)`);
    for (const h of ch) {
      if (chars(h) > 60)
        errors.push(`${ctx}: card_highlights row too long (${chars(h)} > 60): ${h}`);
    }

    for (const s of t.ia_ee_tok_support ?? []) {
      if (!CORE_SUPPORT.has(s)) errors.push(`${ctx}: bad ia_ee_tok_support ${s}`);
    }

    for (const sys of t.exam_results ?? []) {
      if (!EXAM_SYSTEMS.has(sys.system)) errors.push(`${ctx}: bad exam system ${sys.system}`);
      if (!Array.isArray(sys.subjects)) errors.push(`${ctx}: exam system missing subjects[]`);
    }

    if (!Array.isArray(t.subjects)) errors.push(`${ctx}: subjects must be an array`);
    for (const s of t.subjects ?? []) {
      if (typeof s !== "string" || !s.trim())
        errors.push(`${ctx}: invalid subject entry ${JSON.stringify(s)}`);
    }
    all.push(t);
  }
}

function GENDERS_OK(g) {
  return g === "male" || g === "female" || g === "other";
}

// summary
const published = all.filter((t) => t.is_published).length;
console.log(`Batches: ${batchFiles.join(", ")}`);
console.log(`Total rows: ${all.length} | published: ${published} | hidden: ${all.length - published}`);
console.log(`Codes: ${all.map((t) => t.tutor_code).join(", ")}`);
const missing = [];
for (let i = 1; i <= 102; i++) {
  const code = `MM-T${String(i).padStart(3, "0")}`;
  if (!all.some((t) => t.tutor_code === code) && !EXISTING_CODES.has(code) && !DROPPED_DEDUPE.has(code))
    missing.push(code);
}
if (missing.length) console.log(`MISSING codes (not in any batch): ${missing.join(", ")}`);

// SQL generation
const esc = (v) => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) {
    if (v.length === 0) return "'{}'::text[]";
    if (v.some((x) => typeof x !== "string"))
      return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
    return `ARRAY[${v.map((x) => `'${String(x).replace(/'/g, "''")}'`).join(", ")}]::text[]`;
  }
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};

mkdirSync(join(dir, "sql"), { recursive: true });
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

let idx = 0;
for (const file of batchFiles) {
  const rows = JSON.parse(readFileSync(join(dir, file), "utf8"));
  const stmts = rows.map((t) => {
    const vals = cols.map((c) => esc(t[c] ?? null)).join(", ");
    return `  (${vals})`;
  });
  const sql = `INSERT INTO public.tutors (${cols.join(", ")}) VALUES\n${stmts.join(",\n")}\nON CONFLICT (tutor_code) DO NOTHING;`;
  idx += 1;
  writeFileSync(join(dir, "sql", file.replace(".json", ".sql")), sql + "\n", "utf8");
}
console.log(`Generated SQL in scripts/tutor-import/sql/ (${idx} files)`);

if (errors.length) {
  console.error(`\nVALIDATION FAILED (${errors.length}):`);
  for (const e of errors) console.error(` - ${e}`);
  process.exit(1);
}
console.log("\nValidation OK.");
