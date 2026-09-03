import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  Building2,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/business/empty-state";
import { CourseCard } from "@/features/courses/course-card";
import { fetchCoursesByOrganizationId, fetchOrganizationBySlug } from "@/features/courses/queries";

export const Route = createFileRoute("/business/$slug")({
  head: () => ({
    meta: [{ title: "Business profile | MatchMax" }, { name: "robots", content: "index, follow" }],
  }),
  component: BusinessPublicProfile,
});

function buildWhatsAppUrl(number: string | null, orgName: string): string {
  const digits = (number ?? "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  const message = encodeURIComponent(
    `Hi MatchMax, I'd like to enquire about courses offered by ${orgName}.`,
  );
  return `https://wa.me/${digits}?text=${message}`;
}

function BusinessPublicProfile() {
  const { slug } = Route.useParams();

  const {
    data: org,
    isLoading: orgLoading,
    isError,
  } = useQuery({
    queryKey: ["organization-profile", slug],
    queryFn: () => fetchOrganizationBySlug(slug),
    retry: false,
  });

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ["organization-profile-courses", org?.id],
    queryFn: () => fetchCoursesByOrganizationId(org!.id),
    enabled: !!org,
  });

  const initials = (org?.name ?? "")
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
  const whatsappUrl = org ? buildWhatsAppUrl(org.whatsapp_number, org.name) : "";
  const isLoading = orgLoading;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        {isLoading && (
          <section className="hero-startup-bg border-b border-border py-12">
            <div className="mx-auto max-w-5xl px-4 sm:px-6">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="mt-4 h-5 w-96" />
            </div>
          </section>
        )}

        {!isLoading && (isError || !org) && (
          <section className="py-16">
            <div className="mx-auto max-w-lg px-4">
              <EmptyState
                icon={Building2}
                title="Business profile not available"
                description="This business profile doesn't exist or isn't active on MatchMax yet."
                action={
                  <Button asChild>
                    <Link to="/courses">Browse courses</Link>
                  </Button>
                }
              />
            </div>
          </section>
        )}

        {org && (
          <>
            <section className="hero-startup-bg border-b border-border py-10">
              <div className="mx-auto max-w-5xl px-4 sm:px-6">
                <Link
                  to="/courses"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--brand-link)]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  All courses
                </Link>

                {org.cover_image_url && (
                  <img
                    src={org.cover_image_url}
                    alt=""
                    className="mt-5 aspect-[21/9] w-full rounded-lg border border-border object-cover"
                  />
                )}

                <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start">
                  {org.logo_url ? (
                    <img
                      src={org.logo_url}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-xl border border-border object-cover"
                    />
                  ) : (
                    <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[#1FA8B6]/10 text-xl font-bold text-[#1FA8B6]">
                      {initials || "MM"}
                    </span>
                  )}
                  <div className="min-w-0">
                    <h1 className="text-3xl font-black tracking-tight text-[color:var(--ink)] sm:text-4xl">
                      {org.name}
                    </h1>
                    {org.tagline ? (
                      <p className="mt-2 max-w-2xl text-base text-muted-foreground sm:text-lg">
                        {org.tagline}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-700/10">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Verified business on MatchMax
                      </span>
                      {org.district ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-4 w-4" />
                          {org.district}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1.5">
                        <BookOpen className="h-4 w-4" />
                        {coursesLoading ? "…" : (courses?.length ?? 0)}{" "}
                        {(courses?.length ?? 0) === 1 ? "course" : "courses"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="py-10">
              <div className="mx-auto grid max-w-5xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.6fr_1fr]">
                <div>
                  <h2 className="text-xl font-bold text-[color:var(--ink)]">About</h2>
                  <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
                    {org.description ? (
                      org.description
                        .split(/\n{2,}/)
                        .map((paragraph, i) => <p key={i}>{paragraph}</p>)
                    ) : (
                      <p>This business hasn't added a description yet.</p>
                    )}
                  </div>

                  <h2 className="mt-10 text-xl font-bold text-[color:var(--ink)]">
                    Courses by {org.name}
                  </h2>
                  <div className="mt-5 flex flex-col gap-4">
                    {coursesLoading && (
                      <>
                        <Skeleton className="h-32 rounded-lg border border-border" />
                        <Skeleton className="h-32 rounded-lg border border-border" />
                      </>
                    )}
                    {!coursesLoading && (courses ?? []).length === 0 && (
                      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                        No published courses yet — check back soon.
                      </div>
                    )}
                    {(courses ?? []).map((course) => (
                      <CourseCard key={course.id} course={course} />
                    ))}
                  </div>
                </div>

                <aside>
                  <div className="sticky top-24 rounded-lg border border-border bg-card p-6 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Get in touch
                    </p>
                    <div className="mt-4 flex flex-col gap-3 text-sm">
                      {org.website_url && (
                        <a
                          href={org.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2.5 font-medium text-[color:var(--brand-link)] hover:underline"
                        >
                          <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">Visit website</span>
                        </a>
                      )}
                      {org.contact_email && (
                        <a
                          href={`mailto:${org.contact_email}`}
                          className="inline-flex items-center gap-2.5 font-medium text-[color:var(--ink)] hover:text-[color:var(--brand-link)]"
                        >
                          <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{org.contact_email}</span>
                        </a>
                      )}
                      {org.contact_phone && (
                        <a
                          href={`tel:${org.contact_phone}`}
                          className="inline-flex items-center gap-2.5 font-medium text-[color:var(--ink)] hover:text-[color:var(--brand-link)]"
                        >
                          <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                          {org.contact_phone}
                        </a>
                      )}
                      {org.district && (
                        <span className="inline-flex items-center gap-2.5 text-muted-foreground">
                          <MapPin className="h-4 w-4 shrink-0" />
                          {org.district}
                        </span>
                      )}
                    </div>

                    {whatsappUrl && (
                      <Button
                        asChild
                        className="mt-5 h-11 w-full bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
                      >
                        <a href={whatsappUrl} target="_blank" rel="noreferrer">
                          <MessageCircle className="mr-2 h-4 w-4" />
                          WhatsApp enquiry
                        </a>
                      </Button>
                    )}
                    {!whatsappUrl && !org.contact_email && !org.contact_phone && (
                      <p className="mt-5 text-sm text-muted-foreground">
                        Contact details coming soon.
                      </p>
                    )}
                  </div>
                </aside>
              </div>
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
