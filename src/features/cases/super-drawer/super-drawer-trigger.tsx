import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { NotebookPen, Rocket } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getPendingRecapCases,
  type PendingRecapItem,
} from "@/features/cases/super-drawer/super-drawer.functions";
import { SuperDrawer } from "@/features/cases/super-drawer/super-drawer";

const PAST_SOR_STATUSES = new Set(["closed", "replaced"]);

/**
 * #767 Super-Drawer entry point on the tutor dashboard case card:
 * the primary Log Lesson CTA plus the permanent escape-hatch companion
 * badge [ Add Recap & Tags / 補上摘要及標籤 ] when a logged lesson still
 * misses its recap/tags. Never rendered on parent/student surfaces.
 */
export function SuperDrawerControl({
  caseId,
  caseCode,
  studentName,
  subject,
  sorStatus,
}: {
  caseId: string;
  caseCode: string;
  studentName: string | null;
  subject: string | null;
  sorStatus: string | null;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [completeLessonId, setCompleteLessonId] = useState<string | null>(null);

  // Same queryKey across every case card → one network request total.
  const { data } = useQuery({
    queryKey: ["super-drawer", "pending"],
    queryFn: () => getPendingRecapCases(),
  });
  const pending: PendingRecapItem | undefined = data?.items.find((i) => i.caseId === caseId);

  // Active cases only; closed/replaced cards never render the CTA.
  if (sorStatus && PAST_SOR_STATUSES.has(sorStatus)) return null;

  const openDrawer = (lessonId: string | null) => {
    setCompleteLessonId(lessonId);
    setOpen(true);
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" onClick={() => openDrawer(null)}>
        <Rocket className="h-4 w-4" />
        {t("super_drawer.title")}
      </Button>
      {pending ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => openDrawer(pending.lessonId)}
        >
          <NotebookPen className="h-4 w-4" />
          {t("super_drawer.badge")}
        </Button>
      ) : null}
      {open ? (
        <SuperDrawer
          caseId={caseId}
          caseCode={caseCode}
          studentName={studentName}
          subject={subject}
          completeLessonId={completeLessonId}
          onClose={() => setOpen(false)}
          onSaved={() => undefined}
        />
      ) : null}
    </div>
  );
}
