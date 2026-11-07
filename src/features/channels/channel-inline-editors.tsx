import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/features/auth/useAuth";
import { EducationCvSection } from "@/features/account/education-cv-section";
import { AvailabilitySection } from "@/features/settings/sections/availability-section";
import { MyTutorProfileSection } from "@/features/settings/sections/my-tutor-profile-section";
import { TutorGradesEditor } from "@/features/settings/sections/tutor-grades-editor";

export const CHANNEL_EDITORS = ["profile", "availability", "cv", "blue_tick"] as const;
export type ChannelEditor = (typeof CHANNEL_EDITORS)[number];

/**
 * #576 Stage 3: every rich section edits inline from the owner's channel, in a
 * sheet over the existing editors, so nobody returns to /join. Locked verified
 * fields keep routing through the #284 credential queue inside those editors,
 * and Blue Tick evidence stays staff-only.
 */
export function ChannelInlineEditors({
  hasTutorCard,
  initial,
}: {
  hasTutorCard: boolean;
  initial?: ChannelEditor;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState<ChannelEditor | null>(initial ?? null);
  const editors = hasTutorCard ? CHANNEL_EDITORS : (["cv"] as const);
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-[color:var(--ink)]">
        {t("channel.inline_edit_title")}
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {editors.map((editor) => (
          <Button
            key={editor}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(editor)}
          >
            {t(`channel.inline_edit_${editor}`)}
          </Button>
        ))}
      </div>
      <Sheet open={open !== null} onOpenChange={(next) => (next ? undefined : setOpen(null))}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>{open ? t(`channel.inline_edit_${open}`) : ""}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {open === "profile" ? <MyTutorProfileSection /> : null}
            {open === "availability" ? <AvailabilitySection /> : null}
            {open === "blue_tick" ? <TutorGradesEditor /> : null}
            {open === "cv" ? (
              <EducationCvSection childProfileId={null} learnerName={user?.email ?? ""} />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
