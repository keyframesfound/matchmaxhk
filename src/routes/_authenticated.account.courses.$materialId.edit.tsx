import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { useAuth } from "@/features/auth/useAuth";
import { CourseEditorForm } from "@/features/courses/course-editor";

/**
 * #392: edit a draft/pending/rejected Video / General Course. Lessons
 * upsert on position so uploaded PDFs survive re-saves.
 */

export const Route = createFileRoute("/_authenticated/account/courses/$materialId/edit")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Edit course | MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: EditCoursePage,
});

function EditCoursePage() {
  const { materialId } = Route.useParams() as { materialId: string };
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-normal">{t("shop.form.course_edit_title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("shop.form.course_edit_subtitle")}</p>
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 sm:p-8">
          {user ? (
            <CourseEditorForm courseId={materialId} />
          ) : (
            <p className="text-sm text-muted-foreground">{t("orders.sign_in_required")}</p>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
