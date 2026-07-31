import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, Sparkles, MessageCircle, Star, Users, GraduationCap, MapPin, BookOpen, Globe } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { blurActive } from "@/lib/dom";
import { fetchTopWeeklyTutors, fetchLandingStats, fetchTutorByCode, getTutorGenderLabel, getTutorLessonModeLabel, getTutorLocationLabel, type Tutor } from "@/features/tutors/queries";
import { supabase } from "@/integrations/supabase/client";

const OG_IMAGE = "https://storage.googleapis.com/gpt-engineer-file-uploads/8gNheRvRfCOczS8mI5H1ghF3qLL2/social-images/social-1784777386937-Untitled_design.webp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Find Verified IB, DSE & IGCSE Tutors in Hong Kong | MatchMax" },
      { name: "description", content: "Find verified IB, DSE, IGCSE, AP and A-Level tutors in Hong Kong. Compare tutor profiles, lesson modes and pricing to get matched quickly." },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Find Verified IB, DSE & IGCSE Tutors in Hong Kong | MatchMax" },
      { property: "og:description", content: "Find verified IB, DSE, IGCSE, AP and A-Level tutors in Hong Kong. Compare tutor profiles, lesson modes and pricing to get matched quickly." },
      { property: "og:url", content: "https://maxmatch.app/" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "MatchMax" },
      { property: "og:locale", content: "en_HK" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "IB, DSE & IGCSE Tutors in Hong Kong | MatchMax" },
      { name: "twitter:description", content: "Find verified IB, HKDSE, IGCSE, AP, A-Level and international school tutors in Hong Kong." },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [
      { rel: "canonical", href: "https://maxmatch.app/" },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "shortcut icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ]
  }),
  component: Landing,
});

const STAT_ICONS = { students: Users, tutors: GraduationCap, subjects: BookOpen, districts: MapPin } as const;

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k+`;
  return `${n}`;
}

function Landing() {
  const { t } = useTranslation();
  // Use shared blur helper
  const { data: featuredTutors = [], isLoading: featuredLoading } = useQuery({
    queryKey: ["landing", "featured_tutors"],
    queryFn: () => fetchTopWeeklyTutors(3),
  });
  const { data: liveStats } = useQuery({
    queryKey: ["landing", "stats"],
    queryFn: () => fetchLandingStats(),
  });
  const { data: studentsMatchedSetting } = useQuery({
    queryKey: ["settings", "students_matched"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "students_matched")
        .maybeSingle();
      if (error) throw error;
      const v = data?.value;
      const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : 0;
      return Number.isFinite(n) ? n : 0;
    },
  });
  const { data: heroTutorCode } = useQuery({
    queryKey: ["settings", "hero_tutor_code"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "hero_tutor_code")
        .maybeSingle();
      if (error) throw error;
      const v = data?.value;
      return typeof v === "string" ? v.trim() : "";
    },
  });

  const { data: pickedHeroTutor } = useQuery({
    queryKey: ["landing", "hero_tutor", heroTutorCode ?? ""],
    queryFn: () => fetchTutorByCode(heroTutorCode as string),
    enabled: !!heroTutorCode,
  });

  const heroTutor: Tutor | null = pickedHeroTutor ?? featuredTutors[0] ?? null;

  const trustStats = [
    { key: "students" as const, value: formatCount(studentsMatchedSetting ?? 0) },
    { key: "tutors" as const, value: formatCount(liveStats?.activeTutors ?? 0) },
    { key: "subjects" as const, value: formatCount(liveStats?.subjectsCovered ?? 0) },
    { key: "districts" as const, value: "18" },
  ];

  // JSON-LD: helps Google understand this as an educational service.
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: "MatchMax",
    url: "https://maxmatch.app/",
    description:
      "Find verified IB, HKDSE, IGCSE, AP, A-Level and international school tutors in Hong Kong.",
    areaServed: {
      "@type": "City",
      name: "Hong Kong",
    },
  };

  const tutorListStructuredData =
    featuredTutors.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: featuredTutors.map((tut, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
              "@type": "Person",
              name: tut.tutor_code,
              url: `https://maxmatch.app/tutors/${tut.tutor_code}`,
            },
          })),
        }
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {tutorListStructuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(tutorListStructuredData) }}
        />
      )}

      <SiteHeader />

      {/* Hero */}
      <section className="hero-startup-bg relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse at top right, color-mix(in oklab, #2ED5DE 25%, transparent) 0%, transparent 55%), radial-gradient(ellipse at bottom left, color-mix(in oklab, #041344 15%, transparent) 0%, transparent 50%)",
          }}
        />
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:pt-24 lg:pb-28">
          <div className="flex flex-col justify-center">
            <h1 className="mt-6 text-5xl font-black leading-[1.05] tracking-tight text-[color:var(--brand-navy)] sm:text-6xl lg:text-7xl">
              {t("hero.title_a")}
              <br />
              <span className="text-brand-gradient">{t("hero.title_b")}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              {t("hero.subtitle")}
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-14 bg-[color:var(--brand-navy)] px-8 text-base font-bold text-white shadow-brand hover:bg-[color:var(--brand-royal)]">
                <Link to="/tutors" onClick={() => blurActive()}>
                  {t("hero.cta_primary")}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>

          {/* Hero visual card */}
          <div className="relative flex items-center justify-center">
            <div className="relative w-full max-w-md">
              <div className="absolute inset-0 rounded-sm border border-border/50 bg-muted/30" aria-hidden />
              <div className="relative rounded-sm border border-border/80 bg-card/95 p-6 shadow-[0_10px_30px_rgba(4,19,68,0.06)]">
                {heroTutor ? (
                  <>
                    <div className="flex items-center gap-3">
                      {heroTutor.photo_url ? (
                        <img
                          src={heroTutor.photo_url}
                          alt={`${heroTutor.tutor_code}, tutor for ${heroTutor.subjects.slice(0, 2).join(" and ")}`}
                          width={44}
                          height={44}
                          loading="eager"
                          fetchPriority="high"
                          className="h-11 w-11 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[color:var(--brand-teal)]/20 bg-[color:var(--brand-teal)]/10 text-sm font-semibold text-[color:var(--brand-teal)]">
                          {heroTutor.tutor_code?.slice(0, 2).toUpperCase() || "TP"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground break-words">{heroTutor.tutor_code}{getTutorGenderLabel(heroTutor.gender) ? ` · ${getTutorGenderLabel(heroTutor.gender)}` : ""}</p>
                        <p className="text-xs leading-relaxed text-muted-foreground break-words whitespace-pre-line">
                          {heroTutor.headline ?? heroTutor.subjects.slice(0, 3).join(" · ")}
                        </p>
                      </div>
                      <span className="rounded-lg border border-[color:var(--brand-teal)]/15 bg-[color:var(--brand-teal)]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[color:var(--brand-teal)]">Featured</span>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-3 rounded-md border border-border/70 bg-muted/50 p-4 text-center text-xs">
                      <div>
                        <p className="font-bold text-lg text-[color:var(--brand-navy)]">{heroTutor.tutor_code}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Code</p>
                      </div>
                      <div>
                        <p className="font-bold text-lg text-[color:var(--brand-navy)]">${heroTutor.hourly_rate}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">/hr</p>
                      </div>
                      <div>
                        <p className="font-bold text-lg text-[color:var(--brand-navy)]">{heroTutor.experience_years ? `${heroTutor.experience_years}+ yrs` : "New"}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Experience</p>
                      </div>
                    </div>
                    <div className="mt-5 rounded-md border border-border/70 bg-muted/40 p-4">
                      <div className="space-y-2">
                        {[
                          heroTutor.badge,
                          heroTutor.district,
                          heroTutor.experience_years ? `${heroTutor.experience_years}+ years` : null,
                          heroTutor.subjects[0] ?? null,
                        ]
                          .filter((x): x is string => !!x)
                          .slice(0, 4)
                          .map((tag) => (
                            <div key={tag} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <BadgeCheck className="h-3.5 w-3.5 text-[color:var(--brand-teal)]" />
                              {tag}
                            </div>
                          ))}
                      </div>
                    </div>
                    <Button asChild className="mt-6 w-full rounded-lg bg-[color:var(--brand-navy)] py-3 text-sm font-bold text-white hover:bg-[color:var(--brand-royal)]">
                      <Link to="/tutors/$tutorCode" params={{ tutorCode: heroTutor.tutor_code }}>
                        <MessageCircle className="mr-2 inline h-4 w-4" /> View tutor profile
                      </Link>
                    </Button>
                  </>
                ) : (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    {featuredLoading ? "Loading featured tutor…" : "No featured tutor yet."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="py-10">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 sm:grid-cols-4 sm:px-6">
          {trustStats.map(({ key, value }) => {
            const Icon = STAT_ICONS[key];
            return (
              <div key={key} className="text-center">
                <Icon className="mx-auto h-6 w-6 text-[color:var(--brand-teal)]" aria-hidden="true" />
                <p className="mt-3 text-3xl font-black text-[color:var(--brand-navy)]">{value}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t(`trust.${key}`)}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">{t("how.title")}</h2>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="group relative overflow-hidden rounded-sm border border-border/80 bg-card/95 p-8 shadow-[0_10px_24px_rgba(4,19,68,0.05)] transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--brand-teal)]/45 hover:shadow-brand"
              >
                <div className="relative mb-6 flex h-14 w-14 items-center justify-center rounded-md bg-brand-gradient text-2xl font-black text-white shadow-teal" aria-hidden="true">
                  {n}
                </div>
                <h3 className="text-xl font-bold text-foreground">{t(`how.step${n}_title`)}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(`how.step${n}_desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured tutors */}
      <section id="tutors" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">{t("featured.title")}</h2>
              <p className="mt-3 text-lg text-muted-foreground">{t("featured.subtitle")}</p>
            </div>
            <Button asChild variant="outline" className="font-bold">
              <Link to="/tutors" onClick={() => blurActive()}>{t("featured.view_all")} <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
          {featuredLoading && (
            <p className="mt-10 text-center text-muted-foreground">{t("common.loading")}</p>
          )}
          {!featuredLoading && featuredTutors.length === 0 && (
            <p className="mt-10 text-center text-muted-foreground">{t("common.no_tutors_yet")}</p>
          )}
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {featuredTutors.map((tut) => (
              <Link
                key={tut.id}
                to="/tutors/$tutorCode"
                params={{ tutorCode: tut.tutor_code }}
                className="block rounded-sm border border-border/80 bg-card p-6 shadow-[0_8px_24px_rgba(4,19,68,0.05)] transition-all hover:-translate-y-0.5 hover:border-[color:var(--brand-teal)]/30 hover:shadow-[0_12px_30px_rgba(4,19,68,0.08)]"
                onClick={() => blurActive()}
              >
                <div className="flex items-center gap-4">
                  {tut.photo_url ? (
                    <img
                      src={tut.photo_url}
                      alt={`${tut.tutor_code}, ${tut.subjects.slice(0, 2).join(" and ")} tutor in Hong Kong`}
                      width={56}
                      height={56}
                      loading="lazy"
                      className="h-14 w-14 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[color:var(--brand-teal)]/20 bg-[color:var(--brand-teal)]/10 text-base font-semibold text-[color:var(--brand-teal)]">
                      {tut.tutor_code?.slice(0, 2).toUpperCase() || "TP"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-base font-bold text-foreground break-words">{tut.tutor_code}{getTutorGenderLabel(tut.gender) ? ` · ${getTutorGenderLabel(tut.gender)}` : ""}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground break-words whitespace-pre-line">{tut.headline ?? getTutorLessonModeLabel(tut.lesson_mode)}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {tut.subjects.slice(0, 3).map((subject) => (
                    <span key={subject} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      {subject}
                    </span>
                  ))}
                  {tut.subjects.length > 3 && (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      +{tut.subjects.length - 3} more
                    </span>
                  )}
                </div>
                {tut.badge && (
                  <div className="mt-4 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-teal)]/10 px-2.5 py-1 text-[11px] font-bold text-[color:var(--brand-teal)]">
                      <BadgeCheck className="h-3 w-3" /> {tut.badge}
                    </span>
                  </div>
                )}
                <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    {tut.lesson_mode === "online" ? <Globe className="h-4 w-4" aria-hidden="true" /> : <MapPin className="h-4 w-4" aria-hidden="true" />}
                    {getTutorLocationLabel(tut)}
                  </span>
                </div>
                <p className="mt-4 text-2xl font-black text-[color:var(--brand-navy)]">
                  HK${tut.hourly_rate}
                  <span className="ml-1 text-sm font-semibold text-muted-foreground">{t("featured.per_hour")}</span>
                </p>
              </Link>

            ))}
          </div>
        </div>
      </section>

      {/* Tutor CTA banner */}
      <section className="pb-20 sm:pb-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-sm bg-[color:var(--brand-navy)] p-10 sm:p-14">
            <div
              aria-hidden
              className="absolute inset-0 opacity-40"
              style={{ background: "radial-gradient(ellipse at top right, #2ED5DE 0%, transparent 60%)" }}
            />
            <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
              <div className="max-w-xl">
                <h3 className="text-3xl font-black text-white sm:text-4xl">{t("tutors_cta.title")}</h3>
                <p className="mt-3 text-base text-white/80">{t("tutors_cta.subtitle")}</p>
              </div>
              <Button asChild size="lg" className="h-14 bg-white px-8 text-base font-bold text-[color:var(--brand-navy)] hover:bg-white/90">
                <Link to="/become-a-tutor">
                  {t("tutors_cta.cta")}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}