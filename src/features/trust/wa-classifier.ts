/**
 * Issue #529 §D — WhatsApp Business advisory classifier, pure half.
 *
 * The WA desk (#511) forwards chat lines to /api/trust/wa-ingest; each line
 * is screened here into #529 A4 flags. Every hit is ADVISORY (source =
 * ai_advisory): it opens a case_risk_flags row (which already revokes
 * contact reveal for blocking types) and pings the desk. Nothing here bans,
 * blacklists or freezes — humans resolve.
 *
 * Privacy (#529 D): only the matched keyword is kept as evidence, never the
 * message body.
 */

import type { CaseRiskFlagType } from "@/features/trust/trust";

export type WaFlagHit = { flagType: CaseRiskFlagType; confidence: number; evidence: string };

type Rule = { flagType: CaseRiskFlagType; confidence: number; pattern: RegExp };

const MAX_TEXT = 4000;
const MAX_EVIDENCE = 80;

const RULES: readonly Rule[] = [
  {
    flagType: "SCAM_OVERPAYMENT",
    confidence: 0.9,
    pattern:
      /(wire transfer|cashier'?s? cheque|bank draft|western union|bitcoin|crypto|usdt|gift ?cards?|refund the (difference|balance)|overpaid.{0,20}refund|send back the (extra|difference)|匯款|本票|加密貨幣|比特幣|禮品卡|退返差額)/i,
  },
  {
    flagType: "SCAM_BAIT_AND_SWITCH",
    confidence: 0.8,
    pattern:
      /(send (my|a) friend (instead|to teach)|my friend will (teach|come)|different (person|tutor) (came|showed up)|not the (same )?(tutor|person) (in|on) the (profile|photo)|叫(咗)?朋友(代|去)(教|上堂))/i,
  },
  {
    flagType: "HOSTILE_OR_ABUSIVE_CLIENT",
    confidence: 0.75,
    pattern:
      /(yell(ed|ing)? at me|threaten(ed|ing)?|harass(ed|ing|ment)?|scared to go back|feel unsafe|unpaid extra (kid|child|student)|teach (his|her|their) (brother|sister|siblings?) for free|鬧我|恐嚇|騷擾|唔安全|驚返去)/i,
  },
  {
    flagType: "BYPASS_COLLUSION_RISK",
    confidence: 0.85,
    pattern:
      /(pay (you|the tutor|me) direct(ly)?|skip (the )?(agency|matchmax)|without (going through )?matchmax|off[- ]platform|tell matchmax (we|i) stopped|don'?t tell matchmax|私下(交易|付款|俾錢)|唔經\s*matchmax|直接俾錢)/i,
  },
  {
    flagType: "SERIAL_HOPPER_PARENT",
    confidence: 0.6,
    pattern:
      /(tried \d+ (other )?(agencies|tutors|centres|centers)|changed tutors? \d+ times|試過\s*\d+\s*(間|個)\s*(中介|補習社|導師))/i,
  },
];

/** At most one hit per flag type; evidence is the matched keyword only. */
export function classifyWhatsAppMessage(text: string | null | undefined): WaFlagHit[] {
  const body = (text ?? "").slice(0, MAX_TEXT);
  if (!body.trim()) return [];
  return RULES.flatMap((rule) => {
    const m = body.match(rule.pattern);
    return m
      ? [
          {
            flagType: rule.flagType,
            confidence: rule.confidence,
            evidence: m[0].slice(0, MAX_EVIDENCE),
          },
        ]
      : [];
  });
}

/** Hex HMAC-SHA256 of the raw body; the WA desk signs with the shared secret. */
export async function signIngestBody(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time compare of the provided signature against the expected one. */
export async function verifyIngestSignature(
  body: string,
  signature: string | null | undefined,
  secret: string | null | undefined,
): Promise<boolean> {
  if (!secret || !signature) return false;
  const expected = await signIngestBody(body, secret);
  const given = signature
    .trim()
    .toLowerCase()
    .replace(/^sha256=/, "");
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
