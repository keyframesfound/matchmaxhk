/**
 * #784 §2.6 (CEO lock 2026-11-19): append-only starter helpers on the notes
 * listing form. A chip never overwrites what the seller wrote; the form keeps
 * one-step undo. Pure so vitest pins the append rule.
 */

/** Title: set when empty, otherwise append after a separator (never replace). */
export function appendToTitle(current: string, chip: string, maxLength = 160): string {
  const base = current.trim();
  const add = chip.trim();
  if (!add) return current;
  if (!base) return add.slice(0, maxLength);
  if (base.toLowerCase().includes(add.toLowerCase())) return current;
  return `${base} · ${add}`.slice(0, maxLength);
}

/** Description: append the starter on a new paragraph (never replace). */
export function appendToDescription(current: string, starter: string, maxLength = 4000): string {
  const add = starter.trim();
  if (!add) return current;
  const base = current.replace(/\s+$/, "");
  return (base ? `${base}\n\n${add}` : add).slice(0, maxLength);
}

/** The base phrase title chips build on ("IB Biology · Cell respiration"). */
export function titleBase(input: { curriculum: string; subject: string; topic: string }): string {
  const lead = [input.curriculum, input.subject]
    .map((v) => v.trim())
    .filter(Boolean)
    .join(" ");
  const topic = input.topic.trim();
  return [lead, topic].filter(Boolean).join(" · ");
}
