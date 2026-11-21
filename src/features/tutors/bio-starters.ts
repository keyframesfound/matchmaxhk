/**
 * Issue #798 AC-TUTOR-FORM-3: bio starter sentences are helpers, never a
 * rewrite. Clicking one appends a new line; the caller keeps the previous
 * value so a single tap can be undone. Seller-written text is never replaced,
 * trimmed or reordered.
 *
 * Pure and dependency-free so the append rule is unit-tested rather than
 * trusted from the component.
 */

/** Append one sentence on its own line, preserving everything already written. */
export function appendBioSentence(current: string, sentence: string): string {
  const addition = sentence.trim();
  if (!addition) return current;
  const base = current.replace(/\s+$/, "");
  if (!base) return addition;
  return `${base}\n${addition}`;
}
