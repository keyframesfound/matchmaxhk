import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, Sparkles, MessageCircle, Star, Users, GraduationCap, MapPin, BookOpen } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { fetchTopWeeklyTutors } from "@/features/tutors/queries";

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

const trustStats = [
  { key: "students", value: "12,000+", icon: Users },
  { key: "tutors", value: "3,500+", icon: GraduationCap },
  { key: "subjects", value: "80+", icon: BookOpen },
  { key: "districts", value: "18", icon: MapPin },
];


function Landing() {
  const { t } = useTranslation();
  const { data: featuredTutors = [], isLoading: featuredLoading } = useQuery({
    queryKey: ["landing", "featured_tutors"],
    queryFn: () => fetchTopWeeklyTutors(3),
  });



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
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 shrink-0 rounded-full bg-brand-gradient-soft" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">Dr. Michelle Ho</p>
                    <p className="text-xs text-muted-foreground">DSE Mathematics · M2</p>
                  </div>
                  <span className="rounded-full bg-[color:var(--brand-teal)]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[color:var(--brand-teal)]">Matched</span>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl bg-muted/50 p-4 text-center text-xs">
                  <div>
                    <p className="font-bold text-lg text-[color:var(--brand-navy)]">98%</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Match</p>
                  </div>
                  <div>
                    <p className="font-bold text-lg text-[color:var(--brand-navy)]">$650</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">/hr</p>
                  </div>
                  <div>
                    <p className="font-bold text-lg text-[color:var(--brand-navy)]">4.9★</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Rating</p>
                  </div>
                </div>
                <div className="mt-5 space-y-2">
                  {["DSE Math M2", "Kowloon Tong", "Weekday evenings", "10+ years"].map((tag) => (
                    <div key={tag} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <BadgeCheck className="h-3.5 w-3.5 text-[color:var(--brand-teal)]" />
                      {tag}
                    </div>
                  ))}
                </div>
                <button className="mt-6 w-full rounded-xl bg-brand-gradient py-3 text-sm font-bold text-white shadow-teal">
                  <MessageCircle className="mr-2 inline h-4 w-4" /> Contact via tutor code
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-y border-border bg-muted/30 py-10">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 sm:grid-cols-4 sm:px-6">
          {trustStats.map(({ key, value, icon: Icon }) => (
            <div key={key} className="text-center">
              <Icon className="mx-auto h-6 w-6 text-[color:var(--brand-teal)]" />
              <p className="mt-3 text-3xl font-black text-[color:var(--brand-navy)]">{value}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t(`trust.${key}`)}
              </p>
            </div>
          ))}
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
              <div key={tut.id} className="rounded-3xl border border-border bg-card p-6 transition-all hover:shadow-brand">
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
                  </span>
                </div>
                <p className="mt-4 text-2xl font-black text-[color:var(--brand-navy)]">
                  HK${tut.hourly_rate}
                  <span className="ml-1 text-sm font-semibold text-muted-foreground">{t("featured.per_hour")}</span>
                </p>
              </div>

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
            {[
              { key: "math", subject: "Mathematics" },
              { key: "english", subject: "English" },
              { key: "chinese", subject: "Chinese" },
              { key: "physics", subject: "Physics" },
              { key: "chemistry", subject: "Chemistry" },
              { key: "biology", subject: "Biology" },
              { key: "economics", subject: "Economics" },
              { key: "dse", subject: "DSE" },
              { key: "ib", subject: "IB" },
            ].map(({ key, subject }) => (
              <Link
                key={key}
                to="/tutors"
                search={{ subject }}
                className="rounded-2xl border border-border bg-card px-5 py-4 text-center text-sm font-bold text-foreground transition-all hover:-translate-y-0.5 hover:border-[color:var(--brand-teal)] hover:text-[color:var(--brand-teal)] hover:shadow-teal"
              >
                {t(`subjects.${key}`)}
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

      {/* Testimonials */}
      <section className="bg-muted/30 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-center text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">
            {t("testimonials.title")}
          </h2>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <figure key={n} className="rounded-3xl border border-border bg-card p-8">
                <div className="mb-4 flex gap-0.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="h-4 w-4 fill-[color:var(--brand-teal)] text-[color:var(--brand-teal)]" />
                  ))}
                </div>
                <blockquote className="text-base leading-relaxed text-foreground">
                  “{t(`testimonials.t${n}`)}”
                </blockquote>
                <figcaption className="mt-6 text-sm font-bold text-muted-foreground">
                  {t(`testimonials.t${n}_by`)}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
