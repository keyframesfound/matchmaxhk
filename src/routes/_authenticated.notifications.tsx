import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bell, CalendarClock, Package, Star, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyBell, markNotificationsRead, type BellItem } from "@/features/cases/bus.functions";

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

function bellIcon(eventType: string) {
  if (eventType === "note_order.delivered") return Package;
  if (eventType === "review.published" || eventType === "lesson.review_prompt") return Star;
  if (eventType === "lesson.reminder_due") return CalendarClock;
  if (eventType.startsWith("admin_fee")) return Wallet;
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
    case "admin_fee.invoiced":
      return "sor.bell_fee_due";
    case "admin_fee.unpaid":
      return "sor.bell_fee_unpaid";
    case "admin_fee.digest":
      return "sor.bell_unpaid_digest";
    default:
      return "sor.bell_update";
  }
}

function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const shouldReduceMotion = useReducedMotion();

  const { data, isLoading } = useQuery({
    queryKey: ["bell", "page"],
    queryFn: getMyBell,
  });

  const markAllRead = useMutation({
    mutationFn: () => markNotificationsRead({ data: {} }),
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

  const items = data?.items ?? [];

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <SiteHeader />
      <PageContainer>
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--ink)]">
          {t("sor.notifications_title")}
        </h1>

        <div className="mt-6 space-y-2">
          {isLoading &&
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}

          {!isLoading && items.length === 0 && (
            <p className="rounded-xl border border-[color:var(--ink)]/10 p-6 text-sm text-muted-foreground">
              {t("sor.bell_empty")}
            </p>
          )}

          {items.map((item) => {
            const Icon = bellIcon(item.event_type);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.link) navigate({ to: item.link });
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border border-[color:var(--ink)]/10 p-4 text-left transition-colors hover:bg-[color:var(--foreground)]/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
                  !item.read && "bg-[color:var(--foreground)]/[0.04]",
                )}
              >
                <Icon
                  className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="flex-1">
                  <span className="block text-sm font-medium text-[color:var(--ink)]">
                    {t(bellLabelKey(item))}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </span>
                </span>
                <AnimatePresence initial={false}>
                  {!item.read ? (
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
              </button>
            );
          })}
        </div>
      </PageContainer>
      <SiteFooter />
    </div>
  );
}
