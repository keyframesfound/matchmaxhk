/**
 * #712 AC-3: the monthly tuition statement as a wa.me deep link.
 *
 * No recipient number is baked in, so the sender picks the chat; the text is
 * the same paste-ready summary the copy button uses. Kept in its own module so
 * the pure helper can be tested without importing a React component file.
 */
export function statementShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
