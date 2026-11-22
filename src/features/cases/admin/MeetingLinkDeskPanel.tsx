import { useQuery, useQueryClient } from "@tanstack/react-query";

import { MeetingLink } from "@/features/cases/case-manager/meeting-link-bar";
import { getCaseMeetingUrl } from "@/features/cases/case-schedule.functions";

/**
 * #785 AC-CONV-1: the desk half of the meeting link. The tutor path reads the
 * link off the case row; `tutoring_cases.meeting_url` has no SELECT grant for
 * `authenticated`, so the desk has to read it through the server fn instead.
 * That fn returns null for a caller who is not a case party, and this panel
 * then renders nothing. A staff caller gets the same editor the tutor uses,
 * which is the point: one link, one place to save it.
 */
export function MeetingLinkDeskPanel({ caseId, mode }: { caseId: string; mode: string | null }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["case-meeting-url", caseId],
    queryFn: () => getCaseMeetingUrl({ data: { caseId } }),
  });

  // Loading, or a caller the server does not recognise as a party of this case.
  if (!data) return null;

  return (
    <MeetingLink
      caseId={caseId}
      url={data.url}
      mode={mode}
      canEdit
      canClear
      onSaved={() => void queryClient.invalidateQueries({ queryKey: ["case-meeting-url", caseId] })}
    />
  );
}
