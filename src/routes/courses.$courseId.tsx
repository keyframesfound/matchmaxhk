import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Clock,
  GraduationCap,
  Mail,
  MapPin,
  MessageCircle,
  Tag,
} from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SocialLinks } from "@/components/business/social-links";
import { CourseLevelBadge } from "@/features/courses/course-card";
import { CourseSaveButton } from "@/features/courses/saved-courses";
import { useBusinessTracker } from "@/features/business/use-analytics";
import {
  fetchCourseById,
  fetchCoursesByOrganizationId,
  fetchOrganizationCourseCount,
  courseModeLabel,
  formatCoursePrice,
} from "@/features/courses/queries";
import type { CourseWithOrganization } from "@/features/courses/queries";
import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";

export const Route = createFileRoute("/courses/$courseId")({
  beforeLoad: () => {
    if (!CENTRE_MARKET_ENABLED) throw notFound();
  },
  head: () => ({
    meta: [{ title: "Course | MatchMax" }, { name: "robots", content: "index, follow" }],
  }),
  component: CourseDetail,
});

function buildWhatsAppUrl(number: string | null, courseTitle: string): string {
  const digits = (number ?? "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  const message = encodeURIComponent(
    `Hi MatchMax, I'd like to enquire about the course "${courseTitle}".`,
  );
  return `https://wa.me/${digits}?text=${message}`;
}

function BusinessProfileCard({
  organization,
}: {
  organization: NonNullable<CourseWithOrganization["organization"]>;
}) {
  const { data: courseCount = 0, isLoading: countLoading } = useQuery({
    queryKey: ["organization-course-count", organization.id],
    queryFn: () => fetchOrganizationCourseCount(organization.id),
    staleTime: 60_000,
  });

  const memberSince = new Date(organization.created_at).getFullYear();

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col items-center gap-3 text-center">
        {organization.logo_url ? (
          <img
            src={organization.logo_url}
            alt=""
            className="size-16 shrink-0 rounded-full border border-border object-cover"
          />
        ) : (
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full border border-border bg-[color:var(--foreground)]/[0.06] text-[color:var(--foreground)]">
            {organization.name.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="flex flex-col items-center gap-1">
          <h3 className="flex items-center gap-1.5 text-base font-bold tracking-tight text-[color:var(--ink)]">
            <span className="max-w-[220px] truncate">{organization.name}</span>
            <BadgeCheck
              className="h-4.5 w-4.5 shrink-0 text-[color:var(--muted-foreground)]"
              aria-label="Verified business"
            />
          </h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {organization.tagline || organization.district || "MatchMax partner"}
          </p>
          <SocialLinks
            className="mt-1 justify-center"
            urls={{
              youtube: organization.youtube_url,
              linkedin: organization.linkedin_url,
              x: organization.x_url,
              rednote: organization.rednote_url,
              instagram: organization.instagram_url,
              facebook: organization.facebook_url,
            }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 divide-x divide-border border-y border-border">
        <div className="flex flex-col items-center gap-0.5 py-3">
          <span className="text-sm font-semibold tabular-nums text-[color:var(--ink)]">
            {countLoading ? "…" : courseCount}
          </span>
          <span className="text-xs text-muted-foreground">Courses</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-2 py-3">
          <span className="max-w-full truncate text-sm font-semibold text-[color:var(--ink)]">
            {organization.district || "—"}
          </span>
          <span className="text-xs text-muted-foreground">District</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 py-3">
          <span className="text-sm font-semibold tabular-nums text-[color:var(--ink)]">
            {memberSince}
          </span>
          <span className="text-xs text-muted-foreground">Member since</span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button asChild className="flex-1 font-bold">
          <a href={`/business/${organization.slug}`}>
            View profile
            <ArrowUpRight className="ml-1 h-4 w-4" aria-hidden />
          </a>
        </Button>
        {organization.website_url ? (
          <Button asChild variant="outline" className="flex-1">
            <a href={organization.website_url} target="_blank" rel="noreferrer">
              Website
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function MoreFromCentre({ orgId, currentCourseId }: { orgId: string; currentCourseId: string }) {
  const { data: courses, isLoading } = useQuery({
    queryKey: ["organization-more-courses", orgId],
    queryFn: () => fetchCoursesByOrganizationId(orgId, 20),
    staleTime: 60_000,
  });

  const others = (courses ?? []).filter((course) => course.id !== currentCourseId).slice(0, 6);
  if (isLoading || others.length === 0) return null;

  return (
    <section className="mt-10 border-t border-border pt-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[color:var(--ink)]">More from this centre</h2>
        <a
          href={`/courses`}
          className="text-sm font-semibold text-[color:var(--brand-link)] hover:underline"
        >
          View all
        </a>
      </div>
      <div className="mt-4 -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {others.map((course) => {
          const coursePrice = formatCoursePrice(course.price, course.currency);
          return (
            <a
              key={course.id}
              href={`/courses/${course.id}`}
              className="group w-56 shrink-0 snap-start overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="aspect-[16/10] w-full overflow-hidden bg-muted">
                {course.image_url ? (
                  <img
                    src={course.image_url}
                    alt={course.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                    <BookOpen className="h-8 w-8" />
                  </span>
                )}
              </div>
              <div className="p-3">
                {coursePrice ? (
                  <p className="text-sm font-black text-[color:var(--ink)]">{coursePrice}</p>
                ) : (
                  <p className="text-xs font-semibold text-muted-foreground">Enquire for pricing</p>
                )}
                <p className="mt-1 line-clamp-2 text-sm font-medium text-[color:var(--ink)] group-hover:text-[color:var(--brand-link)]">
                  {course.title}
                </p>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function CourseDetail() {
  const { courseId } = Route.useParams();
  const track = useBusinessTracker();
  const {
    data: course,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => fetchCourseById(courseId),
    retry: false,
  });

  useEffect(() => {
    if (course) {
      track([{ organizationId: course.organization_id, type: "course_view", courseId: course.id }]);
    }
  }, [course, track]);

  const price = course ? formatCoursePrice(course.price, course.currency) : null;
  const whatsappUrl = course
    ? buildWhatsAppUrl(course.organization?.whatsapp_number ?? null, course.title)
    : "";
  const contactEmail = course?.organization?.contact_email ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="hero-startup-bg border-b border-border py-10">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <Link
              to="/courses"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--brand-link)]"
            >
              <ArrowLeft className="h-4 w-4" />
              All courses
            </Link>

            {isLoading && (
              <div className="mt-6 space-y-4">
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-64 w-full rounded-lg" />
              </div>
            )}

            {isError || (course === null && !isLoading) ? (
              <div className="mt-6 rounded-sm border border-dashed border-border bg-card p-12 text-center">
                <p className="text-lg font-bold text-[color:var(--ink)]">Course not available</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  This course may have been removed or is not currently published.
                </p>
                <Button asChild className="mt-6">
                  <Link to="/courses">Browse courses</Link>
                </Button>
              </div>
            ) : null}

            {course && (
              <div className="mt-6">
                <div className="flex flex-wrap items-center gap-2">
                  <CourseLevelBadge level={course.level} />
                  {course.subject ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                      <Tag className="h-3.5 w-3.5" />
                      {course.subject}
                    </span>
                  ) : null}
                </div>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-[color:var(--ink)] sm:text-4xl">
                  {course.title}
                </h1>
                {course.summary ? (
                  <p className="mt-3 max-w-3xl text-base text-muted-foreground sm:text-lg">
                    {course.summary}
                  </p>
                ) : null}
                <div className="mt-4">
                  <CourseSaveButton courseId={course.id} />
                </div>
              </div>
            )}
          </div>
        </section>

        {course && (
          <section className="py-10">
            <div className="mx-auto grid max-w-5xl gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
              <div>
                {course.image_url ? (
                  <img
                    src={course.image_url}
                    alt={course.title}
                    className="mb-8 aspect-[16/9] w-full rounded-lg border border-border object-cover"
                  />
                ) : null}

                <h2 className="text-xl font-bold text-[color:var(--ink)]">About this course</h2>
                <div className="mt-4 max-w-3xl space-y-4 text-[15px] leading-relaxed text-muted-foreground">
                  {course.description ? (
                    course.description
                      .split(/\n{2,}/)
                      .map((paragraph, i) => <p key={i}>{paragraph}</p>)
                  ) : (
                    <p>No description provided yet. Enquire below for details.</p>
                  )}
                </div>

                <dl className="mt-8 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-card p-4">
                    <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Lesson mode
                    </dt>
                    <dd className="mt-1.5 text-sm font-semibold text-[color:var(--ink)]">
                      {courseModeLabel(course.mode)}
                    </dd>
                  </div>
                  {course.schedule_text ? (
                    <div className="rounded-lg border border-border bg-card p-4">
                      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <CalendarDays className="h-4 w-4" />
                        Schedule
                      </dt>
                      <dd className="mt-1.5 text-sm font-semibold text-[color:var(--ink)]">
                        {course.schedule_text}
                      </dd>
                    </div>
                  ) : null}
                  {course.district ? (
                    <div className="rounded-lg border border-border bg-card p-4">
                      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        Location
                      </dt>
                      <dd className="mt-1.5 text-sm font-semibold text-[color:var(--ink)]">
                        {course.district}
                      </dd>
                    </div>
                  ) : null}
                  {course.subject ? (
                    <div className="rounded-lg border border-border bg-card p-4">
                      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <GraduationCap className="h-4 w-4" />
                        Subject
                      </dt>
                      <dd className="mt-1.5 text-sm font-semibold text-[color:var(--ink)]">
                        {course.subject}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {course.organization?.id ? (
                  <MoreFromCentre orgId={course.organization.id} currentCourseId={course.id} />
                ) : null}
              </div>

              <aside>
                <div className="sticky top-24 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Offered by
                  </p>
                  {course.organization ? (
                    <BusinessProfileCard organization={course.organization} />
                  ) : null}

                  <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                    {price ? (
                      <p className="text-2xl font-black text-[color:var(--ink)]">{price}</p>
                    ) : null}

                    <div className={price ? "mt-5 flex flex-col gap-3" : "flex flex-col gap-3"}>
                      {whatsappUrl ? (
                        <Button
                          asChild
                          prefix={<MessageCircle />}
                          variant="solid"
                          color="blue"
                          className="h-11 font-bold"
                        >
                          <a href={whatsappUrl} target="_blank" rel="noreferrer">
                            Chat on WhatsApp
                          </a>
                        </Button>
                      ) : null}
                      {contactEmail ? (
                        <Button asChild variant="outline" prefix={<Mail />} className="h-11">
                          <a
                            href={`mailto:${contactEmail}?subject=${encodeURIComponent(`Course enquiry: ${course.title}`)}`}
                          >
                            Email enquiry
                          </a>
                        </Button>
                      ) : null}
                      {!whatsappUrl && !contactEmail && (
                        <div className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                          Contact details will be available soon.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
