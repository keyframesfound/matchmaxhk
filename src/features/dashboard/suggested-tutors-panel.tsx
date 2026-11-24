import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { CompareBar, CompareDialog, useTutorCompare } from "@/features/tutors/compare-tutors";
import { PublicTutorCard } from "@/features/tutors/public-tutor-card";
import { fetchPublishedTutors } from "@/features/tutors/queries";
import { TutorSaveButton } from "@/features/tutors/saved-tutors";
import { SuggestedTutorsSection } from "@/features/tutors/suggested-tutors-section";
import { getTutorInquiryAction } from "@/features/tutors/tutor-display";
import { trackTutorEvent } from "@/features/tracking/engagement-client";
import { supabase } from "@/integrations/supabase/client";

/** Same app_settings read the landing page uses, so the inquiry link matches. */
async function fetchWhatsappNumber(): Promise<string> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "whatsapp_number")
    .maybeSingle();
  if (error) throw error;
  return typeof data?.value === "string" ? data.value : "";
}

/**
 * #716 on the signed-in dashboard: the landing page's "Suggested for you" row,
 * above the parent's own cases.
 *
 * Behaviour is the landing's, not a copy of it: the same published-tutor query
 * (shared `["tutors", "published"]` cache key), the same compare selection and
 * the same `PublicTutorCard` with the platform WhatsApp inquiry. The section is
 * still the single source of truth for who appears — it renders nothing for a
 * guest or when fewer than two honest picks exist — so this wrapper adds no
 * visibility rule of its own.
 */
export function DashboardSuggestedTutors() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const { data: publishedTutors = [] } = useQuery({
    queryKey: ["tutors", "published"],
    queryFn: fetchPublishedTutors,
  });

  const { data: whatsappNumber = "" } = useQuery({
    queryKey: ["settings", "whatsapp_number"],
    queryFn: fetchWhatsappNumber,
  });

  const { compareIds, compareTutors, toggleCompare, compareOpen, setCompareOpen, clearCompare } =
    useTutorCompare(publishedTutors);

  const openTutorDetail = (tutorCode: string) => {
    void navigate({ to: "/tutors/$tutorCode", params: { tutorCode } });
  };

  return (
    <>
      <SuggestedTutorsSection
        tutors={publishedTutors}
        renderCard={(tutor) => {
          const inquiry = getTutorInquiryAction(tutor, whatsappNumber, i18n.language);
          return (
            <PublicTutorCard
              tutor={tutor}
              priceSuffix={t("featured.per_hour")}
              onOpen={openTutorDetail}
              compareSelected={compareIds.includes(tutor.id)}
              onCompareToggle={() => toggleCompare(tutor)}
              footerAction={
                <>
                  <TutorSaveButton tutorId={tutor.id} compact />
                  {inquiry.kind === "status" ? (
                    <span className="inline-flex h-9 items-center rounded-sm bg-[color:var(--ink)]/[0.06] px-4 text-[13px] font-bold text-[color:var(--ink)] @max-sm:h-8 @max-sm:px-3 @max-sm:text-xs">
                      {inquiry.label}
                    </span>
                  ) : (
                    <Button
                      asChild
                      className="h-9 rounded-sm bg-[color:var(--surface-invert)] px-4 text-[13px] font-bold text-[color:var(--surface-invert-fg)] hover:bg-[color:var(--surface-invert-hover)] @max-sm:h-8 @max-sm:px-3 @max-sm:text-xs"
                    >
                      <a
                        href={inquiry.href}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => {
                          event.stopPropagation();
                          void trackTutorEvent(tutor.id, "inquiry_click");
                        }}
                      >
                        {inquiry.label}
                      </a>
                    </Button>
                  )}
                </>
              }
            />
          );
        }}
      />
      <CompareBar
        selectedTutors={compareTutors}
        onOpenCompare={() => setCompareOpen(true)}
        onClear={clearCompare}
      />
      <CompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        tutors={compareTutors}
        whatsappNumber={whatsappNumber}
      />
    </>
  );
}
