import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { useAuth } from "@/features/auth/useAuth";
import { RostersPanel } from "@/features/rosters/rosters-section";

/**
 * #613 §4.1 — Rosters & Attendance (點名及學生名單), the educator surface for
 * tutors and centre admins. Search params are TOTAL (preprocessed to strings,
 * unknown values dropped) so crafted URLs cannot 500 a cold SSR load.
 */
export const Route = createFileRoute("/_authenticated/account/rosters")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { roster?: string; course?: string; create?: string } => {
    const asString = (value: unknown, max: number): string | undefined =>
      typeof value === "string" && value.length >= 1 && value.length <= max ? value : undefined;
    const roster = asString(search.roster, 64);
    const course = asString(search.course, 64);
    const create = search.create === "1" ? "1" : undefined;
    return {
      ...(roster ? { roster } : {}),
      ...(course ? { course } : {}),
      ...(create ? { create } : {}),
    };
  },
  ssr: false,
  head: () => ({
    meta: [{ title: "Rosters & Attendance | MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: RostersPage,
});

function RostersPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-[color:var(--background)]">
        <SiteHeader />
        <PageContainer>
          <div className="mx-auto max-w-lg py-16 text-center text-sm text-muted-foreground">
            Sign-in required.
          </div>
        </PageContainer>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <SiteHeader />
      <PageContainer>
        <div className="mx-auto max-w-4xl py-8">
          <RostersPanel
            prefillCourseId={search.course}
            autoCreate={search.create === "1"}
            selectedRosterId={search.roster}
            onSelectRoster={(rosterId) => {
              // Keep the URL shareable; drop the create/course prefill once
              // the roster exists.
              navigate({
                to: "/account/rosters",
                search: rosterId ? { roster: rosterId } : {},
              });
            }}
          />
        </div>
      </PageContainer>
      <SiteFooter />
    </div>
  );
}
