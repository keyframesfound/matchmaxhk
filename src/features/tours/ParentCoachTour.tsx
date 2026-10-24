import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useGateOverlayPending } from "@/features/auth/gate-overlay";
import "driver.js/dist/driver.css";
import {
  TOUR_STORAGE_KEYS,
  hasSeenTour,
  markTourSeen,
  runCoachTour,
  tourStep,
} from "./coach-tours";

/**
 * Issue #397 parent/student tour. Fires exactly once on the tutor directory
 * — the issue's trigger is "first interaction with the main search bar OR
 * first view of a tutor card", so `ready` (results on screen) starts it after
 * a beat. Missing targets (e.g. no results, no shop tab) skip their step.
 *
 * Holds off while a blocking gate dialog (onboarding/TOS) is up, so it
 * never stacks on those dialogs.
 */
export function ParentCoachTour({ ready }: { ready: boolean }) {
  const { t } = useTranslation();
  const gatePending = useGateOverlayPending();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!ready || gatePending || startedRef.current || hasSeenTour(TOUR_STORAGE_KEYS.parent))
      return;
    startedRef.current = true;

    const timer = window.setTimeout(() => {
      // The concierge entry lives inside the filters dialog (hidden by
      // default), so the closing step is a centered popover rather than a
      // spotlight — consistent with the tutor tour's final card.
      const steps = [
        tourStep("parent-search", t("tour.parent.search_title"), t("tour.parent.search_body")),
        tourStep("parent-card", t("tour.parent.card_title"), t("tour.parent.card_body")),
        tourStep("parent-save", t("tour.parent.save_title"), t("tour.parent.save_body")),
        tourStep("parent-shop", t("tour.parent.shop_title"), t("tour.parent.shop_body")),
        tourStep(null, t("tour.parent.concierge_title"), t("tour.parent.concierge_body")),
      ].filter((step): step is NonNullable<typeof step> => step !== null);

      runCoachTour(
        steps,
        {
          next: t("tour.next"),
          back: t("tour.back"),
          done: t("tour.done"),
          skip: t("tour.skip"),
        },
        () => markTourSeen(TOUR_STORAGE_KEYS.parent),
      );
    }, 800);

    return () => window.clearTimeout(timer);
  }, [ready, gatePending, t]);

  return null;
}
