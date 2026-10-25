import { FilePlus2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { SettingsCard } from "@/features/settings/option-card";

/**
 * Issues #131/#133: the tutor-facing "Study Materials" settings tab.
 * Since the P8 (#288) notes rollout, the canonical tutor flow is
 * /account/notes/new, this tab points there instead of running a second
 * upload path with different rules (#313 review fix: no upload path may
 * skip the note-kind validation).
 */
export function StudyMaterialsSection() {
  const { t } = useTranslation();

  return (
    <SettingsCard
      title={t("materials.upload_title")}
      description={t("materials.redirect_description")}
    >
      <Button asChild className="w-full font-bold">
        <Link to="/account/notes/new">
          <FilePlus2 className="mr-2 h-4 w-4" aria-hidden />
          {t("notes.form.new_title")}
        </Link>
      </Button>
    </SettingsCard>
  );
}
