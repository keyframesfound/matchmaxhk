import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { BadgeCheck, MapPin, Star, MessageCircle, Search } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { fetchPublishedTutors, HK_DISTRICTS } from "@/features/tutors/queries";
import { DEFAULT_SUBJECT_OPTIONS } from "@/features/tutors/subjects";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  subject: z.string().optional(),
  district: z.string().optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/tutors/")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Browse tutors — MatchMax" },
      { name: "description", content: "Browse verified tutors across Hong Kong by subject, district, and rating." },
      { property: "og:title", content: "Browse tutors — MatchMax" },
      { property: "og:description", content: "Verified Hong Kong tutors for DSE, IB, IGCSE, AP and more — filter by subject and district." },
      { property: "og:url", content: "https://maxmatch.app/tutors" },
    ],
    links: [{ rel: "canonical", href: "https://maxmatch.app/tutors" }],
  }),
  component: TutorsDirectory,
});


function TutorsDirectory() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/tutors" });
  const [q, setQ] = useState(search.q ?? "");

  const { data: tutors = [], isLoading } = useQuery({
    queryKey: ["tutors", "published"],
    queryFn: fetchPublishedTutors,
  });

  const { data: subjectOptions = DEFAULT_SUBJECT_OPTIONS } = useQuery({
    queryKey: ["settings", "subject_options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "subject_options")
        .maybeSingle();
      if (error) throw error;
      const v = data?.value;
      if (Array.isArray(v)) {
        const arr = (v as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0);
        if (arr.length > 0) return arr;
      }
      return DEFAULT_SUBJECT_OPTIONS;
    },
  });

  const subjectFilter = (search.subject ?? "").toLowerCase();
  const districtFilter = search.district ?? "";

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return tutors.filter((tut) => {
      if (subjectFilter && !tut.subjects.some((s) => s.toLowerCase().includes(subjectFilter))) return false;
      if (districtFilter && tut.district !== districtFilter) return false;
      if (query && !(
        tut.display_name.toLowerCase().includes(query) ||
        tut.subjects.some((s) => s.toLowerCase().includes(query)) ||
        (tut.headline ?? "").toLowerCase().includes(query)
      )) return false;
      return true;
    });
  }, [tutors, subjectFilter, districtFilter, q]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border bg-muted/30 py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h1 className="text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">Browse tutors</h1>
            <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
              Verified tutors across Hong Kong. Filter by subject, district, or search by name.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_200px_200px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search name, subject, keyword…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <SearchableSelect
                value={search.subject ?? ""}
                onChange={(v) => navigate({ search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, subject: v || undefined }) })}
                options={[{ value: "", label: "Any subject" }, ...subjectOptions.map((s) => ({ value: s, label: s }))]}
                placeholder="Any subject"
                searchPlaceholder="Search subject…"
              />
              <SearchableSelect
                value={search.district ?? ""}
                onChange={(v) => navigate({ search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, district: v || undefined }) })}
                options={[{ value: "", label: "Any district" }, ...HK_DISTRICTS.map((d) => ({ value: d, label: d }))]}
                placeholder="Any district"
                searchPlaceholder="Search district…"
              />
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            {isLoading && <p className="text-center text-muted-foreground">Loading tutors…</p>}
            {!isLoading && filtered.length === 0 && (
              <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
                <p className="text-lg font-bold text-[color:var(--brand-navy)]">No tutors match your filters yet</p>
                <p className="mt-2 text-sm text-muted-foreground">Try widening your search, or check back soon — new tutors are added every week.</p>
                <Button asChild className="mt-6 bg-[color:var(--brand-navy)] font-bold text-white hover:bg-[color:var(--brand-royal)]">
                  <Link to="/auth">Request a tutor</Link>
                </Button>
              </div>
            )}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((tut) => (
                <Link
                  key={tut.id}
                  to="/tutors/$tutorCode"
                  params={{ tutorCode: tut.tutor_code }}
                  className="flex flex-col rounded-3xl border border-border bg-card p-6 transition-all hover:shadow-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-teal)]"
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
                    <div className="mt-4">
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
                  <p className="mt-auto pt-5 text-center text-[11px] text-muted-foreground">Tutor code: {tut.tutor_code}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
