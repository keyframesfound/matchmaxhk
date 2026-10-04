import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

import { fetchMaterialsForTutor, type StudyMaterial } from "@/features/materials/queries";
import { StudyMaterialCard } from "@/features/materials/material-card";
import { buildBookLessonsWhatsAppUrl, buildBuyWhatsAppUrl } from "@/features/materials/whatsapp";

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
            actions={{
              buyHref: buildBuyWhatsAppUrl(whatsappNumber, material, tutorName),
              bookHref,
            }}
          />
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{t("materials.disclaimer")}</p>
    </div>
  );
}

export type { StudyMaterial };
