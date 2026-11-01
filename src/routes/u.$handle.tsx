import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  BookOpen,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  MessageSquareQuote,
  Sprout,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getChannelMaterials,
  getChannelProfile,
  getChannelReviews,
  requestAffiliation,
} from "@/features/channels/channel.functions";

export const Route = createFileRoute("/u/$handle")({
  ssr: false,
  head: ({ params }) => ({
    meta: [
      { title: `@${params.handle} | MatchMax Channel` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChannelProfilePage,
});

const monthFmt = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });
const monthFmtZh = new Intl.DateTimeFormat("zh-HK", { year: "numeric", month: "long" });

/**
 * #548: the unified Channel Profile. Owner mode renders the same public
 * layout with an edit-mode bar; private data (contact, FPS, children) never
 * enters this page's data.
 */
function ChannelProfilePage() {
  const { handle } = Route.useParams();
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<"overview" | "materials" | "reviews">("overview");
  const [editMode, setEditMode] = useState(false);
  const [affiliationSlug, setAffiliationSlug] = useState("");

  const profileQuery = useQuery({
    queryKey: ["channel", handle],
    queryFn: () => getChannelProfile({ data: { handle } }),
  });
  const materialsQuery = useQuery({
    queryKey: ["channel-materials", handle],
    queryFn: () => getChannelMaterials({ data: { handle } }),
    enabled: tab === "materials",
  });
  const reviewsQuery = useQuery({
    queryKey: ["channel-reviews", handle],
    queryFn: () => getChannelReviews({ data: { handle } }),
    enabled: tab === "reviews",
  });

  const requestAffil = useMutationSafe(() => requestAffiliation, handle, affiliationSlug);

  const data = profileQuery.data;

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
      <SiteHeader />
      <PageContainer>
        {profileQuery.isLoading ? (
          <div className="space-y-4 py-6">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : !data?.found ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("channel.not_found")}
          </p>
        ) : (
          <div className="mx-auto w-full max-w-4xl space-y-6 py-4">
            {/* Owner bar */}
            {data.isOwner && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2.5">
                <p className="text-sm text-muted-foreground">{t("channel.owner_viewing")}</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditMode((v) => !v)}>
                    {editMode ? (
                      <EyeOff className="mr-1.5 h-4 w-4" aria-hidden />
                    ) : (
                      <Eye className="mr-1.5 h-4 w-4" aria-hidden />
                    )}
                    {editMode ? t("channel.view_public") : t("channel.edit_mode")}
                  </Button>
                  <Link
                    to="/dashboard"
                    className="rounded-lg border border-[color:var(--ink)]/15 px-3 py-1.5 text-sm font-medium text-[color:var(--ink)] hover:bg-[color:var(--foreground)]/[0.04]"
                  >
                    {t("channel.edit_settings")}
                  </Link>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5">
              {data.avatarUrl ? (
                <img src={data.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[color:var(--foreground)]/15 bg-[color:var(--foreground)]/[0.04] text-xl font-semibold text-[color:var(--muted-foreground)]">
                  {data.displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-lg font-bold text-[color:var(--ink)]">
                  {data.displayName}
                  {data.blueTick && (
                    <span className="inline-flex items-center gap-1 text-[color:var(--brand-link)]">
                      <BadgeCheck className="h-5 w-5" aria-hidden />
                      <span className="text-xs font-semibold">{t("channel.blue_tick")}</span>
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  @{data.handle} ·{" "}
                  {t("channel.joined", {
                    date: i18n.language.startsWith("zh")
                      ? monthFmtZh.format(new Date(data.joinedAt ?? Date.now()))
                      : monthFmt.format(new Date(data.joinedAt ?? Date.now())),
                  })}
                  {data.tutorCode ? ` · ${data.tutorCode}` : ""}
                </p>
                {data.affiliations.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {data.affiliations.map((a) => (
                      <Link
                        key={a.id}
                        to="/business/$slug"
                        params={{ slug: a.centreSlug }}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-[color:var(--ink)] hover:bg-[color:var(--foreground)]/[0.04]"
                      >
                        🏛{" "}
                        {a.roleType === "affiliated_tutor"
                          ? t("channel.affiliated_tutor", { centre: a.centreName })
                          : t("channel.alumni_student", { centre: a.centreName })}
                      </Link>
                    ))}
                  </p>
                )}
                {data.headline && (
                  <p className="mt-1.5 text-sm text-[color:var(--ink)]">{data.headline}</p>
                )}
              </div>
              {data.isPublished && data.tutorCode && !data.isOwner && (
                <Button asChild>
                  <a href={`/tutor-requests?tutor=${data.tutorCode}`}>
                    {t("channel.request_lesson")}
                  </a>
                </Button>
              )}
            </div>

            {/* Stats ribbon */}
            {data.stats && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatChip
                  icon={<Clock className="h-4 w-4" aria-hidden />}
                  value={`${data.stats.verifiedHours}`}
                  label={t("channel.stat_hours")}
                />
                <StatChip
                  icon={<Users className="h-4 w-4" aria-hidden />}
                  value={`${data.stats.activeStudents}`}
                  label={t("channel.stat_students")}
                />
                <StatChip
                  icon={<BookOpen className="h-4 w-4" aria-hidden />}
                  value={`${data.stats.materialsCount}`}
                  label={t("channel.stat_materials")}
                />
                <StatChip
                  icon={<MessageSquareQuote className="h-4 w-4" aria-hidden />}
                  value={
                    data.stats.avgRating !== null
                      ? `${data.stats.avgRating} ★`
                      : `${data.stats.reviewsCount}`
                  }
                  label={t("channel.stat_reviews")}
                />
              </div>
            )}

            {/* Pro-Bono & Impact card */}
            {data.proBono && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.05] p-5">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-[color:var(--ink)]">
                    <Sprout className="h-4 w-4 text-emerald-600" aria-hidden />
                    {t("channel.probono_title")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {data.proBono.acceptsProBono && data.proBono.acceptsReducedRate
                      ? t("channel.probono_both", {
                          rate: data.proBono.reducedHourlyRateHkd ?? 0,
                        })
                      : data.proBono.acceptsProBono
                        ? t("channel.probono_free")
                        : t("channel.probono_reduced", {
                            rate: data.proBono.reducedHourlyRateHkd ?? 0,
                          })}
                  </p>
                  <p className="mt-1 text-sm font-medium text-emerald-700">
                    {data.proBono.activeProBonoCases >= data.proBono.maxSlots
                      ? t("channel.probono_full", {
                          active: data.proBono.activeProBonoCases,
                          max: data.proBono.maxSlots,
                        })
                      : t("channel.probono_open", {
                          active: data.proBono.activeProBonoCases,
                          max: data.proBono.maxSlots,
                          open: data.proBono.maxSlots - data.proBono.activeProBonoCases,
                        })}
                  </p>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 border-b border-border pb-px">
              {(
                [
                  ["overview", t("channel.tab_overview")],
                  ["materials", t("channel.tab_materials")],
                  ["reviews", t("channel.tab_reviews")],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "rounded-t-lg px-4 py-2 text-sm font-medium transition-colors",
                    tab === key
                      ? "border-x border-t border-border bg-card text-[color:var(--ink)]"
                      : "text-muted-foreground hover:text-[color:var(--ink)]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "overview" && (
              <OverviewTab
                data={data}
                editMode={editMode}
                affiliationSlug={affiliationSlug}
                setAffiliationSlug={setAffiliationSlug}
                requestAffil={requestAffil}
              />
            )}
            {tab === "materials" && (
              <ul className="space-y-2">
                {(materialsQuery.data ?? []).map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[color:var(--ink)]">
                        {m.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.material_type ?? "pdf"}
                        {m.subject ? ` · ${m.subject}` : ""}
                      </p>
                    </div>
                    <Link
                      to="/notes/$slug"
                      params={{ slug: m.id }}
                      className="shrink-0 text-sm font-semibold text-[color:var(--brand-link)] hover:underline"
                    >
                      HK${Number(m.price_hkd ?? 0).toFixed(0)}
                    </Link>
                  </li>
                ))}
                {!materialsQuery.isLoading && (materialsQuery.data ?? []).length === 0 && (
                  <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {t("channel.materials_empty")}
                  </p>
                )}
              </ul>
            )}
            {tab === "reviews" && (
              <ul className="space-y-2">
                {(reviewsQuery.data ?? []).map((r) => (
                  <li key={r.id} className="rounded-xl border border-border bg-card p-4">
                    <p className="text-sm font-semibold text-[color:var(--ink)]">
                      {"★".repeat(r.rating)}
                      <span className="text-muted-foreground">{"★".repeat(5 - r.rating)}</span>
                    </p>
                    {r.comment && (
                      <p className="mt-1 text-sm text-[color:var(--ink)]">{r.comment}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.name ?? t("channel.anonymous")} ·{" "}
                      {new Date(r.createdAt).toLocaleDateString(i18n.language)}
                    </p>
                  </li>
                ))}
                {!reviewsQuery.isLoading && (reviewsQuery.data ?? []).length === 0 && (
                  <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {t("channel.reviews_empty")}
                  </p>
                )}
              </ul>
            )}
          </div>
        )}
      </PageContainer>
      <SiteFooter />
    </div>
  );
}

function useMutationSafe<T>(
  factory: () => typeof requestAffiliation,
  _handle: string,
  slug: string,
): { mutate: () => void; pending: boolean } {
  const [pending, setPending] = useState(false);
  return {
    pending,
    mutate: () => {
      if (!slug) return;
      setPending(true);
      void (async () => {
        try {
          await factory()({ data: { centreSlug: slug, roleType: "affiliated_tutor" } });
          toast.success("Affiliation requested");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Failed");
        } finally {
          setPending(false);
        }
      })();
    },
  };
}

function StatChip({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3.5">
      <span className="text-muted-foreground">{icon}</span>
      <span>
        <span className="block text-base font-bold text-[color:var(--ink)]">{value}</span>
        <span className="block text-xs text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

function OverviewTab({
  data,
  editMode,
  affiliationSlug,
  setAffiliationSlug,
  requestAffil,
}: {
  data: NonNullable<Awaited<ReturnType<typeof getChannelProfile>>>;
  editMode: boolean;
  affiliationSlug: string;
  setAffiliationSlug: (v: string) => void;
  requestAffil: { mutate: () => void; pending: boolean };
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-[color:var(--ink)]">
          {t("channel.subjects_title")}
        </h2>
        {data.subjects.length > 0 ? (
          <p className="mt-2 flex flex-wrap gap-1.5">
            {data.subjects.map((s) => (
              <span
                key={s}
                className="rounded-full border border-border px-2.5 py-0.5 text-xs text-[color:var(--ink)]"
              >
                {s}
              </span>
            ))}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{t("channel.subjects_empty")}</p>
        )}
        {data.hourlyRate !== null && (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("channel.rate_prefix")} HK${data.hourlyRate}
            {data.minHourlyRateHkd !== null && data.minHourlyRateHkd !== data.hourlyRate
              ? ` · ${t("channel.rate_from")} HK${data.minHourlyRateHkd}`
              : ""}
          </p>
        )}
      </div>

      {/* #548 owner edit-mode block: affiliation request */}
      {editMode && data.isOwner && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-[color:var(--ink)]">
            {t("channel.affiliation_title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("channel.affiliation_hint")}</p>
          <div className="mt-2 flex gap-2">
            <Input
              value={affiliationSlug}
              onChange={(e) => setAffiliationSlug(e.target.value)}
              placeholder="centre-slug"
              className="max-w-xs"
            />
            <Button
              variant="outline"
              disabled={requestAffil.pending || !affiliationSlug}
              onClick={requestAffil.mutate}
            >
              {requestAffil.pending && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
              )}
              {t("channel.affiliation_request")}
            </Button>
          </div>
        </div>
      )}

      {/* Public Education CV (#545 visibility=public_tutor) */}
      {data.publicRecords.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-[color:var(--ink)]">
            {t("channel.public_cv")}
          </h2>
          <ul className="mt-3 space-y-2">
            {data.publicRecords.map((r) => (
              <li key={r.id} className="text-sm text-[color:var(--ink)]">
                <span className="font-semibold">{r.title_or_program}</span> ·{" "}
                {r.institution_or_issuer}
                <span className="text-muted-foreground">
                  {" "}
                  {r.start_year ?? ""}
                  {r.is_current ? "–" : r.end_year ? `–${r.end_year}` : ""}
                  {r.grades_or_results ? ` · ${r.grades_or_results}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {editMode && data.isOwner && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          {t("channel.edit_hint")}
        </p>
      )}
    </div>
  );
}
