import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { optionACopyKey } from "@/features/materials/marketplace-policy";

import { fetchMaterialsForTutor, type StudyMaterial } from "@/features/materials/queries";
import { StudyMaterialCard } from "@/features/materials/material-card";
import {
  fetchMaterialPublicCounts,
  type MaterialPublicCounts,
} from "@/features/materials/material-social-proof-stats";
import { buildBookLessonsWhatsAppUrl, buildBuyWhatsAppUrl } from "@/features/materials/whatsapp";
import { InlineReportLink } from "@/features/reports/report-button";

/**
 * Issues #131/#134: "📚 Study Materials & Past Papers" section on the public
 * tutor profile. Hidden entirely when the tutor has no published listings —
 * no empty state on profiles without materials (the directory carries the
 * empty state instead). Book-lessons routes to the SAME concierge WhatsApp
 * as Buy Now with a lessons-flavoured message (Ryan, 2026-10-04).
 */
export function TutorMaterialsSection({
  tutorId,
  tutorName,
  tutorCode,
  whatsappNumber,
}: {
  tutorId: string;
  tutorName: string;
  tutorCode: string;
  whatsappNumber: string | undefined;
}) {
  const { t } = useTranslation();
  const { data: materials = [] } = useQuery({
    queryKey: ["tutor", "materials", tutorId],
    queryFn: () => fetchMaterialsForTutor(tutorId),
  });
  // #768 AC #4: one aggregate call covers this tutor's listing cards.
  const materialIds = materials.slice(0, 60).map((material) => material.id);
  const countsQuery = useQuery({
    queryKey: ["materials", "public-counts", materialIds.join(",")],
    queryFn: () => fetchMaterialPublicCounts(materialIds),
    enabled: materialIds.length > 0,
    staleTime: 5 * 60_000,
  });
  const publicCounts = countsQuery.data ?? new Map<string, MaterialPublicCounts>();

  if (materials.length === 0) return null;

  const bookHref = buildBookLessonsWhatsAppUrl(whatsappNumber, tutorName, tutorCode);

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {materials.map((material) => (
          <StudyMaterialCard
            key={material.id}
            material={material}
            tutorName={tutorName}
            tutorCode={tutorCode}
            socialProof={publicCounts.get(material.id) ?? null}
            actions={{
              buyHref: buildBuyWhatsAppUrl(whatsappNumber, material, tutorName),
              bookHref,
              // Issue #216: report the note (copyright, fraud, …).
              reportAction: (
                <InlineReportLink
                  targetType="material"
                  targetId={material.id}
                  label={material.title}
                />
              ),
            }}
          />
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t(optionACopyKey("materials.disclaimer"))}
      </p>
    </div>
  );
}

export type { StudyMaterial };
