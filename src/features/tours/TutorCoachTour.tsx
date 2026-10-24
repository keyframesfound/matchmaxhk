import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import "driver.js/dist/driver.css";
import {
  TOUR_STORAGE_KEYS,
  hasSeenTour,
  markTourSeen,
  runCoachTour,
  tourStep,
  visibleTourElement,
} from "./coach-tours";

/**
 * Issue #397 tutor tour. Fires exactly once when a tutor lands on the
 * dashboard with their profile approved AND published (`enabled`) — never on
 * a merely submitted application. Steps whose target is missing or hidden
 * (ghost elements) are skipped by `tourStep`.
 */
export function TutorCoachTour({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || startedRef.current || hasSeenTour(TOUR_STORAGE_KEYS.tutor)) return;
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
  }, [enabled, navigate, t]);

  return null;
}
