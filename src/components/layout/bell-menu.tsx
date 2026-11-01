import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { formatPostedAgo } from "@/lib/relative-time";
import {
  AlertCircle,
  Bell,
  CalendarClock,
  CheckCheck,
  GraduationCap,
  Package,
  Star,
  Wallet,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/features/i18n/config";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getMyBell, markNotificationsRead, type BellItem } from "@/features/cases/bus.functions";
import { completeMyAction, dismissMyAction } from "@/features/cases/action-required.functions";
import { cn } from "@/lib/utils";

function bellIcon(eventType: string) {
  if (eventType === "note_order.delivered") return Package;
  if (eventType === "review.published" || eventType === "lesson.review_prompt") return Star;
  if (eventType === "lesson.reminder_due") return CalendarClock;
  if (eventType === "experience.session_logged") return GraduationCap;
  if (eventType === "case.end_requested_by_parent" || eventType === "case.end_requested_by_tutor")
    return CheckCheck;
  if (eventType.startsWith("admin_fee")) return Wallet;
  // #561/#542 action-class items carry the attention icon.
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
    case "note_order.delivered":
      return item.role_hint === "tutor" ? "sor.bell_note_sold" : "sor.bell_order_delivered";
    case "review.published":
      return "sor.bell_new_review";
    case "lesson.review_prompt":
      return "sor.bell_review_prompt";
    case "lesson.reminder_due":
      return "sor.bell_lesson_tomorrow";
    case "experience.session_logged":
      return "sor.bell_session_logged";
    case "case.end_requested_by_parent":
      return "sor.bell_case_end_by_parent";
    case "case.end_requested_by_tutor":
      return "sor.bell_case_end_by_tutor";
    case "admin_fee.invoiced":
      return "sor.bell_fee_due";
    case "admin_fee.unpaid":
      return "sor.bell_fee_unpaid";
    case "admin_fee.digest":
      return "sor.bell_unpaid_digest";
    // #542 V1 triggers + #561 action scenarios.
    case "case.lead_new":
      return "sor.bell_lead_new";
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

/**
 * #292, the bell, fed by the #205 bus. Red dot = unread in-app count; it
 * clears when the list is opened (mark-all on the /notifications page, or
 * per-item on click). A save is never an event.
 */
export function BellMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["bell"],
    queryFn: getMyBell,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const markRead = useMutation({
    mutationFn: (ids: string[]) => markNotificationsRead({ data: { ids } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bell"] }),
  });

  // #561: "Mark complete" resolves an admin-appointed task from the bell.
  const completeAction = useMutation({
    mutationFn: (deliveryId: string) => completeMyAction({ data: { deliveryId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bell"] }),
  });
  // #561: "Not now" dismisses a low-urgency item without completing it.
  const dismissAction = useMutation({
    mutationFn: (deliveryId: string) => dismissMyAction({ data: { deliveryId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bell"] }),
  });

  const unread = data?.unread ?? 0;
  const openActions = data?.openActions ?? 0;
  const items = data?.items ?? [];

  return (
    <DropdownMenu
      modal={false}
      onOpenChange={(open) => {
        // #292 contract: the red dot clears when the list is opened, mark all
        // read on open (same mark-all the /notifications page runs on mount).
        if (open && unread > 0) markRead.mutate([]);
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("sor.bell_aria", { count: unread })}
          className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-[color:var(--foreground)]/[0.05]"
        >
          <Bell className="h-5 w-5 text-[color:var(--ink)]" aria-hidden="true" />
          {(unread > 0 || openActions > 0) && (
            <span
              className={cn(
                "absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full",
                openActions > 0 ? "bg-amber-500" : "bg-red-500",
              )}
              aria-hidden="true"
            />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 overflow-hidden rounded-2xl border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-0"
      >
        <div className="max-h-96 overflow-y-auto px-1.5 py-1.5">
          {items.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">{t("sor.bell_empty")}</p>
          ) : (
            items.map((item) => {
              const Icon = bellIcon(item.event_type);
              const isOpenAction = item.action_required && item.action_status === "open";
              if (isOpenAction) {
                // #561: open actions render as pinned cards with a primary
                // CTA (and "Not now" for dismissable items), not plain rows.
                const title =
                  item.event_type === "action.admin_task" &&
                  typeof item.payload.admin_title === "string" &&
                  item.payload.admin_title
                    ? i18n.language.startsWith("zh")
                      ? String(item.payload.admin_title_zh ?? item.payload.admin_title)
                      : String(item.payload.admin_title)
                    : t(bellLabelKey(item));
                return (
                  <div
                    key={item.id}
                    className="mb-1 rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-[color:var(--ink)]">
                          {title}
                        </span>
                        <span className="mt-0.5 inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                          {t("sor.ar_badge")}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          markRead.mutate([item.id]);
                          if (item.user_completable) {
                            completeAction.mutate(item.id);
                          } else if (item.link) {
                            navigate({ to: item.link });
                          }
                        }}
                        className="rounded-lg bg-[color:var(--ink)] px-2.5 py-1 text-xs font-semibold text-[color:var(--background)] transition-opacity hover:opacity-90"
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
                          onClick={() => {
                            dismissAction.mutate(item.id);
                          }}
                          className="rounded-lg border border-[color:var(--ink)]/15 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-[color:var(--foreground)]/[0.04]"
                        >
                          {t("sor.ar_not_now")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              }
              return (
                <DropdownMenuItem
                  key={item.id}
                  asChild
                  className={cn(
                    "cursor-pointer rounded-lg",
                    !item.read && "bg-[color:var(--foreground)]/[0.04]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      markRead.mutate([item.id]);
                      if (item.link) navigate({ to: item.link });
                    }}
                  >
                    <Icon
                      className="mr-2 h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="flex-1">
                      <span className="block text-sm">{t(bellLabelKey(item))}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatPostedAgo(item.created_at, i18n.language)}
                      </span>
                    </span>
                    {!item.read && (
                      <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
                    )}
                  </button>
                </DropdownMenuItem>
              );
            })
          )}
        </div>
        <DropdownMenuItem asChild className="border-t border-[color:var(--ink)]/10">
          <button
            type="button"
            onClick={() => {
              navigate({ to: "/notifications" });
            }}
          >
            <GraduationCap className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("sor.bell_view_all")}
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
