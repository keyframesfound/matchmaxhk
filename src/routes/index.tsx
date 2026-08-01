import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { 
  ArrowRight, BadgeCheck, MessageCircle, MapPin, 
  Globe, Users, GraduationCap, BookOpen, X, ChevronDown, Menu 
} from "lucide-react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { blurActive } from "@/lib/dom";
import { 
  fetchTopWeeklyTutors, fetchLandingStats, fetchTutorByCode, 
  getTutorGenderLabel, getTutorLessonModeLabel, getTutorLocationLabel, 
  type Tutor 
} from "@/features/tutors/queries";
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

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k+`;
  return `${n}`;
}

function Landing() {
  const { t } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Queries
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

  // JSON-LD
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: "MatchMax",
    url: "https://maxmatch.app/",
    description: "Find verified IB, HKDSE, IGCSE, AP, A-Level and international school tutors in Hong Kong.",
    areaServed: {
      "@type": "City",
      name: "Hong Kong",
    },
  };

  const tutorListStructuredData = featuredTutors.length > 0 ? {
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
  } : null;

  return (
    <div className="flex min-h-screen flex-col bg-white text-black font-sans selection:bg-black selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      {tutorListStructuredData && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(tutorListStructuredData) }} />
      )}

      {/* MOBILE NAVIGATION MENU OVERLAY */}
      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex h-16 items-center justify-between bg-black px-4 text-white">
            <span className="text-xl font-medium tracking-tight">MatchMax</span>
            <div className="flex items-center gap-4 text-sm font-medium">
              <button onClick={() => setIsMobileMenuOpen(false)}>Log in</button>
              <button className="rounded-full bg-white px-4 py-1.5 text-black hover:bg-gray-200 transition-colors">
                Sign up
              </button>
              <button onClick={() => setIsMobileMenuOpen(false)} aria-label="Close menu">
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>
          <div className="flex flex-col px-6 py-8 space-y-10 overflow-y-auto">
            <Link to="/tutors" className="text-[40px] font-bold leading-none tracking-tight" onClick={() => setIsMobileMenuOpen(false)}>
              Ride <span className="text-gray-400 text-lg ml-2 align-middle">(Find Tutors)</span>
            </Link>
            <Link to="/become-a-tutor" className="text-[40px] font-bold leading-none tracking-tight" onClick={() => setIsMobileMenuOpen(false)}>
              Drive <span className="text-gray-400 text-lg ml-2 align-middle">(Teach)</span>
            </Link>
            <Link to="/business" className="text-[40px] font-bold leading-none tracking-tight" onClick={() => setIsMobileMenuOpen(false)}>
              Business
            </Link>
            <div className="flex items-center justify-between mt-4">
              <span className="text-[40px] font-bold leading-none tracking-tight">About</span>
              <ChevronDown className="h-8 w-8" />
            </div>
            <span className="text-[40px] font-bold leading-none tracking-tight">Help</span>
            <div className="mt-12 flex items-center gap-2 text-sm font-medium">
              <Globe className="h-5 w-5" /> EN
            </div>
          </div>
        </div>
      ) : (
        /* STANDARD HEADER */
        <header className="flex h-16 items-center justify-between bg-black px-4 text-white sm:px-6">
          <span className="text-xl font-medium tracking-tight">MatchMax</span>
          <button className="sm:hidden" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium">
            <Link to="/tutors" className="hover:text-gray-300">Find Tutors</Link>
            <Link to="/become-a-tutor" className="hover:text-gray-300">Teach</Link>
            <div className="flex items-center gap-4 border-l border-gray-700 pl-6">
              <button className="hover:text-gray-300">Log in</button>
              <button className="rounded-full bg-white px-4 py-2 text-black hover:bg-gray-200">Sign up</button>
            </div>
          </div>
        </header>
      )}

      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:pt-24 lg:pb-28">
          <div className="flex flex-col justify-center">
            <h1 className="mt-6 text-5xl font-black leading-[1.05] tracking-tight text-black sm:text-6xl lg:text-7xl">
              {t("hero.title_a")}
              <br />
              <span>{t("hero.title_b")}</span>
            </h1>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-14 bg-black px-8 text-base font-bold text-white rounded-none hover:bg-gray-800">
                <Link to="/tutors" onClick={() => blurActive()}>
                  {t("hero.cta_primary")}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>

          {/* HERO VISUAL CARD */}
          <div className="relative flex items-center justify-center">
            <div className="relative w-full max-w-md">
              <div className="relative rounded-none border-2 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                {heroTutor ? (
                  <>
                    <div className="flex items-center gap-4">
                      {heroTutor.photo_url ? (
                        <img
                          src={heroTutor.photo_url}
                          alt="Tutor profile"
                          className="h-14 w-14 shrink-0 rounded-full object-cover grayscale border border-black"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-black text-white text-lg font-bold">
                          {heroTutor.tutor_code?.slice(0, 2).toUpperCase() || "TP"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-bold text-black break-words">
                          {heroTutor.tutor_code}
                        </p>
                        <p className="text-sm text-gray-600 truncate">
                          {heroTutor.subjects.join(" · ")}
                        </p>
                      </div>
                      <span className="bg-black px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                        Featured
                      </span>
                    </div>
                    
                    <div className="mt-6 grid grid-cols-3 gap-4 border-t-2 border-black pt-6 text-center">
                      <div>
                        <p className="font-bold text-xl text-black">${heroTutor.hourly_rate}</p>
                        <p className="text-xs uppercase tracking-wider text-gray-500">/hr</p>
                      </div>
                      <div>
                        <p className="font-bold text-xl text-black">{heroTutor.experience_years || 1}+</p>
                        <p className="text-xs uppercase tracking-wider text-gray-500">Yrs</p>
                      </div>
                      <div>
                        <p className="font-bold text-xl text-black">{heroTutor.lesson_mode === 'online' ? 'Web' : 'Local'}</p>
                        <p className="text-xs uppercase tracking-wider text-gray-500">Mode</p>
                      </div>
                    </div>

                    <Button asChild className="mt-8 w-full rounded-none bg-black py-6 text-base font-bold text-white hover:bg-gray-800">
                      <Link to="/tutors/$tutorCode" params={{ tutorCode: heroTutor.tutor_code }}>
                        View Profile <ArrowRight className="ml-2 h-5 w-5" />
                      </Link>
                    </Button>
                  </>
                ) : (
                  <div className="py-16 text-center text-sm text-gray-500">
                    Loading featured tutor…
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-20 sm:py-28 border-t-2 border-black">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-black tracking-tight text-black sm:text-5xl">{t("how.title")}</h2>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="group relative overflow-hidden rounded-none border-2 border-black bg-white p-8 transition-all hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
              >
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-black text-2xl font-black text-white">
                  {n}
                </div>
                <h3 className="text-xl font-bold text-black">{t(`how.step${n}_title`)}</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{t(`how.step${n}_desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED TUTORS */}
      <section id="tutors" className="py-20 sm:py-28 border-t-2 border-black">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-4xl font-black tracking-tight text-black sm:text-5xl">{t("featured.title")}</h2>
              <p className="mt-3 text-lg text-gray-600">{t("featured.subtitle")}</p>
            </div>
            <Button asChild variant="outline" className="font-bold border-2 border-black rounded-none hover:bg-black hover:text-white">
              <Link to="/tutors" onClick={() => blurActive()}>{t("featured.view_all")} <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
          
          {featuredLoading && <p className="mt-10 text-center text-gray-500">{t("common.loading")}</p>}
          {!featuredLoading && featuredTutors.length === 0 && <p className="mt-10 text-center text-gray-500">{t("common.no_tutors_yet")}</p>}
          
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {featuredTutors.map((tut) => (
              <Link
                key={tut.id}
                to="/tutors/$tutorCode"
                params={{ tutorCode: tut.tutor_code }}
                className="block rounded-none border-2 border-black bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
                onClick={() => blurActive()}
              >
                <div className="flex items-center gap-4">
                  {tut.photo_url ? (
                    <img
                      src={tut.photo_url}
                      alt="Tutor"
                      loading="lazy"
                      className="h-14 w-14 shrink-0 rounded-full object-cover grayscale border border-black"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-black text-base font-bold text-white">
                      {tut.tutor_code?.slice(0, 2).toUpperCase() || "TP"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-base font-bold text-black break-words">
                      {tut.tutor_code}{getTutorGenderLabel(tut.gender) ? ` · ${getTutorGenderLabel(tut.gender)}` : ""}
                    </p>
                    <p className="text-sm text-gray-600 truncate">{tut.headline ?? getTutorLessonModeLabel(tut.lesson_mode)}</p>
                  </div>
                </div>
                
                <div className="mt-4 flex flex-wrap gap-2">
                  {tut.subjects.slice(0, 3).map((subject) => (
                    <span key={subject} className="bg-gray-100 border border-black px-2 py-1 text-[11px] font-bold text-black uppercase tracking-wider">
                      {subject}
                    </span>
                  ))}
                  {tut.subjects.length > 3 && (
                    <span className="bg-gray-100 border border-black px-2 py-1 text-[11px] font-bold text-black uppercase tracking-wider">
                      +{tut.subjects.length - 3} more
                    </span>
                  )}
                </div>
                
                {tut.badge && (
                  <div className="mt-4 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 bg-black px-2 py-1 text-[11px] font-bold text-white uppercase tracking-wider">
                      <BadgeCheck className="h-3 w-3" /> {tut.badge}
                    </span>
                  </div>
                )}
                
                <div className="mt-6 flex items-center justify-between border-t-2 border-black pt-4 text-sm">
                  <span className="inline-flex items-center gap-1 font-medium text-black">
                    {tut.lesson_mode === "online" ? <Globe className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                    {getTutorLocationLabel(tut)}
                  </span>
                </div>
                
                <p className="mt-4 text-2xl font-black text-black">
                  HK${tut.hourly_rate}
                  <span className="ml-1 text-sm font-semibold text-gray-500 uppercase tracking-wider">{t("featured.per_hour")}</span>
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="py-20 sm:py-28 border-t-2 border-black bg-black">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div className="max-w-xl">
              <h3 className="text-4xl font-black text-white sm:text-5xl">{t("tutors_cta.title")}</h3>
              <p className="mt-4 text-lg text-gray-300">{t("tutors_cta.subtitle")}</p>
            </div>
            <Button asChild size="lg" className="h-14 rounded-none bg-white px-8 text-base font-bold text-black hover:bg-gray-200">
              <Link to="/become-a-tutor">
                {t("tutors_cta.cta")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}