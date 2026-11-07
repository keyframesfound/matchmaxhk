import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatPostedAgo } from "@/lib/relative-time";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  Bell,
  CalendarClock,
  CalendarX,
  CheckCheck,
  Inbox,
  Package,
  Star,
  Wallet,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/features/i18n/config";
import { cn } from "@/lib/utils";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyBell, markNotificationsRead, type BellItem } from "@/features/cases/bus.functions";
import { completeMyAction, dismissMyAction } from "@/features/cases/action-required.functions";

export const Route = createFileRoute("/_authenticated/notifications")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Notifications | MatchMax" },
      { name: "description", content: "Your MatchMax notifications." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificationsPage,
});

type PageFilter = "all" | "action" | "unread" | "cases" | "schedule" | "ratings" | "account";

/**
 * #671: one pipeline, grouped views — every consumer (schedule changes,
 * request status, ratings, statements, demand-side, account actions) lands
 * in the SAME bell, so the inbox groups by family instead of by feature.
 */
function eventGroup(eventType: string): Exclude<PageFilter, "all" | "action" | "unread"> {
  if (eventType.startsWith("lesson.") || eventType.startsWith("billing.")) return "schedule";
  if (eventType.startsWith("review.") || eventType === "lesson.review_prompt") return "ratings";
  if (eventType.startsWith("action.")) return "account";
  return "cases";
}

function bellIcon(eventType: string) {
  if (eventType === "note_order.delivered") return Package;
  if (eventType === "review.published" || eventType === "lesson.review_prompt") return Star;
  if (eventType.startsWith("lesson.cancelled")) return CalendarX;
  if (eventType.startsWith("lesson.scheduled") || eventType === "lesson.reminder_due")
    return CalendarClock;
  if (eventType.startsWith("admin_fee")) return Wallet;
  if (
    eventType.startsWith("action.") ||
    eventType.startsWith("verification.") ||
    eventType === "case.lead_new" ||
    eventType.startsWith("intro.shared") ||
    eventType === "material.rejected" ||
    eventType === "content.rejected" ||
    eventType === "report.filed"
  )
    return AlertCircle;
  return Bell;
}

function bellLabelKey(item: BellItem): string {
  switch (item.event_type) {
    case "note_order.draft_needed":
      return "sor.bell_draft_needed";
    case "note_order.delivered":
      return item.role_hint === "tutor" ? "sor.bell_note_sold" : "sor.bell_order_delivered";
    case "review.published":
      return "sor.bell_new_review";
    case "lesson.review_prompt":
      return "sor.bell_review_prompt";
    case "lesson.reminder_due":
      return "sor.bell_lesson_tomorrow";
    case "admin_fee.invoiced":
      return "sor.bell_fee_due";
    case "admin_fee.unpaid":
      return "sor.bell_fee_unpaid";
    case "admin_fee.digest":
      return "sor.bell_unpaid_digest";
    // #461 addendum Triggers 8-9: actor-split event types, so the label
    // always describes the OTHER side's action.
    case "lesson.cancelled_by_parent":
      return "sor.bell_lesson_cancelled_parent";
    case "lesson.cancelled_by_tutor":
      return "sor.bell_lesson_cancelled_tutor";
    case "billing.notice_by_parent":
    case "billing.notice_by_tutor":
      return "sor.bell_billing_notice";
    case "lesson.scheduled_by_parent":
      return "sor.bell_lesson_scheduled_parent";
    case "lesson.scheduled_by_tutor":
      return "sor.bell_lesson_scheduled_tutor";
    // #542 V1 triggers + #561 action scenarios.
    case "case.end_requested_by_parent":
      return "sor.bell_case_end_by_parent";
    case "case.end_requested_by_tutor":
      return "sor.bell_case_end_by_tutor";
    case "experience.session_logged":
      return "sor.bell_session_logged";
    case "case.lead_new":
      return "sor.bell_lead_new";
    case "case.match_alert":
      return "sor.bell_case_match";
    case "case.already_taken":
      return "sor.bell_case_taken";
    case "case.match_waves_exhausted":
      return "sor.bell_waves_exhausted";
    case "case.demand_side_updated":
      return "sor.bell_demand_side";
    case "intro.shared_parent":
      return "sor.bell_intro_parent";
    case "intro.shared_tutor":
      return "sor.bell_intro_tutor";
    case "verification.approved":
      return "sor.bell_verify_approved";
    case "verification.rejected":
      return "sor.bell_verify_rejected";
    case "material.rejected":
      return "sor.bell_material_rejected";
    case "content.rejected":
      return "sor.bell_content_rejected";
    case "report.filed":
      return "sor.bell_report_filed";
    case "action.profile_fields":
      return "sor.bell_profile_fields";
    case "action.onboarding":
      return "sor.bell_onboarding";
    case "action.admin_task":
      return "sor.bell_admin_task";
    default:
      return "sor.bell_update";
  }
}

function actionTitle(item: BellItem): string {
  if (
    item.event_type === "action.admin_task" &&
    typeof item.payload.admin_title === "string" &&
    item.payload.admin_title
  ) {
    return i18n.language.startsWith("zh")
      ? String(item.payload.admin_title_zh ?? item.payload.admin_title)
      : String(item.payload.admin_title);
  }
  return bellLabelKey(item);
}

function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const shouldReduceMotion = useReducedMotion();
  const [filter, setFilter] = useState<PageFilter>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["bell", "page"],
    queryFn: getMyBell,
  });

  const markAllRead = useMutation({
    mutationFn: () => markNotificationsRead({ data: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bell"] }),
  });

  const completeAction = useMutation({
    mutationFn: (deliveryId: string) => completeMyAction({ data: { deliveryId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bell"] }),
  });
  const dismissAction = useMutation({
    mutationFn: (deliveryId: string) => dismissMyAction({ data: { deliveryId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bell"] }),
  });

  // #292: the red dot clears when the list is opened.
  const clearedOnce = useRef(false);
  useEffect(() => {
    if (clearedOnce.current) return;
    if ((data?.unread ?? 0) > 0) {
      clearedOnce.current = true;
      markAllRead.mutate();
    }
  }, [data?.unread, markAllRead]);

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const openActions = items.filter((i) => i.action_required && i.action_status === "open");
  const visible =
    filter === "action"
      ? items.filter((i) => i.action_required)
      : filter === "unread"
        ? items.filter((i) => !i.read)
        : filter === "all"
          ? items
          : items.filter((i) => eventGroup(i.event_type) === filter);

  const groupCount = (group: ReturnType<typeof eventGroup>) =>
    items.filter((i) => eventGroup(i.event_type) === group).length;

  const chip = (key: PageFilter, label: string, count?: number) => (
    <button
      key={key}
      type="button"
      onClick={() => setFilter(key)}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        filter === key
          ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-[color:var(--background)]"
          : "border-[color:var(--ink)]/15 text-muted-foreground hover:bg-[color:var(--foreground)]/[0.04]",
      )}
    >
      {label}
      {count !== undefined && count > 0 ? ` · ${count}` : ""}
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
      <SiteHeader />
      <PageContainer>
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--ink)]">
          {t("sor.notifications_title")}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {chip("all", t("sor.nf_filter_all"))}
          {chip("action", t("sor.nf_filter_action"), openActions.length)}
          {chip("unread", t("sor.nf_filter_unread"), data?.unread ?? 0)}
          {/* #671: family groups — Cases · Schedule · Ratings · Account. */}
          {chip("cases", t("sor.nf_group_cases"), groupCount("cases"))}
          {chip("schedule", t("sor.nf_group_schedule"), groupCount("schedule"))}
          {chip("ratings", t("sor.nf_group_ratings"), groupCount("ratings"))}
          {chip("account", t("sor.nf_group_account"), groupCount("account"))}
        </div>

        {/* #561: the content area keeps a minimum height so the footer sits
            at the bottom of the viewport on short or empty pages. */}
        <div className="mt-6 min-h-[60vh] flex-1 space-y-2">
          {isLoading &&
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}

          {!isLoading && visible.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[color:var(--ink)]/10 px-6 py-16 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground/60" aria-hidden="true" />
              <p className="mt-3 text-base font-semibold text-[color:var(--ink)]">
                {t("sor.nf_empty_title")}
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {t("sor.nf_empty_help")}
              </p>
            </div>
          )}

          {!isLoading &&
            visible.map((item) => {
              const Icon = bellIcon(item.event_type);
              const isOpenAction = item.action_required && item.action_status === "open";
              const isClosedAction = item.action_required && item.action_status !== null;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                    isOpenAction
                      ? "border-amber-500/40 bg-amber-500/[0.06]"
                      : "border-[color:var(--ink)]/10 hover:bg-[color:var(--foreground)]/[0.03]",
                    !item.read && !isOpenAction && "bg-[color:var(--foreground)]/[0.04]",
                  )}
                >
                  <Icon
                    className={cn(
                      "mt-0.5 h-5 w-5 shrink-0",
                      isOpenAction ? "text-amber-600" : "text-muted-foreground",
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (isOpenAction) return;
                        if (item.link) navigate({ to: item.link });
                      }}
                      className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "text-sm font-medium text-[color:var(--ink)]",
                            isOpenAction && "font-semibold",
                          )}
                        >
                          {isClosedAction || isOpenAction
                            ? actionTitle(item)
                            : t(bellLabelKey(item))}
                        </span>
                        {isOpenAction && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            {t("sor.ar_badge")}
                          </span>
                        )}
                        {isClosedAction && (
                          <span className="rounded-full bg-[color:var(--foreground)]/[0.06] px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {item.action_status === "dismissed"
                              ? t("sor.ar_dismissed")
                              : t("sor.ar_resolved")}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {formatPostedAgo(item.created_at, i18n.language)}
                      </span>
                    </button>
                    {isOpenAction && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (item.user_completable) {
                              completeAction.mutate(item.id);
                            } else if (item.link) {
                              navigate({ to: item.link });
                            }
                          }}
                          className="rounded-lg bg-[color:var(--ink)] px-3 py-1.5 text-xs font-semibold text-[color:var(--background)] transition-opacity hover:opacity-90"
                        >
                          {item.user_completable
                            ? t("sor.ar_cta_mark_complete")
                            : item.cta_key
                              ? t(item.cta_key)
                              : t("sor.bell_view_all")}
                        </button>
                        {item.user_dismissable && (
                          <button
                            type="button"
                            onClick={() => dismissAction.mutate(item.id)}
                            className="rounded-lg border border-[color:var(--ink)]/15 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-[color:var(--foreground)]/[0.04]"
                          >
                            {t("sor.ar_not_now")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <AnimatePresence initial={false}>
                    {!item.read && !isOpenAction ? (
                      <motion.span
                        className="mt-1.5 h-2 w-2 rounded-full bg-red-500"
                        aria-hidden="true"
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0 }}
                        initial={{ opacity: 0, scale: 0 }}
                        transition={
                          shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }
                        }
                      />
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}
        </div>
      </PageContainer>
      <SiteFooter />
    </div>
  );
}
