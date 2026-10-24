import { createContext, useContext } from "react";

/**
 * True while a blocking gate dialog (onboarding / TOS) is on screen —
 * or the check that decides whether to show it is still in flight. Page-level
 * popups that would otherwise stack on top of the dialog (the coach-tour /
 * TOS overlap) hold off until this flips false. Defaults to false so
 * consumers rendered outside the gates behave exactly as before.
 */
export const GateOverlayContext = createContext(false);

export function useGateOverlayPending(): boolean {
  return useContext(GateOverlayContext);
}
