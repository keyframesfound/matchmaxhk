import { MAX_CUSTOM_HEADLINE } from "@/features/tutors/custom-headline";

/**
 * Issue #411 — Auto-Translate DRAFT helper (RULE-BASED ONLY — no AI/LLM
 * service; AI features are parked in this repo). Parses the English custom
 * headline and drafts a zh-HK version for the tutor to edit:
 * - score/title tokens stay as-is ("IBDP 41/45", "SAT 1520");
 * - known segments translate via the dictionary below (universities, majors,
 *   common title words);
 * - unresolved segments stay English.
 * It only fills the ZH input; whatever the tutor saves is what renders
 * (CEO lock — never machine-translate at render time).
 */

/** Lowercase EN token -> zh-HK. Longest phrases first at the call site. */
const DICTIONARY: Record<string, string> = {
  // Universities / institutions
  "imperial college london": "帝國理工學院",
  imperial: "帝國理工",
  hku: "港大",
  "the university of hong kong": "香港大學",
  "university of hong kong": "香港大學",
  cuhk: "中大",
  "chinese university of hong kong": "香港中文大學",
  hkust: "科大",
  "hong kong university of science and technology": "香港科技大學",
  "hong kong polytechnic university": "香港理工大學",
  polyu: "理大",
  cityu: "城大",
  "city university of hong kong": "香港城市大學",
  "university of oxford": "牛津大學",
  oxford: "牛津",
  "university of cambridge": "劍橋大學",
  cambridge: "劍橋",
  oxbridge: "牛劍",
  ucl: "倫敦大學學院",
  "university college london": "倫敦大學學院",
  lse: "倫敦政經",
  "london school of economics": "倫敦政經",
  "king's college london": "倫敦國王學院",
  "university of edinburgh": "愛丁堡大學",
  "university of manchester": "曼徹斯特大學",
  // Majors / subjects
  medicine: "醫學",
  medical: "醫學",
  law: "法律",
  mathematics: "數學",
  maths: "數學",
  math: "數學",
  physics: "物理",
  chemistry: "化學",
  biology: "生物",
  engineering: "工程",
  eng: "工程",
  "aeronautical engineering": "航空工程",
  aero: "航空",
  economics: "經濟",
  business: "商科",
  "computer science": "電腦科學",
  compsci: "電腦科學",
  architecture: "建築",
  psychology: "心理學",
  pharmacy: "藥劑學",
  accounting: "會計",
  finance: "金融",
  // Title words
  examiner: "考官",
  tutor: "導師",
  teacher: "教師",
  graduate: "畢業",
  student: "學生",
  specialist: "專家",
  official: "官方",
  patient: "耐心",
};

/** Tokens that are scores/qualifiers and must be kept verbatim. */
const KEEP_TOKEN_RE =
  /^(?:\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?|\d+[a-z*]+\b|\d+(?:\.\d+)?|a\*|ibdp|hkdse|igcse|gce|a-level|alevel|ap|sat|ielts|isat|ucat|tok|ee|ia|m1|m2|hl|sl)$/iu;

/** Strip everything but dictionary-relevant characters for phrase lookup. */
const WORD_RE = /[^a-z0-9*/.+' ]/gu;

function normalizeToken(token: string): string {
  return token.toLowerCase().replace(/'s\b/u, "").replace(WORD_RE, "").trim();
}

/** Score/curriculum tokens that must stay exactly as written. */
function isKeepToken(token: string): boolean {
  return KEEP_TOKEN_RE.test(token.trim());
}

function translateSegment(segment: string): string {
  const tokens = segment.split(/\s+/u).filter(Boolean);
  const out: string[] = [];

  let i = 0;
  while (i < tokens.length) {
    // Longest dictionary phrase first (3 -> 2 -> 1 words).
    let matched = false;
    for (const span of [3, 2] as const) {
      if (i + span > tokens.length) continue;
      const phrase = tokens
        .slice(i, i + span)
        .map(normalizeToken)
        .join(" ");
      if (DICTIONARY[phrase]) {
        out.push(DICTIONARY[phrase]);
        i += span;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Single token (no 3/2-word phrase matched here).
    const single = normalizeToken(tokens[i]);
    if (isKeepToken(tokens[i])) {
      out.push(tokens[i].trim());
    } else if (single && DICTIONARY[single]) {
      out.push(DICTIONARY[single]);
    } else {
      // Unknown — stays English, exactly as typed.
      out.push(tokens[i]);
    }
    i += 1;
  }

  // Consecutive Chinese tokens join without spaces; English runs keep them.
  let result = "";
  for (const piece of out) {
    if (!result) {
      result = piece;
      continue;
    }
    const chineseAdjacent =
      /[\u4e00-\u9fff]/u.test(result.slice(-1)) && /[\u4e00-\u9fff]/u.test(piece[0]);
    result += chineseAdjacent ? piece : ` ${piece}`;
  }
  return result.trim();
}

/**
 * Draft a zh-HK headline from the EN one. Segments split on "|"; each is
 * translated token-wise; unresolved words stay English. Returns "" when the
 * input has no usable content.
 */
export function draftChineseHeadline(en: string | null | undefined): string {
  const source = (en ?? "").trim();
  if (!source) return "";
  const translated = source
    .split(/\s*\|\s*/u)
    .map((segment) => translateSegment(segment.trim()))
    .filter(Boolean)
    .join(" | ");
  return translated.slice(0, MAX_CUSTOM_HEADLINE);
}
