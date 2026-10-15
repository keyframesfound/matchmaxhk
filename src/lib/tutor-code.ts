/**
 * Shared tutor_code allocation (issue #310).
 *
 * The max+1 pattern previously lived inside the admin autofill server fn;
 * go-live-on-submit needs the exact same rule on the server, so it moved
 * here. Both callers must stay on this single implementation.
 */
export function nextTutorCode(rows: { tutor_code?: string | null }[]): string {
  let max = 0;
  for (const row of rows) {
    const match = /^MM-T(\d+)$/i.exec((row.tutor_code ?? "").trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `MM-T${String(max + 1).padStart(3, "0")}`;
}
