import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, Sparkles, MessageCircle, Star, Users, GraduationCap, MapPin, BookOpen } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { fetchTopWeeklyTutors, fetchLandingStats, fetchTutorByCode, type Tutor } from "@/features/tutors/queries";
import { fetchFeaturedReviews } from "@/features/tutors/reviews";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MatchMax — Hong Kong's tutoring marketplace" },
      { name: "description", content: "⚡️Instantly matching you to the perfect tutor\n🎓IB, IGCSE, DSE, AP Top scorer tutors available" },
      { property: "og:title", content: "MatchMax — Hong Kong's tutoring marketplace" },
      { property: "og:description", content: "⚡️Instantly matching you to the perfect tutor\n🎓IB, IGCSE, DSE, AP Top scorer tutors available" },
    ],
  }),
  component: Landing,
});

const STAT_ICONS = { students: Users, tutors: GraduationCap, subjects: BookOpen, districts: MapPin } as const;

const DEFAULT_POPULAR_SUBJECTS = [
  "Mathematics", "English", "Chinese", "Physics", "Chemistry",
  "Biology", "Economics", "DSE", "IB",
];

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k+`;
  return `${n}`;
}

function Landing() {
  const { t } = useTranslation();
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
  const { data: featuredReviews = [] } = useQuery({
    queryKey: ["landing", "featured_reviews"],
    queryFn: () => fetchFeaturedReviews(3),
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

  const { data: popularSubjects = DEFAULT_POPULAR_SUBJECTS } = useQuery({
    queryKey: ["settings", "popular_subjects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "popular_subjects")
        .maybeSingle();
      if (error) throw error;
      const v = data?.value;
      if (Array.isArray(v)) {
        const arr = (v as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0);
        if (arr.length > 0) return arr;
      }
      return DEFAULT_POPULAR_SUBJECTS;
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



  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
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
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--brand-teal)]/30 bg-[color:var(--brand-teal)]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[color:var(--brand-teal)]">
              <Sparkles className="h-3.5 w-3.5" />
              {t("hero.eyebrow")}
            </span>
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
                <Link to="/auth">
                  {t("hero.cta_primary")}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-14 border-2 px-8 text-base font-bold">
                <Link to="/tutors">{t("hero.cta_secondary")}</Link>
              </Button>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-[color:var(--brand-teal)]" /> Verified tutors</span>
              <span className="inline-flex items-center gap-1.5"><MessageCircle className="h-4 w-4 text-[color:var(--brand-teal)]" /> WhatsApp handoff</span>
              <span className="inline-flex items-center gap-1.5"><Star className="h-4 w-4 text-[color:var(--brand-teal)]" /> No hidden fees</span>
            </div>
          </div>

          {/* Hero visual card */}
          <div className="relative flex items-center justify-center">
            <div className="relative w-full max-w-md">
              <div className="absolute -inset-4 rounded-3xl bg-brand-gradient opacity-20 blur-2xl" aria-hidden />
              <div className="relative rounded-3xl border border-border bg-card p-6 shadow-brand">
                {heroTutor ? (
                  <>
                    <div className="flex items-center gap-3">
                      {heroTutor.photo_url ? (
                        <img
                          src={heroTutor.photo_url}
                          alt={heroTutor.display_name}
                          className="h-11 w-11 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-11 w-11 shrink-0 rounded-full bg-brand-gradient-soft" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">{heroTutor.display_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {heroTutor.headline ?? heroTutor.subjects.slice(0, 3).join(" · ")}
                        </p>
                      </div>
                      <span className="rounded-full bg-[color:var(--brand-teal)]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[color:var(--brand-teal)]">Featured</span>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl bg-muted/50 p-4 text-center text-xs">
                      <div>
                        <p className="font-bold text-lg text-[color:var(--brand-navy)]">{heroTutor.tutor_code}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Code</p>
                      </div>
                      <div>
                        <p className="font-bold text-lg text-[color:var(--brand-navy)]">${heroTutor.hourly_rate}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">/hr</p>
                      </div>
                      <div>
                        <p className="font-bold text-lg text-[color:var(--brand-navy)]">{heroTutor.rating.toFixed(1)}★</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Rating</p>
                      </div>
                    </div>
                    <div className="mt-5 space-y-2">
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
                    <Button asChild className="mt-6 w-full rounded-xl bg-brand-gradient py-3 text-sm font-bold text-white shadow-teal">
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
      <section className="border-y border-border bg-muted/30 py-10">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 sm:grid-cols-4 sm:px-6">
          {trustStats.map(({ key, value }) => {
            const Icon = STAT_ICONS[key];
            return (
              <div key={key} className="text-center">
                <Icon className="mx-auto h-6 w-6 text-[color:var(--brand-teal)]" />
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
            <p className="mt-4 text-lg text-muted-foreground">{t("how.subtitle")}</p>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="group relative rounded-3xl border border-border bg-card p-8 transition-all hover:border-[color:var(--brand-teal)]/40 hover:shadow-brand">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-2xl font-black text-white shadow-teal">
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
      <section id="tutors" className="bg-muted/30 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">{t("featured.title")}</h2>
              <p className="mt-3 text-lg text-muted-foreground">{t("featured.subtitle")}</p>
            </div>
            <Button asChild variant="outline" className="font-bold">
              <Link to="/tutors">{t("featured.view_all")} <ArrowRight className="ml-2 h-4 w-4" /></Link>
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
                className="block rounded-3xl border border-border bg-card p-6 transition-all hover:shadow-brand"
              >
                <div className="flex items-center gap-4">
                  {tut.photo_url ? (
                    <img src={tut.photo_url} alt={tut.display_name} className="h-14 w-14 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="h-14 w-14 shrink-0 rounded-full bg-brand-gradient-soft" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-foreground">{tut.display_name}</p>
                    <p className="truncate text-sm text-muted-foreground">{tut.headline ?? tut.subjects.join(", ")}</p>
                  </div>
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
                    <MapPin className="h-4 w-4" /> {tut.district ?? "HK"}
                  </span>
                  <span className="inline-flex items-center gap-1 font-bold text-foreground">
                    <Star className="h-4 w-4 fill-[color:var(--brand-teal)] text-[color:var(--brand-teal)]" /> {Number(tut.rating).toFixed(1)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">({tut.review_count})</span>
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

      {/* Subjects */}
      <section id="subjects" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">{t("subjects.title")}</h2>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {popularSubjects.map((subject) => (
              <Link
                key={subject}
                to="/tutors"
                search={{ subject }}
                className="rounded-2xl border border-border bg-card px-5 py-4 text-center text-sm font-bold text-foreground transition-all hover:-translate-y-0.5 hover:border-[color:var(--brand-teal)] hover:text-[color:var(--brand-teal)] hover:shadow-teal"
              >
                {subject}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Tutor CTA banner */}
      <section className="pb-20 sm:pb-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-[color:var(--brand-navy)] p-10 sm:p-14">
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

      {/* Reviews */}
      <section className="bg-muted/30 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-center text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">
            {t("testimonials.title")}
          </h2>
          <p className="mt-3 text-center text-muted-foreground">
            Real reviews from parents and students. Admins can add or edit reviews on each tutor's profile.
          </p>
          {featuredReviews.length === 0 ? (
            <p className="mt-14 text-center text-muted-foreground">No reviews yet.</p>
          ) : (
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {featuredReviews.map((r) => (
                <figure key={r.id} className="flex flex-col rounded-3xl border border-border bg-card p-8">
                  <div className="mb-4 flex gap-0.5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < r.rating ? "fill-[color:var(--brand-teal)] text-[color:var(--brand-teal)]" : "text-muted-foreground/30"}`}
                      />
                    ))}
                  </div>
                  <blockquote className="flex-1 text-base leading-relaxed text-foreground">
                    {r.comment ? `“${r.comment}”` : <span className="text-muted-foreground">No comment</span>}
                  </blockquote>
                  <figcaption className="mt-6 text-sm text-muted-foreground">
                    <span className="font-bold text-foreground">{r.author_alias}</span>
                    {r.tutor && (
                      <>
                        {" · "}
                        <Link
                          to="/tutors/$tutorCode"
                          params={{ tutorCode: r.tutor.tutor_code }}
                          className="font-semibold text-[color:var(--brand-teal)] hover:underline"
                        >
                          {r.tutor.display_name}
                        </Link>
                      </>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </section>


      <SiteFooter />
    </div>
  );
}
