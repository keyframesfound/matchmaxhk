/**
 * WhatsApp deep-link builders for the study-materials marketplace
 * (issues #131/#134). Both routes go through the MatchMax concierge number —
 * MatchMax never processes payment; the concierge hands the parent to the
 * tutor and invoices the tutor its 20% commission separately.
 */

/** "Purchase via WhatsApp" — the issue's verbatim buy message. */
export function buildBuyWhatsAppUrl(
  whatsappNumber: string | undefined,
  material: { title: string; price_hkd: number },
  tutorName: string,
): string {
  const digits = (whatsappNumber ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";
  const message = `Hi MatchMax, I want to buy ${material.title} from Tutor ${tutorName} for $${material.price_hkd}.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** "Book lessons & get notes free" — concierge WhatsApp, lessons flavour. */
export function buildBookLessonsWhatsAppUrl(
  whatsappNumber: string | undefined,
  tutorName: string,
  tutorCode: string,
): string {
  const digits = (whatsappNumber ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";
  const message = `Hi MatchMax, I'd like to book 1-on-1 lessons with Tutor ${tutorName} (${tutorCode}) — and get their study materials for free.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
