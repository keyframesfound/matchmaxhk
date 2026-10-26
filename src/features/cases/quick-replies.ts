/**
 * Issue #438 — the three insert-only desk quick replies (CS-005 PART 2
 * triage table, verbatim).
 *
 * INSERT-ONLY: these are copy-to-clipboard buttons. The agent pastes the
 * line into WhatsApp and hits Send themselves — NOTHING here auto-sends
 * (CEO lock: humans approve every outbound line).
 *
 * The `text` strings are the single source of truth for V1 and stay OUT of
 * the i18n JSON (issue §15.7: macro bodies live in paste-pack / CS-005,
 * 繁中-first — never duplicated divergent copies). The `key` is the desk
 * UI's button label (desk jargon, same value in both locales for V1 — EN
 * label variants are V1.1 if needed).
 */

export type QuickReply = {
  /** i18n key carrying the desk jargon button label (desk.quick.*). */
  key: string;
  /** EXACT insert text — copied verbatim to the clipboard. */
  text: string;
};

export const QUICK_REPLIES: readonly QuickReply[] = [
  {
    key: "desk.quick.strike2",
    text: "明白！最後想請問大約的預算（每小時）以及方便上堂的時間？",
  },
  {
    key: "desk.quick.rateNudge",
    text: "明白您的要求。不過目前您填寫的預算/時間較難配對我們 Top 8 的獲認證導師。您可以考慮稍微調整預算，或者轉為網上課堂，配對成功率會大幅提升！或者您也可以在這裡直接瀏覽導師：https://matchmax.hk/tutors",
  },
  {
    key: "desk.quick.priceRange",
    text: "DSE Maths 大約 $250–$350/hr，IB HL 大約 $350–$500/hr。您可以先瀏覽我們的獲認證導師：https://matchmax.hk/tutors。如想我幫您查特定時間，請告訴我學制、科目和大致預算即可！",
  },
];

/**
 * Copy text to the clipboard: navigator.clipboard first, then the legacy
 * textarea + execCommand fallback for permission/insecure-context failures
 * (same pattern as the Help Centre copy box). Returns true when a copy
 * path reported success, so the button can show a failure toast instead of
 * a false "Copied!".
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      textarea.remove();
    }
  }
}
