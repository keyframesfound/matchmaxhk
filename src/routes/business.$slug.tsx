import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Building2,
  CalendarDays,
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
import {
  courseModeLabel,
  fetchCoursesByOrganizationId,
  fetchOrganizationBySlug,
  formatCoursePrice,
} from "@/features/courses/queries";

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

function ListingCard({
  course,
}: {
  course: Awaited<ReturnType<typeof fetchCoursesByOrganizationId>>[number];
}) {
  const price = formatCoursePrice(course.price, course.currency);
  return (
    <a
      href={`/courses/${course.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {course.image_url ? (
          <img
            src={course.image_url}
            alt={course.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground/40">
            <BookOpen className="h-10 w-10" />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        {price ? (
          <p className="text-base font-black text-[color:var(--ink)]">{price}</p>
        ) : (
          <p className="text-sm font-semibold text-muted-foreground">Enquire for pricing</p>
        )}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[color:var(--ink)] group-hover:text-[color:var(--brand-link)]">
          {course.title}
        </h3>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          {course.level ? (
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-400/20">
              {course.level}
            </span>
          ) : null}
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {courseModeLabel(course.mode)}
          </span>
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          {course.district ? (
            <>
              <MapPin className="h-3 w-3" />
              {course.district}
            </>
          ) : (
            <>Hong Kong</>
          )}
        </p>
      </div>
    </a>
  );
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
  const isPreview = !!org && org.status !== "active";
  const memberSince = org
    ? new Date(org.created_at).toLocaleDateString("en-HK", { month: "long", year: "numeric" })
    : null;
  const courseCount = courses?.length ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <SiteHeader />
      <main className="flex-1">
        {orgLoading && (
          <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <Skeleton className="h-40 w-full rounded-none sm:h-52" />
              <div className="px-6 pb-6">
                <Skeleton className="-mt-10 h-24 w-24 rounded-full ring-4 ring-card" />
                <Skeleton className="mt-4 h-8 w-64" />
                <Skeleton className="mt-2 h-4 w-96" />
              </div>
            </div>
          </div>
        )}

        {!orgLoading && (isError || !org) && (
          <div className="mx-auto max-w-lg px-4 py-16">
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
        )}

        {org && (
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
            <Link
              to="/courses"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--brand-link)]"
            >
              <ArrowLeft className="h-4 w-4" />
              All courses
            </Link>

            {isPreview && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                <p className="font-semibold">Pending activation</p>
                <p className="mt-0.5 text-amber-700/80 dark:text-amber-400/80">
                  You're previewing your public profile. It becomes visible to everyone once your
                  account is activated by the MatchMax team.
                </p>
              </div>
            )}

            {/* Header card — LinkedIn style */}
            <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="relative h-36 w-full sm:h-52">
                {org.cover_image_url ? (
                  <img src={org.cover_image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-r from-[#1FA8B6] via-[#2bbfcc] to-[#77E8EE]" />
                )}
              </div>
              <div className="px-5 pb-6 sm:px-8">
                <div className="-mt-12 flex items-end justify-between gap-4 sm:-mt-14">
                  {org.logo_url ? (
                    <img
                      src={org.logo_url}
                      alt=""
                      className="h-24 w-24 rounded-full border-4 border-card object-cover shadow-md sm:h-28 sm:w-28"
                    />
                  ) : (
                    <span className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-card bg-[#1FA8B6] text-2xl font-bold text-white shadow-md sm:h-28 sm:w-28">
                      {initials || "MM"}
                    </span>
                  )}
                  <div className="hidden shrink-0 items-center gap-2 pb-1 sm:flex">
                    {whatsappUrl && (
                      <Button
                        asChild
                        className="bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
                      >
                        <a href={whatsappUrl} target="_blank" rel="noreferrer">
                          <MessageCircle className="mr-2 h-4 w-4" />
                          WhatsApp
                        </a>
                      </Button>
                    )}
                    {org.contact_email && (
                      <Button asChild variant="outline">
                        <a href={`mailto:${org.contact_email}`}>
                          <Mail className="mr-2 h-4 w-4" />
                          Email
                        </a>
                      </Button>
                    )}
                    {org.website_url && (
                      <Button asChild variant="ghost">
                        <a href={org.website_url} target="_blank" rel="noreferrer">
                          <Globe className="mr-2 h-4 w-4" />
                          Website
                        </a>
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <h1 className="flex flex-wrap items-center gap-2 text-2xl font-black tracking-tight text-[color:var(--ink)] sm:text-3xl">
                    {org.name}
                    <BadgeCheck
                      className="h-6 w-6 shrink-0 text-[#1FA8B6]"
                      aria-label="Verified business"
                    />
                  </h1>
                  {org.tagline ? (
                    <p className="mt-1.5 max-w-2xl text-[15px] font-medium text-muted-foreground">
                      {org.tagline}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                    {org.district ? (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" />
                        {org.district}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4" />
                      {coursesLoading ? "…" : courseCount}{" "}
                      {courseCount === 1 ? "course" : "courses"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4" />
                      Member since {memberSince}
                    </span>
                  </div>
                </div>

                {/* Mobile action buttons */}
                <div className="mt-4 flex flex-wrap gap-2 sm:hidden">
                  {whatsappUrl && (
                    <Button
                      asChild
                      size="sm"
                      className="flex-1 bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
                    >
                      <a href={whatsappUrl} target="_blank" rel="noreferrer">
                        <MessageCircle className="mr-2 h-4 w-4" />
                        WhatsApp
                      </a>
                    </Button>
                  )}
                  {org.contact_email && (
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <a href={`mailto:${org.contact_email}`}>Email</a>
                    </Button>
                  )}
                  {org.website_url && (
                    <Button asChild variant="ghost" size="sm" className="flex-1">
                      <a href={org.website_url} target="_blank" rel="noreferrer">
                        Website
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </section>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
              {/* Main column */}
              <div className="min-w-0 space-y-6">
                {/* Courses — Carousell style listing grid */}
                <section>
                  <h2 className="text-lg font-black tracking-tight text-[color:var(--ink)]">
                    Courses
                  </h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {coursesLoading && (
                      <>
                        <Skeleton className="h-64 rounded-xl" />
                        <Skeleton className="h-64 rounded-xl" />
                      </>
                    )}
                    {!coursesLoading && courseCount === 0 && (
                      <div className="sm:col-span-2">
                        <EmptyState
                          icon={BookOpen}
                          title="No courses listed yet"
                          description="This business hasn't published any courses — check back soon."
                          secondaryAction={
                            <Button variant="outline" asChild>
                              <Link to="/courses">Browse other courses</Link>
                            </Button>
                          }
                        />
                      </div>
                    )}
                    {(courses ?? []).map((course) => (
                      <ListingCard key={course.id} course={course} />
                    ))}
                  </div>
                </section>

                {/* About */}
                <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="text-lg font-black tracking-tight text-[color:var(--ink)]">
                    About
                  </h2>
                  <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground">
                    {org.description ? (
                      org.description
                        .split(/\n{2,}/)
                        .map((paragraph, i) => <p key={i}>{paragraph}</p>)
                    ) : (
                      <p>This business hasn't added a description yet.</p>
                    )}
                  </div>
                </section>
              </div>

              {/* Sidebar */}
              <aside>
                <div className="sticky top-24 space-y-4">
                  <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                    <h3 className="text-base font-black tracking-tight text-[color:var(--ink)]">
                      Get in touch
                    </h3>
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
                      {!org.website_url && !org.contact_email && !org.contact_phone && (
                        <p className="text-muted-foreground">Contact details coming soon.</p>
                      )}
                    </div>

                    {whatsappUrl && (
                      <Button
                        asChild
                        className="mt-5 h-11 w-full bg-[#25D366] font-bold text-white hover:bg-[#1fb857]"
                      >
                        <a href={whatsappUrl} target="_blank" rel="noreferrer">
                          <MessageCircle className="mr-2 h-4 w-4" />
                          WhatsApp enquiry
                        </a>
                      </Button>
                    )}
                  </div>

                  <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Listed on
                    </p>
                    <p className="mt-1.5 text-sm font-bold text-[color:var(--ink)]">
                      MatchMax Hong Kong
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Verified tutoring businesses & education centres
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
