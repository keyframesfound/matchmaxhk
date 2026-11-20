/** #784 §2.2: owner-only masking; enough to recognise, never the full number. */
export function maskPayoutValue(value: string | null | undefined): string {
  const v = (value ?? "").replace(/\s+/g, "");
  if (v.length <= 4) return v ? "••••" : "";
  return `•••• ${v.slice(-4)}`;
}
