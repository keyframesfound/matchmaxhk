/**
 * #815 §2.9 (was #582) Stage 2: a tutor accepts a Centre case only as a
 * Cap. 57 independent self-employed operator. Applying reveals the full
 * centre name (cases.functions centreReveal), so the confirm is checked on
 * the server, not only by the UI radio.
 */
export const CAP57_CONFIRM_REQUIRED =
  "Confirm you accept this case as an independent self-employed operator before the centre is revealed. / 請先確認以獨立自僱身份接受此個案，才會顯示中心。";

export function assertCentreCap57(
  organisationId: string | null | undefined,
  cap57Confirmed: boolean | undefined,
): void {
  if (organisationId && cap57Confirmed !== true) throw new Error(CAP57_CONFIRM_REQUIRED);
}
