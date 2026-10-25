import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Briefcase,
  CalendarClock,
  Download,
  Eye,
  FilePlus2,
  Inbox,
  Loader2,
  PackageCheck,
  Pencil,
  Plus,
  ScanEye,
  ShoppingCart,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/useAuth";
import { SignupChecklistCard } from "@/features/account/signup-checklist";
import {
  formatAvailabilityDate,
  getTutorAvailabilityReadiness,
  getTutorAvailabilityState,
} from "@/features/tutors/tutor-display";
import {
  getMyMaterials,
  setNoteHidden,
  type MyMaterialsRow,
} from "@/features/materials/note-drafts.functions";
import { getBoughtMaterials } from "@/features/materials/checkout.functions";
import { getOwnedMaterialUrl } from "@/features/materials/orders.functions";
import { gigDeliveryLabelKey, MAX_GIG_FILE_BYTES } from "@/features/gigs/gig";
import { getMyGigs, type MyGigRow } from "@/features/gigs/gig-drafts.functions";
import {
  getMyGigOrders,
  deliverGigOrder,
  getGigBuyerSourceUrl,
  type MyGigOrderRow,
} from "@/features/gigs/gig-fulfillment.functions";
import { fileToBase64 } from "@/features/gigs/gig-files";

/**
 * Epic #280 P6: Account is the store page, Carousell order. Top is identity
 * and rating; below, the public profile in blocks (each with its Edit link);
 * then the marketplace blocks (P8 notes, P13 bought) and the parent's cases.
 * Saved waits for P10; reviews they wrote wait for P7/#205.
 */

export const Route = createFileRoute("/_authenticated/account")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Account | MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: AccountPage,
});

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-500/10 text-muted-foreground",
  pending_review: "bg-amber-500/10 text-amber-700",
  published: "bg-emerald-500/10 text-emerald-700",
  hidden: "bg-slate-500/10 text-muted-foreground",
  rejected: "bg-[#F4212E]/10 text-destructive",
};

const CASE_STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-700",
  matched: "bg-emerald-500/10 text-emerald-700",
  closed: "bg-slate-500/10 text-muted-foreground",
  rejected: "bg-[#F4212E]/10 text-destructive",
};

const CASE_STATUS_KEY: Record<string, string> = {
  pending: "account.case_status_pending",
  matched: "account.case_status_matched",
  closed: "account.case_status_closed",
  rejected: "account.case_status_rejected",
};

const MY_TUTOR_BLOCK_COLS =
  "id, display_name, tutor_code, photo_url, rating, review_count, hourly_rate, pricing_tiers, currency, subjects, self_introduction, lesson_mode, verification_tier, remaining_student_slots, is_accepting_students, start_immediately, earliest_start_date, is_published";

/** P6 identity/profile block row, a slice of the tutors table (owner read). */
type MyTutorCard = {
  id: string;
  display_name: string;
  tutor_code: string;
  photo_url: string | null;
  rating: number | null;
  review_count: number | null;
  hourly_rate: number;
  pricing_tiers: unknown;
  currency: string | null;
  subjects: string[] | null;
  self_introduction: string | null;
  lesson_mode: "online" | "in_person" | "either";
  verification_tier: string | null;
  remaining_student_slots: number | null;
  is_accepting_students: boolean | null;
  start_immediately: boolean | null;
  earliest_start_date: string | null;
  is_published: boolean;
};

type MyCaseRow = {
  id: string;
  title: string;
  subjects: string[] | null;
  status: string;
  created_at: string;
};

function AccountPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const materialsQuery = useQuery({
    queryKey: ["account", "my-materials", user?.id],
    queryFn: () => getMyMaterials(),
    enabled: Boolean(user),
  });

  const boughtQuery = useQuery({
    queryKey: ["account", "bought", user?.id],
    queryFn: () => getBoughtMaterials(),
    enabled: Boolean(user),
  });

  // Freestyle gigs (#326/#328): my service listings + orders waiting on me.
  const gigsQuery = useQuery({
    queryKey: ["account", "my-gigs", user?.id],
    queryFn: () => getMyGigs(),
    enabled: Boolean(user),
  });

  const gigOrdersQuery = useQuery({
    queryKey: ["account", "my-gig-orders", user?.id],
    queryFn: () => getMyGigOrders(),
    enabled: Boolean(user),
  });

  // P6: the signed-in account's own card (RLS tutors_owner_select, includes
  // an unpublished card, so the owner still sees it here).
  const myTutorQuery = useQuery({
    queryKey: ["account", "my-tutor-card", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutors")
        .select(MY_TUTOR_BLOCK_COLS)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as MyTutorCard | null) ?? null;
    },
    enabled: Boolean(user),
  });

  // P6 parent block: cases this account created (guest legacy rows have no
  // parent_id, they stay on the concierge path).
  const myCasesQuery = useQuery({
    queryKey: ["account", "my-cases", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutoring_cases")
        .select("id, title, subjects, status, created_at")
        .eq("parent_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data as MyCaseRow[]) ?? [];
    },
    enabled: Boolean(user),
  });

  const hideMutation = useMutation({
    mutationFn: (input: { materialId: string; hidden: boolean }) => setNoteHidden({ data: input }),
    onSuccess: () => {
      toast.success(t("account.notes_updated"));
      void queryClient.invalidateQueries({ queryKey: ["account", "my-materials"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("account.notes_update_failed")),
  });

  const downloadMutation = useMutation({
    mutationFn: (materialId: string) => getOwnedMaterialUrl({ data: { materialId } }),
    onSuccess: (result) => window.open(result.signedUrl, "_blank", "noopener"),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("orders.download_failed")),
  });

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">{t("orders.sign_in_required")}</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const tutor = myTutorQuery.data;
  const materials: MyMaterialsRow[] = materialsQuery.data ?? [];
  const bought = boughtQuery.data ?? [];
  const cases = myCasesQuery.data ?? [];
  const gigs: MyGigRow[] = gigsQuery.data ?? [];
  const gigOrders: MyGigOrderRow[] = gigOrdersQuery.data ?? [];
  const parentName =
    (user.user_metadata?.name as string | undefined) ?? user.email?.split("@")[0] ?? "";
  const availabilityState = tutor ? getTutorAvailabilityState(tutor) : null;
  const readiness =
    tutor != null
      ? getTutorAvailabilityReadiness({
          start_immediately: tutor.start_immediately,
          earliest_start_date: tutor.earliest_start_date,
        })
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-normal">{t("account.title")}</h1>

        {/* #141: post-signup checklist, first block, dismissible, hidden once done */}
        <SignupChecklistCard />

        {/* P6: identity + rating, the store header */}
        <section className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5">
          {tutor?.photo_url ? (
            <img
              src={tutor.photo_url}
              alt=""
              className="h-16 w-16 rounded-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[color:var(--foreground)]/15 bg-[color:var(--foreground)]/[0.04] text-xl font-semibold text-[color:var(--muted-foreground)]">
              {(tutor?.display_name ?? parentName).slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold text-[color:var(--ink)]">
              {tutor?.display_name ?? parentName}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {tutor ? <span>{tutor.tutor_code}</span> : null}
              {tutor ? (
                (tutor.review_count ?? 0) > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                    {Number(tutor.rating ?? 0).toFixed(1)} ·{" "}
                    {t("account.reviews_count", { count: tutor.review_count ?? 0 })}
                  </span>
                ) : (
                  <span className="font-semibold text-[color:var(--ink)]">
                    {t("account.new_label")}
                  </span>
                )
              ) : null}
              {availabilityState && availabilityState !== "taking" ? (
                <span className="rounded-md bg-[color:var(--ink)]/[0.06] px-2 py-0.5 text-xs font-bold text-[color:var(--ink)]">
                  {availabilityState === "full"
                    ? t("account.state_full")
                    : t("account.state_inactive")}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tutor ? (
              <Button variant="outline" className="font-semibold" asChild>
                <Link
                  to="/tutors/$tutorCode"
                  params={{ tutorCode: tutor.tutor_code }}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Eye className="mr-2 h-4 w-4" aria-hidden />
                  {t("account.view_public")}
                </Link>
              </Button>
            ) : null}
            {/* Issue #104: guided Preview-as-Parent sandbox. */}
            {tutor ? (
              <Button variant="outline" className="font-semibold" asChild>
                <Link to="/account/preview">
                  <ScanEye className="mr-2 h-4 w-4" aria-hidden />
                  {t("account.preview_cta")}
                </Link>
              </Button>
            ) : null}
            <Button variant="outline" className="font-semibold" asChild>
              <a href="/settings">
                <Pencil className="mr-2 h-4 w-4" aria-hidden />
                {t("account.edit_profile")}
              </a>
            </Button>
          </div>
        </section>

        {/* P6: parent CTA, no card linked yet */}
        {!tutor && !myTutorQuery.isLoading ? (
          <section className="mt-6 rounded-2xl border border-dashed border-border bg-card p-6">
            <p className="text-sm font-semibold text-[color:var(--ink)]">
              {t("account.tutor_cta_title")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{t("account.tutor_cta_body")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="solid" color="blue" className="font-bold" asChild>
                <a href="/join">{t("account.become_tutor")}</a>
              </Button>
            </div>
          </section>
        ) : null}

        {/* P6 tutor block: the public profile summary */}
        {tutor ? (
          <section className="mt-8 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">{t("account.profile_block")}</h2>
              <Button variant="ghost" size="sm" className="font-semibold" asChild>
                <a href="/settings#my-tutor">
                  <Pencil className="mr-2 h-4 w-4" aria-hidden />
                  {t("account.edit")}
                </a>
              </Button>
            </div>
            <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-muted-foreground">
                  {t("account.block_rate")}
                </dt>
                <dd className="mt-0.5 font-semibold text-[color:var(--ink)]">
                  {t("notes.price", { amount: tutor.hourly_rate })}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted-foreground">
                  {t("account.block_subjects")}
                </dt>
                <dd className="mt-0.5 font-semibold text-[color:var(--ink)]">
                  {(tutor.subjects ?? []).slice(0, 5).join(", ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted-foreground">
                  {t("settings.my_tutor.lesson_mode")}
                </dt>
                <dd className="mt-0.5 font-semibold text-[color:var(--ink)]">
                  {tutor.lesson_mode === "online"
                    ? t("settings.my_tutor.mode_online")
                    : tutor.lesson_mode === "in_person"
                      ? t("settings.my_tutor.mode_in_person")
                      : t("settings.my_tutor.mode_either")}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted-foreground">
                  {t("account.block_bio")}
                </dt>
                <dd className="mt-0.5 line-clamp-2 text-[color:var(--ink)]">
                  {tutor.self_introduction || "—"}
                </dd>
              </div>
            </dl>
          </section>
        ) : null}

        {/* P6 tutor block: status + capacity */}
        {tutor ? (
          <section className="mt-6 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <CalendarClock className="h-5 w-5" aria-hidden />
                {t("account.status_block")}
              </h2>
              <Button variant="ghost" size="sm" className="font-semibold" asChild>
                <a href="/settings#availability">
                  <Pencil className="mr-2 h-4 w-4" aria-hidden />
                  {t("account.edit")}
                </a>
              </Button>
            </div>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[color:var(--ink)]">
              <span className="font-semibold">
                {availabilityState === "taking"
                  ? t("account.state_taking")
                  : availabilityState === "full"
                    ? t("account.state_full")
                    : t("account.state_inactive")}
              </span>
              {availabilityState === "taking" ? (
                <span className="text-muted-foreground">
                  {t("account.slots_left", { count: tutor.remaining_student_slots ?? 0 })}
                </span>
              ) : null}
              {readiness === "pre_booking" && tutor.earliest_start_date ? (
                <span className="text-muted-foreground">
                  {t("settings.availability.status_pre_booking", {
                    date: formatAvailabilityDate(tutor.earliest_start_date, i18n.language),
                  })}
                </span>
              ) : null}
            </p>
          </section>
        ) : null}

        {/* My notes (tutor side, P8), drafts included */}
        <section className="mt-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <BookOpen className="h-5 w-5" aria-hidden />
              {t("account.my_notes")}
            </h2>
            <Button variant="outline" className="font-semibold" asChild>
              <a href="/account/notes/new">
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                {t("account.add_note")}
              </a>
            </Button>
          </div>

          {materialsQuery.isLoading ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-border bg-card">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : materials.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center">
              <FilePlus2 className="h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">{t("account.no_notes")}</p>
              <Button variant="solid" color="accent" className="font-bold" asChild>
                <a href="/account/notes/new">
                  <Plus className="mr-2 h-4 w-4" aria-hidden />
                  {t("account.add_note")}
                </a>
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {materials.map((material) => (
                <li
                  key={material.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{material.title}</p>
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[material.status] ?? "bg-slate-500/10 text-muted-foreground"}`}
                      >
                        {t(`account.status_${material.status}`)}
                      </span>
                      {material.editStatus === "pending_review" && (
                        <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-700">
                          {t("account.edit_pending")}
                        </span>
                      )}
                    </div>
                    {material.status === "rejected" && material.rejectionReason && (
                      <p className="mt-1 text-xs text-destructive">
                        {t("account.rejection_reason", { reason: material.rejectionReason })}
                      </p>
                    )}
                    <p className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{t("notes.price", { amount: material.priceHkd })}</span>
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" aria-hidden />
                        {material.viewCount}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ShoppingCart className="h-3 w-3" aria-hidden />
                        {material.soldCount}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" aria-label={t("account.edit_note")} asChild>
                      <a href={`/account/notes/${material.id}/edit`}>
                        <Pencil className="h-4 w-4" aria-hidden />
                      </a>
                    </Button>
                    {(material.status === "published" || material.status === "hidden") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={
                          material.status === "published"
                            ? t("account.hide_note")
                            : t("account.unhide_note")
                        }
                        onClick={() =>
                          hideMutation.mutate({
                            materialId: material.id,
                            hidden: material.status === "published",
                          })
                        }
                      >
                        <Eye className="h-4 w-4" aria-hidden />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Freestyle gigs (tutor side, #326/#328), my services + fulfillment */}
        <section className="mt-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Briefcase className="h-5 w-5" aria-hidden />
              {t("account.my_services")}
            </h2>
            <Button variant="outline" className="font-semibold" asChild>
              <a href="/account/services/new">
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                {t("account.add_service")}
              </a>
            </Button>
          </div>

          {gigsQuery.isLoading ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-border bg-card">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : gigs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center">
              <FilePlus2 className="h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">{t("account.no_services")}</p>
              <Button variant="solid" color="accent" className="font-bold" asChild>
                <a href="/account/services/new">
                  <Plus className="mr-2 h-4 w-4" aria-hidden />
                  {t("account.add_service")}
                </a>
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {gigs.map((gig) => (
                <li
                  key={gig.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{gig.title}</p>
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[gig.status] ?? "bg-slate-500/10 text-muted-foreground"}`}
                      >
                        {t(`account.status_${gig.status}`)}
                      </span>
                    </div>
                    {gig.status === "rejected" && gig.rejectionReason && (
                      <p className="mt-1 text-xs text-destructive">
                        {t("account.rejection_reason", { reason: gig.rejectionReason })}
                      </p>
                    )}
                    <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{t("notes.price", { amount: gig.priceHkd })}</span>
                      {gig.deliveryType ? (
                        <span>{t(gigDeliveryLabelKey(gig.deliveryType))}</span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t("account.edit_service")}
                      asChild
                    >
                      <a href={`/account/services/${gig.id}/edit`}>
                        <Pencil className="h-4 w-4" aria-hidden />
                      </a>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* #328: open orders waiting on this tutor (swept server-side). */}
          {gigOrders.length > 0 ? (
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <PackageCheck className="h-4 w-4" aria-hidden />
                {t("account.orders_to_fulfill")}
              </h3>
              {gigOrdersQuery.isLoading ? (
                <div className="flex h-24 items-center justify-center rounded-xl border border-border bg-card">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
                </div>
              ) : (
                <ul className="space-y-3">
                  {gigOrders.map((order) => (
                    <GigFulfillRow key={order.orderId} order={order} />
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </section>

        {/* P6 parent block: my cases */}
        <section className="mt-12 space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Inbox className="h-5 w-5" aria-hidden />
            {t("account.cases_block")}
          </h2>
          {myCasesQuery.isLoading ? (
            <div className="flex h-24 items-center justify-center rounded-xl border border-border bg-card">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : cases.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              {t("account.no_cases")}{" "}
              <Link
                to="/tutor-requests"
                search={{ post: true }}
                className="text-[color:var(--brand-link)] hover:underline"
              >
                {t("account.create_case")}
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {cases.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{row.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {(row.subjects ?? []).join(", ")} ·{" "}
                      {new Date(row.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${CASE_STATUS_BADGE[row.status] ?? "bg-slate-500/10 text-muted-foreground"}`}
                  >
                    {t(CASE_STATUS_KEY[row.status] ?? "account.case_status_other")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Bought (parent side, P13) */}
        <section className="mt-12 space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Download className="h-5 w-5" aria-hidden />
            {t("account.bought")}
          </h2>
          {boughtQuery.isLoading ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-border bg-card">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : bought.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              {t("account.no_bought")}{" "}
              <Link
                to="/tutors"
                search={{ view: "materials" }}
                className="text-[color:var(--brand-link)] hover:underline"
              >
                {t("account.browse_notes")}
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {bought.map((row) => (
                <li
                  key={row.orderId}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{row.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(row.createdAt).toLocaleDateString()}
                      {" · "}
                      {t("notes.price", { amount: row.grossHkd })}
                    </p>
                  </div>
                  {row.action === "download" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="font-semibold"
                      disabled={downloadMutation.isPending}
                      onClick={() => downloadMutation.mutate(row.materialId)}
                    >
                      {downloadMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Download className="mr-2 h-4 w-4" aria-hidden />
                      )}
                      {t("orders.download_button")}
                    </Button>
                  )}
                  {row.action === "refunded" && (
                    <span className="rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-700">
                      {t("orders.refunded_badge")}
                    </span>
                  )}
                  {row.action === "preparing" && (
                    <span className="rounded-md bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
                      {t("orders.preparing_badge")}
                    </span>
                  )}
                  {row.action === "awaiting_delivery" && (
                    <span className="rounded-md bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
                      {t("account.order_awaiting_delivery")}
                    </span>
                  )}
                  {row.action === "request_refund" && (
                    <Link
                      to="/orders/$orderId"
                      params={{ orderId: row.orderId }}
                      className="text-xs font-semibold text-rose-600 hover:underline"
                    >
                      {t("account.order_past_due")}
                    </Link>
                  )}
                  {row.action === "pay" && (
                    <Link
                      to="/orders/$orderId"
                      params={{ orderId: row.orderId }}
                      className="text-xs font-semibold text-[color:var(--brand-link)] hover:underline"
                    >
                      {t("account.finish_payment")}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

/**
 * #328: one open gig order with its delivery action, file_back uploads a
 * return file (PDF/DOCX); session/package mark complete with an optional
 * note. Buyer identity never appears here (the server fn never returns it).
 */
function GigFulfillRow({ order }: { order: MyGigOrderRow }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const isFileBack = order.deliveryType === "file_back";
  const fileTooLarge = file != null && file.size > MAX_GIG_FILE_BYTES;

  // #328 file_back: the tutor must be able to READ the buyer's source
  // before annotating it (grok re-review 2026-10-17: upload-only flow).
  const sourceUrl = useMutation({
    mutationFn: () => getGigBuyerSourceUrl({ data: { orderId: order.orderId } }),
    onSuccess: (result) => window.open(result.signedUrl, "_blank", "noopener"),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("account.source_file_unavailable")),
  });

  const deliver = useMutation({
    mutationFn: async () => {
      const base64 = file ? await fileToBase64(file) : undefined;
      return deliverGigOrder({
        data: {
          orderId: order.orderId,
          completionNote: isFileBack ? undefined : note.trim() || undefined,
          base64Data: base64,
          fileName: file?.name,
        },
      });
    },
    onSuccess: () => {
      toast.success(t("account.fulfill_done"));
      void queryClient.invalidateQueries({ queryKey: ["account", "my-gig-orders"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("account.fulfill_failed")),
  });

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold">{order.title}</p>
            {order.status === "past_due" ? (
              <span className="rounded-md bg-[#F4212E]/10 px-2 py-0.5 text-xs font-bold text-destructive">
                {t("account.order_past_due")}
              </span>
            ) : (
              <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-700">
                {t("account.order_awaiting_delivery")}
              </span>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {order.deliveryType ? <span>{t(gigDeliveryLabelKey(order.deliveryType))}</span> : null}
            <span>{t("notes.price", { amount: order.grossHkd })}</span>
            {order.fulfillmentDueAt ? (
              <span>
                {t("account.order_due", {
                  date: new Date(order.fulfillmentDueAt).toLocaleDateString(),
                })}
              </span>
            ) : null}
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-2 border-t border-border pt-3">
        {isFileBack ? (
          <div className="space-y-1.5">
            {order.hasSourceFile ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="font-semibold"
                disabled={sourceUrl.isPending}
                onClick={() => sourceUrl.mutate()}
              >
                {sourceUrl.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Download className="mr-2 h-4 w-4" aria-hidden />
                )}
                {t("account.source_file_download")}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">{t("account.source_file_waiting")}</p>
            )}
            <Label htmlFor={`return-file-${order.orderId}`}>{t("account.return_file_label")}</Label>
            <Input
              id={`return-file-${order.orderId}`}
              type="file"
              accept=".pdf,.docx"
              className="h-11 cursor-pointer"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {fileTooLarge ? (
              <p className="text-xs text-destructive">{t("gigs.form.return_too_large")}</p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor={`completion-note-${order.orderId}`}>
              {t("account.fulfillment_note_label")}
            </Label>
            <Input
              id={`completion-note-${order.orderId}`}
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("account.fulfillment_note_placeholder")}
              className="h-11"
            />
          </div>
        )}
        <div>
          <Button
            variant="outline"
            className="font-semibold"
            disabled={deliver.isPending || fileTooLarge || (isFileBack && !file)}
            onClick={() => deliver.mutate()}
          >
            {deliver.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {isFileBack ? t("account.fulfill_deliver") : t("account.fulfill_complete")}
          </Button>
        </div>
      </div>
    </li>
  );
}
