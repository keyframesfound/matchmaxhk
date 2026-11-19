/**
 * #782 §2.3 (was #755 / #215): server-side contraband guard. Walks a save
 * fn's validated input, screens every text value against the banned-terms
 * dictionary in safety-screen.ts and every filename-looking value against
 * the dangerous file-type list. A hit is logged for staff (category + term
 * only, never the blocked content) and the save is rejected with a
 * bilingual reason. Never silently drops a submission.
 */

import {
  contrabandMessage,
  isBlockedFileName,
  screenContraband,
  type ContrabandCategory,
} from "@/features/trust/safety-screen";

const MAX_DEPTH = 5;
const MAX_TEXT = 200_000;

function collect(
  value: unknown,
  key: string,
  depth: number,
  texts: string[],
  fileNames: string[],
): void {
  if (depth > MAX_DEPTH || value == null) return;
  if (typeof value === "string") {
    // Embedded file payloads (data: URLs / base64) are not text to screen.
    if (value.startsWith("data:") || value.length > MAX_TEXT) return;
    if (value.length > 512 && /^[A-Za-z0-9+/=\s]+$/.test(value)) return; // raw base64
    texts.push(value);
    if (/file.?name|filename|^name$/i.test(key) && value.includes(".")) fileNames.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collect(item, key, depth + 1, texts, fileNames);
    return;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      collect(v, k, depth + 1, texts, fileNames);
    }
  }
}

/** Pure: the first problem in a payload, or null when it is clean. */
export function findContrabandInPayload(
  payload: unknown,
): { category: ContrabandCategory | "file_type"; term: string } | null {
  const texts: string[] = [];
  const fileNames: string[] = [];
  collect(payload, "", 0, texts, fileNames);
  const badFile = fileNames.find((name) => isBlockedFileName(name));
  if (badFile) return { category: "file_type", term: badFile.slice(0, 60) };
  return screenContraband(texts);
}

/** Throws the bilingual reason (and logs the hit) when the payload is not clean. */
export async function assertNoContraband(
  userId: string | null,
  surface: string,
  payload: unknown,
): Promise<void> {
  const hit = findContrabandInPayload(payload);
  if (!hit) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asAdminDb } = await import("@/features/materials/storage-helpers");
    await asAdminDb(supabaseAdmin)
      .from<never>("contraband_hits")
      .insert({ user_id: userId, surface, category: hit.category, matched_term: hit.term });
  } catch (e) {
    // The log is advisory; the block below still happens.
    console.warn("[contraband] hit log failed:", e instanceof Error ? e.message : e);
  }
  throw new Error(contrabandMessage(hit.category));
}
