import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Building2,
  CalendarDays,
  Camera,
  Contact,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Share2,
} from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/business/empty-state";
import { BackToTop } from "@/components/business/back-to-top";
import { CourseCalendar } from "@/components/business/course-calendar";
import { SocialLinks } from "@/components/business/social-links";
import {
  OrgAboutDialog,
  OrgContactDialog,
  OrgIdentityDialog,
  normalizeFaq,
} from "@/features/business/organization-edit-dialogs";
import {
  fetchOrganizationSeoMeta,
  getOrganizationRoleForSlug,
  updateOrganization,
  uploadOrganizationImage,
} from "@/features/business/business.functions";
import { useAuth } from "@/features/auth/useAuth";
import { useBusinessTracker } from "@/features/business/use-analytics";
import {
  courseModeLabel,
  fetchCoursesByOrganizationId,
  fetchOrganizationBySlug,
  formatCoursePrice,
  type OrganizationPublic,
} from "@/features/courses/queries";
import { downloadVCard } from "@/lib/vcard";
import type { SocialUrls } from "@/components/business/social-links";
import { YouTubePlayer } from "@/components/business/youtube-player";
import { parseYouTubeUrl } from "@/lib/youtube";
import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";

type OrganizationSeoMeta = {
  name: string;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
} | null;

export const Route = createFileRoute("/business/$slug")({
  beforeLoad: () => {
    if (!CENTRE_MARKET_ENABLED) throw notFound();
  },
  loader: async ({ params }): Promise<OrganizationSeoMeta> => {
    try {
      return (await fetchOrganizationSeoMeta({
        data: { slug: params.slug },
      })) as OrganizationSeoMeta;
    } catch {
      return null;
    }
  },
  head: ({ match }) => {
    const meta = (match.loaderData ?? null) as OrganizationSeoMeta;
    const title = meta ? `${meta.name} | MatchMax` : "Business profile | MatchMax";
    const description = (
      meta?.tagline ||
      meta?.description ||
      "Discover courses from trusted Hong Kong learning centres on MatchMax."
    ).slice(0, 200);
    const image = meta?.logo_url || meta?.cover_image_url || undefined;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "index, follow" },
        { property: "og:type", content: "profile" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        ...(image ? [{ property: "og:image", content: image }] : []),
      ],
    };
  },
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
          <p className="text-base font-bold text-[color:var(--ink)]">{price}</p>
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const roleFn = useServerFn(getOrganizationRoleForSlug);
  const updateOrgFn = useServerFn(updateOrganization);
  const uploadImageFn = useServerFn(uploadOrganizationImage);
  const track = useBusinessTracker();

  const [identityOpen, setIdentityOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<"logo" | "cover" | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

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

  const { data: roleData } = useQuery({
    queryKey: ["my-org-role", slug, user?.id ?? null],
    queryFn: () => roleFn({ data: { slug } }) as Promise<{ role: "owner" | "admin" | null }>,
    enabled: !!user && !!slug,
  });
  const isOwner = !!user && !!roleData?.role;

  useEffect(() => {
    if (org) {
      document.title = `${org.name} | MatchMax`;
      track([{ organizationId: org.id, type: "profile_view" }]);
    }
  }, [org, track]);

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
  const faqItems = org ? normalizeFaq(org.faq) : [];
  const courseCount = courses?.length ?? 0;

  const levels = useMemo(
    () => Array.from(new Set((courses ?? []).map((c) => c.level).filter(Boolean))) as string[],
    [courses],
  );
  const subjects = useMemo(
    () => Array.from(new Set((courses ?? []).map((c) => c.subject).filter(Boolean))) as string[],
    [courses],
  );
  const filteredCourses = (courses ?? []).filter(
    (course) =>
      (!levelFilter || course.level === levelFilter) &&
      (!subjectFilter || course.subject === subjectFilter),
  );

  const fileToBase64 = async (file: File): Promise<string> => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
    }
    return btoa(binary);
  };

  const handleOwnerImage = async (kind: "logo" | "cover", file: File) => {
    if (!org) return;
    setUploadingImage(kind);
    try {
      const result = (await uploadImageFn({
        data: {
          orgId: org.id,
          fileName: file.name,
          contentType: file.type || "image/jpeg",
          base64Data: await fileToBase64(file),
        },
      })) as { key: string; url: string };
      await (updateOrgFn({
        data: {
          orgId: org.id,
          ...(kind === "logo" ? { logo_url: result.url } : { cover_image_url: result.url }),
        },
      }) as Promise<unknown>);
      toast.success(kind === "logo" ? "Logo updated" : "Cover image updated");
      void queryClient.invalidateQueries({ queryKey: ["organization-profile", slug] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploadingImage(null);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Profile link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  };

  const trackContactClick = () => {
    if (org) track([{ organizationId: org.id, type: "contact_click" }]);
  };

  const handleSaveContact = () => {
    if (!org) return;
    const socials: SocialUrls = {
      youtube: org.youtube_url,
      linkedin: org.linkedin_url,
      x: org.x_url,
      rednote: org.rednote_url,
      instagram: org.instagram_url,
      facebook: org.facebook_url,
    };
    downloadVCard(org, socials, window.location.href);
    toast.success("Contact card downloaded");
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <SiteHeader />
      <main className="flex-1">
        {orgLoading && (
          <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <Skeleton className="h-40 w-full rounded-none sm:h-56" />
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
            <div className="flex items-center justify-between gap-3">
              <Link
                to="/courses"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--brand-link)]"
              >
                <ArrowLeft className="h-4 w-4" />
                All courses
              </Link>
              <Button
                variant="outline"
                size="sm"
                prefix={<Share2 />}
                onClick={() => void handleShare()}
              >
                Share
              </Button>
            </div>

            {isPreview && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                <p className="font-semibold">Pending activation</p>
                <p className="mt-0.5 text-amber-700/80 dark:text-amber-400/80">
                  You're previewing your public profile. It becomes visible to everyone once your
                  account is activated by the MatchMax team.
                </p>
              </div>
            )}

            {isOwner && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--foreground)]/10 bg-[color:var(--muted)] p-3 text-sm">
                <p className="font-medium text-[color:var(--ink)]">
                  You're viewing your public profile — edit it inline or in the console.
                </p>
                <Button asChild variant="outline" size="sm">
                  <a href="/business">Open console</a>
                </Button>
              </div>
            )}

            {/* Hero */}
            <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="group relative h-40 w-full sm:h-56">
                {org.cover_image_url ? (
                  <img src={org.cover_image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-r from-[#1d9bf0] via-[#47aef5] to-[#8ecdf8]" />
                )}
                {isOwner && (
                  <>
                    <button
                      type="button"
                      aria-label="Change cover image"
                      disabled={uploadingImage !== null}
                      onClick={() => coverInputRef.current?.click()}
                      className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md bg-black/50 text-white opacity-0 transition-opacity hover:bg-black/70 focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void handleOwnerImage("cover", file);
                      }}
                    />
                  </>
                )}
              </div>

              <div className="px-5 pb-6 sm:px-8">
                <div className="relative z-10 -mt-12 flex flex-wrap items-end justify-between gap-4 sm:-mt-14">
                  <div className="group relative shrink-0">
                    {org.logo_url ? (
                      <img
                        src={org.logo_url}
                        alt=""
                        className="h-24 w-24 rounded-full border-4 border-card object-cover shadow-md sm:h-28 sm:w-28"
                      />
                    ) : (
                      <span className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-card bg-[color:var(--foreground)] text-[color:var(--background)] text-2xl font-bold leading-none shadow-md sm:h-28 sm:w-28">
                        {initials || "MM"}
                      </span>
                    )}
                    {isOwner && (
                      <>
                        <button
                          type="button"
                          aria-label="Change logo"
                          disabled={uploadingImage !== null}
                          onClick={() => logoInputRef.current?.click()}
                          className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Camera className="h-5 w-5" />
                        </button>
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) void handleOwnerImage("logo", file);
                          }}
                        />
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pb-1">
                    {whatsappUrl && (
                      <Button asChild variant="solid" color="blue" className="font-bold">
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={trackContactClick}
                        >
                          <MessageCircle className="mr-2 h-4 w-4" />
                          WhatsApp
                        </a>
                      </Button>
                    )}
                    {org.contact_email && (
                      <Button asChild variant="outline">
                        <a href={`mailto:${org.contact_email}`} onClick={trackContactClick}>
                          <Mail className="mr-2 h-4 w-4" />
                          Email
                        </a>
                      </Button>
                    )}
                    {org.website_url && (
                      <Button asChild variant="ghost">
                        <a
                          href={org.website_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={trackContactClick}
                        >
                          <Globe className="mr-2 h-4 w-4" />
                          Website
                        </a>
                      </Button>
                    )}
                    <Button variant="ghost" prefix={<Contact />} onClick={handleSaveContact}>
                      Save contact
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-[color:var(--ink)] sm:text-3xl">
                      {org.name}
                      <BadgeCheck
                        className="h-6 w-6 shrink-0 text-[color:var(--muted-foreground)]"
                        aria-label="Verified business"
                      />
                    </h1>
                    {org.tagline ? (
                      <p className="mt-1.5 max-w-2xl text-[15px] font-medium text-muted-foreground">
                        {org.tagline}
                      </p>
                    ) : null}
                    <SocialLinks
                      className="mt-3"
                      urls={{
                        youtube: org.youtube_url,
                        linkedin: org.linkedin_url,
                        x: org.x_url,
                        rednote: org.rednote_url,
                        instagram: org.instagram_url,
                        facebook: org.facebook_url,
                      }}
                    />
                  </div>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Edit business details"
                      onClick={() => setIdentityOpen(true)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <span className="flex items-baseline gap-1.5">
                    <span className="font-semibold tabular-nums text-[color:var(--ink)]">
                      {coursesLoading ? "…" : courseCount}
                    </span>
                    <span className="text-muted-foreground">
                      {courseCount === 1 ? "Course" : "Courses"}
                    </span>
                  </span>
                  {org.district ? (
                    <span className="flex items-baseline gap-1.5">
                      <span className="font-semibold text-[color:var(--ink)]">{org.district}</span>
                      <span className="text-muted-foreground">District</span>
                    </span>
                  ) : null}
                  <span className="flex items-baseline gap-1.5">
                    <span className="font-semibold text-[color:var(--ink)]">
                      {org.founded_year ?? "—"}
                    </span>
                    <span className="text-muted-foreground">Founded</span>
                  </span>
                  <span className="flex items-baseline gap-1.5">
                    <span className="font-semibold text-[color:var(--ink)]">{memberSince}</span>
                    <span className="text-muted-foreground">member since</span>
                  </span>
                </div>
              </div>
            </section>

            {/* About */}
            <section id="about" className="mt-10 scroll-mt-24">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold tracking-tight text-[color:var(--ink)]">About</h2>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    prefix={<Pencil />}
                    onClick={() => setAboutOpen(true)}
                  >
                    Edit
                  </Button>
                )}
              </div>
              <div className="mt-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(220px,1fr)]">
                  <div className="min-w-0">
                    {parseYouTubeUrl(org.intro_video_url) ? (
                      <div className="pb-1">
                        <YouTubePlayer
                          url={org.intro_video_url ?? ""}
                          title={`Intro video from ${org.name}`}
                        />
                      </div>
                    ) : null}
                    <div className="space-y-3 text-[15px] leading-relaxed text-muted-foreground">
                      {org.description ? (
                        org.description
                          .split(/\n{2,}/)
                          .map((paragraph, i) => <p key={i}>{paragraph}</p>)
                      ) : !parseYouTubeUrl(org.intro_video_url) ? (
                        <p>This business hasn't added a description yet.</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/40 p-4">
                    <h3 className="text-sm font-bold text-[color:var(--ink)]">Details</h3>
                    <ul className="mt-3 flex flex-col gap-2.5 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2.5">
                        <MapPin className="h-4 w-4 shrink-0" />
                        {org.district ?? "Hong Kong"}
                      </li>
                      {org.founded_year ? (
                        <li className="flex items-center gap-2.5">
                          <CalendarDays className="h-4 w-4 shrink-0" />
                          Founded {org.founded_year}
                        </li>
                      ) : null}
                      {org.languages ? (
                        <li className="flex items-center gap-2.5">
                          <BookOpen className="h-4 w-4 shrink-0" />
                          {org.languages}
                        </li>
                      ) : null}
                      <li className="flex items-center gap-2.5">
                        <BadgeCheck className="h-4 w-4 shrink-0" />
                        Member since {memberSince}
                      </li>
                      {org.website_url ? (
                        <li className="flex items-center gap-2.5">
                          <Globe className="h-4 w-4 shrink-0" />
                          <a
                            href={org.website_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={trackContactClick}
                            className="truncate font-medium text-[color:var(--brand-link)] hover:underline"
                          >
                            {org.website_url.replace(/^https?:\/\//, "")}
                          </a>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                </div>

                {faqItems.length > 0 && (
                  <div className="mt-6 border-t border-border pt-5">
                    <h3 className="text-sm font-bold text-[color:var(--ink)]">
                      Frequently asked questions
                    </h3>
                    <Accordion type="single" collapsible className="mt-2">
                      {faqItems.map((item, i) => (
                        <AccordionItem key={i} value={`faq-${i}`}>
                          <AccordionTrigger className="text-left text-sm font-medium">
                            {item.question}
                          </AccordionTrigger>
                          <AccordionContent className="text-sm text-muted-foreground">
                            {item.answer}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                )}
              </div>
            </section>

            {/* Courses */}
            <section id="courses" className="mt-10 scroll-mt-24">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold tracking-tight text-[color:var(--ink)]">
                  Courses
                </h2>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold tabular-nums text-muted-foreground">
                  {coursesLoading ? "…" : courseCount}
                </span>
              </div>
              <div className="mt-4">
                {(levels.length > 0 || subjects.length > 0) && (
                  <div className="mb-4 flex flex-wrap items-center gap-1.5">
                    {levels.map((level) => (
                      <button
                        key={level}
                        type="button"
                        aria-pressed={levelFilter === level}
                        onClick={() => setLevelFilter((prev) => (prev === level ? null : level))}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition-colors ${
                          levelFilter === level
                            ? "bg-[color:var(--btn-accent)] text-[color:var(--btn-accent-fg)] ring-[color:var(--btn-accent)]"
                            : "bg-muted text-muted-foreground ring-transparent hover:text-[color:var(--ink)]"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                    {subjects.map((subject) => (
                      <button
                        key={subject}
                        type="button"
                        aria-pressed={subjectFilter === subject}
                        onClick={() =>
                          setSubjectFilter((prev) => (prev === subject ? null : subject))
                        }
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition-colors ${
                          subjectFilter === subject
                            ? "bg-[color:var(--btn-accent)] text-[color:var(--btn-accent-fg)] ring-[color:var(--btn-accent)]"
                            : "bg-muted text-muted-foreground ring-transparent hover:text-[color:var(--ink)]"
                        }`}
                      >
                        {subject}
                      </button>
                    ))}
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {coursesLoading && (
                    <>
                      <Skeleton className="h-64 rounded-xl" />
                      <Skeleton className="h-64 rounded-xl" />
                      <Skeleton className="h-64 rounded-xl" />
                    </>
                  )}
                  {!coursesLoading && filteredCourses.length === 0 && (
                    <div className="sm:col-span-2 lg:col-span-3">
                      <EmptyState
                        icon={BookOpen}
                        title="No courses found"
                        description={
                          (courses ?? []).length === 0
                            ? "This business hasn't published any courses — check back soon."
                            : "No courses match the selected filters."
                        }
                        secondaryAction={
                          (levelFilter || subjectFilter) && (courses ?? []).length > 0 ? (
                            <Button
                              variant="outline"
                              onClick={() => {
                                setLevelFilter(null);
                                setSubjectFilter(null);
                              }}
                            >
                              Clear filters
                            </Button>
                          ) : (
                            <Button variant="outline" asChild>
                              <Link to="/courses">Browse other courses</Link>
                            </Button>
                          )
                        }
                      />
                    </div>
                  )}
                  {filteredCourses.map((course) => (
                    <ListingCard key={course.id} course={course} />
                  ))}
                </div>
              </div>
            </section>

            {/* Class schedule */}
            {courseCount > 0 && (
              <section id="schedule" className="mt-10 scroll-mt-24">
                <h2 className="text-xl font-bold tracking-tight text-[color:var(--ink)]">
                  Class schedule
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Recurring class days from this business's published courses.
                </p>
                <div className="mt-4">
                  <CourseCalendar courses={courses ?? []} />
                </div>
              </section>
            )}

            {/* Contact */}
            <section id="contact" className="mt-10 scroll-mt-24">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold tracking-tight text-[color:var(--ink)]">
                  Get in touch
                </h2>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    prefix={<Pencil />}
                    onClick={() => setContactOpen(true)}
                  >
                    Edit
                  </Button>
                )}
              </div>
              <div className="mt-4 grid gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
                <div className="flex flex-col gap-3 text-sm">
                  {org.website_url && (
                    <a
                      href={org.website_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={trackContactClick}
                      className="inline-flex items-center gap-2.5 font-medium text-[color:var(--brand-link)] hover:underline"
                    >
                      <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        {org.website_url.replace(/^https?:\/\//, "")}
                      </span>
                    </a>
                  )}
                  {org.contact_email && (
                    <a
                      href={`mailto:${org.contact_email}`}
                      onClick={trackContactClick}
                      className="inline-flex items-center gap-2.5 font-medium text-[color:var(--ink)] hover:text-[color:var(--brand-link)]"
                    >
                      <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{org.contact_email}</span>
                    </a>
                  )}
                  {org.contact_phone && (
                    <a
                      href={`tel:${org.contact_phone}`}
                      onClick={trackContactClick}
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
                <div className="flex flex-col gap-2 sm:w-56">
                  {whatsappUrl && (
                    <Button
                      asChild
                      className="h-11 w-full bg-[color:var(--brand-whatsapp)] font-bold text-white hover:bg-[color:var(--brand-whatsapp-hover)]"
                    >
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={trackContactClick}
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        WhatsApp enquiry
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full"
                    prefix={<Contact />}
                    onClick={handleSaveContact}
                  >
                    Save contact card
                  </Button>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
      <BackToTop />
      <SiteFooter />

      {org && (
        <>
          <OrgIdentityDialog org={org} open={identityOpen} onOpenChange={setIdentityOpen} />
          <OrgAboutDialog org={org} open={aboutOpen} onOpenChange={setAboutOpen} />
          <OrgContactDialog org={org} open={contactOpen} onOpenChange={setContactOpen} />
        </>
      )}
    </div>
  );
}
