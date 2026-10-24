import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { useAuth } from "@/features/auth/useAuth";
import { CourseEditorForm } from "@/features/courses/course-editor";

/**
 * #392: new Video / General Course, everything is optional until submit;
 * a draft with only a title survives the day (mirrors /account/notes/new).
 */

export const Route = createFileRoute("/_authenticated/account/courses/new")({
  ssr: false,
  head: () => ({
    meta: [{ title: "New course | MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: NewCoursePage,
});

function NewCoursePage() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-medium tracking-normal">{t("shop.form.course_new_title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("shop.form.course_new_subtitle")}</p>
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 sm:p-8">
          {loading || !user ? (
            <p className="text-sm text-muted-foreground">{t("orders.sign_in_required")}</p>
          ) : (
            <CourseEditorForm />
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
