import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";
import { PublicTutorCard } from "@/features/tutors/public-tutor-card";
import { TutorSaveButton, fetchSavedTutors } from "@/features/tutors/saved-tutors";
import { buildTutorWhatsAppUrl } from "@/features/tutors/tutor-display";

export const Route = createFileRoute("/_authenticated/saved-posts")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Saved Posts | MatchMax" },
      { name: "description", content: "Your saved MatchMax tutors." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SavedPostsPage,
});

function SavedPostsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const savedTutorsQuery = useQuery({
    queryKey: ["saved-posts", user?.id],
    queryFn: () => fetchSavedTutors(user!.id),
    enabled: Boolean(user),
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-[color:var(--brand-teal)]">
                Your collection
              </p>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">
                Saved Posts
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Keep a shortlist of tutors you would like to come back to.
              </p>
            </div>
            <Button variant="outline" onClick={() => void navigate({ to: "/tutors" })}>
              Find tutors
            </Button>
          </div>

          {savedTutorsQuery.isLoading ? (
            <div className="mt-10 text-sm text-muted-foreground">Loading saved tutors...</div>
          ) : savedTutorsQuery.isError ? (
            <div className="mt-10 rounded-sm border border-dashed border-border bg-card p-12 text-center">
              <p className="text-lg font-bold text-[color:var(--brand-navy)]">
                We couldn't load your saved tutors
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Please refresh the page and try again.
              </p>
            </div>
          ) : savedTutorsQuery.data?.length === 0 ? (
            <div className="mt-10 rounded-sm border border-dashed border-border bg-card p-12 text-center">
              <Bookmark
                className="mx-auto h-8 w-8 text-[color:var(--brand-teal)]"
                aria-hidden="true"
              />
              <p className="mt-4 text-lg font-bold text-[color:var(--brand-navy)]">
                You haven't saved any tutors yet
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Browse the tutor directory and bookmark the profiles you want to revisit.
              </p>
            </div>
          ) : (
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {savedTutorsQuery.data?.map((tutor) => (
                <PublicTutorCard
                  key={tutor.id}
                  tutor={tutor}
                  priceSuffix="/hr"
                  onOpen={(code) =>
                    void navigate({ to: "/tutors/$tutorCode", params: { tutorCode: code } })
                  }
                  saveAction={<TutorSaveButton tutorId={tutor.id} />}
                  footerAction={
                    <Button
                      asChild
                      className="h-9 rounded-sm bg-[#0A245F] px-4 text-[13px] font-bold text-white hover:bg-[#081d4f]"
                    >
                      <a
                        href={buildTutorWhatsAppUrl("", tutor.tutor_code)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Request tutor
                      </a>
                    </Button>
                  }
                />
              ))}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
