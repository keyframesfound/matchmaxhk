import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useGateOverlayPending } from "@/features/auth/gate-overlay";
import "driver.js/dist/driver.css";
import {
  TOUR_STORAGE_KEYS,
  hasSeenTour,
  markTourSeen,
  runCoachTour,
  tourStep,
  visibleTourElement,
} from "./coach-tours";
import { consumeTourRequest, TOUR_REQUEST_EVENT } from "./tour-requests";

/**
 * Issue #397 tutor tour. Fires exactly once when a tutor lands on the
 * dashboard with their profile approved AND published (`enabled`), never on
 * a merely submitted application. Steps whose target is missing or hidden
 * (ghost elements) are skipped by `tourStep`.
 *
 * While a blocking gate dialog (onboarding/TOS) is up, or its check is
 * still in flight, the tour holds off, so it starts only after the user has
 * accepted the Terms instead of stacking on the dialog. A replay request from
 * the header menu (`requestTour`) re-launches it on demand, bypassing the
 * once-only flag.
 */
export function TutorCoachTour({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const gatePending = useGateOverlayPending();
  const startedRef = useRef(false);
  const [requestSeq, setRequestSeq] = useState(0);

  // Header menu can (re)launch the tour while this component is mounted.
  useEffect(() => {
    const onRequest = (event: Event) => {
      if ((event as CustomEvent<string>).detail === TOUR_STORAGE_KEYS.tutor) {
        setRequestSeq((seq) => seq + 1);
      }
    };
    window.addEventListener(TOUR_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(TOUR_REQUEST_EVENT, onRequest);
  }, []);

  useEffect(() => {
    const manual = consumeTourRequest(TOUR_STORAGE_KEYS.tutor);
    if (!manual) {
      if (!enabled || gatePending || startedRef.current || hasSeenTour(TOUR_STORAGE_KEYS.tutor)) {
        return;
      }
    }
    startedRef.current = true;

    let cancelled = false;
    let timer = 0;
    const beganAt = Date.now();

    const tryStart = () => {
      if (cancelled) return;
      // The preview/rates targets live in the My Tutor tab; the tour is the
      // published-tutor landing experience, so switch there first.
      if (!window.location.hash.toLowerCase().includes("my-tutor")) {
        void navigate({ to: "/dashboard", hash: "my-tutor" });
      }
      // The public-profile link only renders once the tutor query resolves —
      // wait for it (bounded) so step 1 isn't silently skipped on first load.
      const previewReady = visibleTourElement("tutor-preview") !== null;
      if (!previewReady && Date.now() - beganAt < 8000) {
        timer = window.setTimeout(tryStart, 400);
        return;
      }
      const steps = [
        tourStep("tutor-preview", t("tour.tutor.preview_title"), t("tour.tutor.preview_body")),
        tourStep("tutor-rates", t("tour.tutor.rates_title"), t("tour.tutor.rates_body")),
        tourStep(
          "tutor-verification",
          t("tour.tutor.verification_title"),
          t("tour.tutor.verification_body"),
        ),
        tourStep("tutor-materials", t("tour.tutor.shop_title"), t("tour.tutor.shop_body")),
        tourStep("tutor-cases", t("tour.tutor.cases_title"), t("tour.tutor.cases_body")),
        tourStep(null, t("tour.tutor.final_title"), t("tour.tutor.final_body")),
      ].filter((step): step is NonNullable<typeof step> => step !== null);

      runCoachTour(
        steps,
        {
          next: t("tour.next"),
          back: t("tour.back"),
          done: t("tour.done"),
          skip: t("tour.skip"),
        },
        () => markTourSeen(TOUR_STORAGE_KEYS.tutor),
      );
    };

    timer = window.setTimeout(tryStart, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, gatePending, requestSeq, navigate, t]);

  return null;
}
