import { ActiveCasesSection } from "@/features/cases/active-cases/active-cases-section";
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
  Users,
  FileText,
  Newspaper,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  getCentreChannel,
  getOrganizationRoleForSlug,
  updateOrganization,
  uploadOrganizationImage,
} from "@/features/business/business.functions";
import { useAuth } from "@/features/auth/useAuth";
import {
  COURSE_FORMAT_LABEL_KEYS,
  COURSE_INSTRUCTION_LANGUAGE_LABELS,
  isCourseFormat,
  normalizeHighlights,
  normalizeInstructionLanguages,
} from "@/features/business/course-showcase";
import { CourseEnquiryModal } from "@/features/business/course-enquiry-modal";
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

const INSTRUCTION_LANGUAGE_LABELS = COURSE_INSTRUCTION_LANGUAGE_LABELS;

function ListingCard({
  course,
  onEnquire,
}: {
  course: Awaited<ReturnType<typeof fetchCoursesByOrganizationId>>[number];
  onEnquire: (course: { id: string; title: string }) => void;
}) {
  const { t } = useTranslation();
  const price = formatCoursePrice(course.price, course.currency);
  const priceLabel = course.price_display?.trim() || price;
  const formatLabel = isCourseFormat(course.format)
    ? t(`centre_channel.${COURSE_FORMAT_LABEL_KEYS[course.format]}`)
    : null;
  const highlights = normalizeHighlights(course.highlights);
  const languages = normalizeInstructionLanguages(course.instruction_languages).map(
    (code) => INSTRUCTION_LANGUAGE_LABELS[code],
  );
  const schedule = course.schedule_summary?.trim() || course.schedule_text;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-[color:var(--foreground)]/25">
      {/* Title and image stay a link to the course page; the Enquire button sits
          outside it so the card never nests a button inside an anchor. */}
      <a href={`/courses/${course.id}`} className="flex min-w-0 flex-1 flex-col">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {course.image_url ? (
            <img
              src={course.image_url}
              alt={course.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-muted-foreground">
              <BookOpen className="h-10 w-10" aria-hidden />
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-4 pb-3">
          {priceLabel ? (
            <p className="text-base font-semibold text-[color:var(--ink)]">{priceLabel}</p>
          ) : (
            <p className="text-sm font-semibold text-muted-foreground">Enquire for pricing</p>
          )}
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[color:var(--ink)] group-hover:text-[color:var(--brand-link)]">
            {course.title}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {course.level ? (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-[color:var(--ink)]">
                {course.level}
              </span>
            ) : null}
            {formatLabel ? (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {formatLabel}
              </span>
            ) : null}
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {courseModeLabel(course.mode)}
            </span>
            {course.trial_available ? (
              <span className="inline-flex items-center rounded-full border border-[color:var(--ink)]/20 px-2 py-0.5 text-xs font-semibold text-[color:var(--ink)]">
                {t("centre_channel.course_trial_badge")}
              </span>
            ) : null}
          </div>
          {highlights.length > 0 ? (
            <ul
              aria-label={t("centre_channel.course_highlights")}
              className="flex list-disc flex-col gap-0.5 pl-4 text-xs text-muted-foreground marker:text-[color:var(--ink)]/30"
            >
              {highlights.map((highlight) => (
                <li key={highlight} className="line-clamp-1">
                  {highlight}
                </li>
              ))}
            </ul>
          ) : null}
          {languages.length > 0 ? (
            <p
              className="text-xs text-muted-foreground"
              title={t("centre_channel.course_languages")}
              aria-label={`${t("centre_channel.course_languages")}: ${languages.join(", ")}`}
            >
              {languages.join(" · ")}
            </p>
          ) : null}
          <div className="mt-auto flex flex-col gap-1 pt-1 text-xs text-muted-foreground">
            {schedule ? (
              <p className="flex items-start gap-1">
                <CalendarDays className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                <span className="line-clamp-1">{schedule}</span>
              </p>
            ) : null}
            <p className="flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden />
              {course.district ?? "Hong Kong"}
            </p>
          </div>
        </div>
      </a>
      <div className="px-4 pb-4">
        <Button
          variant="solid"
          color="blue"
          className="w-full"
          onClick={() => onEnquire({ id: course.id, title: course.title })}
        >
          {t("centre_channel.course_enquire_cta")}
        </Button>
      </div>
    </article>
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
  // #815 §2.5 / §2.3: one enquiry dialog behind both the course cards and the
  // affiliate "Request lesson" buttons. Only one of course/tutor is set.
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [enquiryCourse, setEnquiryCourse] = useState<{ id: string; title: string } | null>(null);
  const [enquiryTutor, setEnquiryTutor] = useState<{
    tutorCode: string;
    displayName: string;
  } | null>(null);
  const openCourseEnquiry = (course: { id: string; title: string }) => {
    setEnquiryCourse(course);
    setEnquiryTutor(null);
    setEnquiryOpen(true);
  };
  const openTutorEnquiry = (tutor: { tutorCode: string; displayName: string }) => {
    setEnquiryCourse(null);
    setEnquiryTutor(tutor);
    setEnquiryOpen(true);
  };
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
  const { t } = useTranslation();
  const channelFn = useServerFn(getCentreChannel);
  // #815 §2.2 / §2.3: partner state + approved affiliates (no contact fields).
  const channel = useQuery({
    queryKey: ["centre-channel", slug],
    queryFn: () => channelFn({ data: { slug } }),
    enabled: !!org,
  });
  const verifiedPartner = channel.data?.verifiedPartner === true;
  const affiliates = channel.data?.tutors ?? [];

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
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
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
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
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
                  You're viewing your public profile, edit it inline or in the console.
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link to="/business" search={{ tab: undefined }}>
                    Open console
                  </Link>
                </Button>
              </div>
            )}

            {/* Hero */}
            <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
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
                        className="h-24 w-24 rounded-full border-4 border-card object-cover sm:h-28 sm:w-28"
                      />
                    ) : (
                      <span className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-card bg-[color:var(--foreground)] text-[color:var(--background)] text-2xl font-bold leading-none sm:h-28 sm:w-28">
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
                      {verifiedPartner ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--muted)] px-2.5 py-0.5 text-xs font-semibold text-[color:var(--ink)]">
                          <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                          {t("centre_channel.verified_partner")}
                        </span>
                      ) : null}
                    </h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">@{org.slug}</p>
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
                  {[
                    {
                      label: t("centre_channel.stat_tutors"),
                      value: channel.isLoading ? "…" : affiliates.length,
                    },
                    {
                      label: t("centre_channel.stat_courses"),
                      value: coursesLoading ? "…" : courseCount,
                    },
                    { label: t("centre_channel.stat_notes"), value: 0 },
                  ].map((stat) => (
                    <div key={stat.label} className="flex items-baseline gap-1.5">
                      <span className="font-semibold tabular-nums text-[color:var(--ink)]">
                        {stat.value}
                      </span>
                      <span className="text-muted-foreground">{stat.label}</span>
                    </div>
                  ))}
                  {org.district ? (
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-semibold text-[color:var(--ink)]">{org.district}</span>
                      <span className="sr-only">District</span>
                    </div>
                  ) : null}
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
              <div className="mt-4 rounded-xl border border-border bg-card p-5 sm:p-6">
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
                    <h3 className="text-base font-bold text-[color:var(--ink)]">Details</h3>
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
                    <h3 className="text-base font-bold text-[color:var(--ink)]">
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

            {/* #633: confirmed cases, read-only here. */}
            <div className="mt-10">
              <ActiveCasesSection subject={{ kind: "centre", slug }} isOwner={false} />
            </div>

            {/* #815 §2.2: channel tabs. */}
            <Tabs defaultValue="courses" className="mt-10">
              <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
                <TabsTrigger value="courses">{t("centre_channel.tab_courses")}</TabsTrigger>
                <TabsTrigger value="tutors">{t("centre_channel.tab_tutors")}</TabsTrigger>
                <TabsTrigger value="materials">{t("centre_channel.tab_materials")}</TabsTrigger>
                <TabsTrigger value="posts">{t("centre_channel.tab_posts")}</TabsTrigger>
              </TabsList>

              <TabsContent value="courses" className="mt-6">
                {/* Courses */}
                <section id="courses" className="scroll-mt-24">
                  <div>
                    {(levels.length > 0 || subjects.length > 0) && (
                      <div className="mb-4 flex flex-wrap items-center gap-1.5">
                        {levels.map((level) => (
                          <button
                            key={level}
                            type="button"
                            aria-pressed={levelFilter === level}
                            onClick={() =>
                              setLevelFilter((prev) => (prev === level ? null : level))
                            }
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
                            title={
                              (courses ?? []).length === 0
                                ? t("centre_channel.courses_empty")
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
                                  {t("centre_channel.filter_reset")}
                                </Button>
                              ) : isOwner ? (
                                <Button asChild>
                                  <Link to="/business/courses">
                                    {t("centre_channel.owner_add_course")}
                                  </Link>
                                </Button>
                              ) : null
                            }
                          />
                        </div>
                      )}
                      {filteredCourses.map((course) => (
                        <ListingCard
                          key={course.id}
                          course={course}
                          onEnquire={openCourseEnquiry}
                        />
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
              </TabsContent>

              <TabsContent value="tutors" className="mt-6">
                {channel.isLoading ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Skeleton className="h-40 rounded-xl" />
                    <Skeleton className="h-40 rounded-xl" />
                    <Skeleton className="h-40 rounded-xl" />
                  </div>
                ) : channel.isError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {t("centre_channel.tutors_error")}
                  </p>
                ) : affiliates.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title={t("centre_channel.tutors_empty")}
                    description={isOwner ? t("centre_channel.owner_tutors_hint") : undefined}
                    secondaryAction={
                      isOwner ? (
                        <Button variant="outline" asChild>
                          <Link to="/business" search={{ tab: undefined }}>
                            {t("centre_channel.owner_open_workspace")}
                          </Link>
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <>
                    <p className="mb-4 text-sm text-muted-foreground">
                      {t("centre_channel.tutors_subtitle", { name: org.name })}
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {affiliates.map((tutor) => (
                        <div
                          key={tutor.tutorCode}
                          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-[color:var(--foreground)]/30"
                        >
                          {/* The profile link wraps only the identity, so the
                              Request lesson button is never nested in it. */}
                          <Link
                            to="/tutors/$tutorCode"
                            params={{ tutorCode: tutor.tutorCode }}
                            className="flex flex-col gap-3"
                          >
                            <div className="flex items-center gap-3">
                              {tutor.photoUrl ? (
                                <img
                                  src={tutor.photoUrl}
                                  alt=""
                                  className="h-12 w-12 shrink-0 rounded-full object-cover"
                                />
                              ) : (
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-[color:var(--ink)]">
                                  {tutor.displayName.charAt(0).toUpperCase()}
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="flex items-center gap-1 truncate text-sm font-semibold text-[color:var(--ink)]">
                                  {tutor.displayName}
                                  {tutor.verified ? (
                                    <BadgeCheck
                                      className="h-4 w-4 shrink-0 text-[color:var(--brand-link)]"
                                      aria-label="Verified"
                                    />
                                  ) : null}
                                </p>
                                <p className="text-xs text-muted-foreground">{tutor.tutorCode}</p>
                              </div>
                            </div>
                            {tutor.headline ? (
                              <p className="line-clamp-2 text-sm text-muted-foreground">
                                {tutor.headline}
                              </p>
                            ) : null}
                            {tutor.subjects.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {tutor.subjects.map((subject) => (
                                  <span
                                    key={subject}
                                    className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                                  >
                                    {subject}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </Link>
                          <div className="mt-auto flex flex-col gap-2 pt-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-semibold text-[color:var(--ink)]">
                                {tutor.fromRateHkd
                                  ? t("centre_channel.from_rate", { rate: tutor.fromRateHkd })
                                  : null}
                              </span>
                              <Link
                                to="/tutors/$tutorCode"
                                params={{ tutorCode: tutor.tutorCode }}
                                className="font-semibold text-[color:var(--brand-link)]"
                              >
                                {t("centre_channel.view_profile")}
                              </Link>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() =>
                                openTutorEnquiry({
                                  tutorCode: tutor.tutorCode,
                                  displayName: tutor.displayName,
                                })
                              }
                            >
                              {t("centre_channel.request_lesson")}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="materials" className="mt-6">
                <EmptyState
                  icon={FileText}
                  title={t("centre_channel.materials_empty")}
                  description={isOwner ? t("centre_channel.materials_hint") : undefined}
                />
              </TabsContent>

              <TabsContent value="posts" className="mt-6">
                <EmptyState icon={Newspaper} title={t("centre_channel.posts_empty")} />
              </TabsContent>
            </Tabs>

            {/* Contact */}
            <section id="contact" className="mt-10 scroll-mt-24">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold tracking-tight text-[color:var(--ink)]">
                  {t("centre_channel.enquire")}
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
              <div className="mt-4 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
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
                    <p className="text-muted-foreground">
                      This business hasn&rsquo;t added contact details yet. Message our team on
                      WhatsApp (button below) and we&rsquo;ll connect you.
                    </p>
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

            <p className="mt-10 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
              {t("centre_channel.footnote")}
            </p>

            <div aria-hidden className="h-16 lg:hidden" />
            {/* AC-CH-1: the Enquire CTA stays reachable on mobile. */}
            <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-4 right-[5.5rem] z-40 lg:hidden">
              <Button
                asChild
                variant="solid"
                color="blue"
                className="h-12 w-full rounded-full font-bold"
              >
                <a href="#contact" onClick={trackContactClick}>
                  {t("centre_channel.enquire")}
                </a>
              </Button>
            </div>
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
          <CourseEnquiryModal
            open={enquiryOpen}
            onOpenChange={setEnquiryOpen}
            orgSlug={slug}
            orgName={org.name}
            course={enquiryCourse}
            tutor={enquiryTutor}
          />
        </>
      )}
    </div>
  );
}
