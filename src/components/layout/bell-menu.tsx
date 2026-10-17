import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Bell, CalendarClock, GraduationCap, Package, Star, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getMyBell, markNotificationsRead, type BellItem } from "@/features/cases/bus.functions";
import { cn } from "@/lib/utils";

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

/**
 * #292 — the bell, fed by the #205 bus. Red dot = unread in-app count; it
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

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("sor.bell_aria", { count: unread })}
          className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-[color:var(--foreground)]/[0.05]"
        >
          <Bell className="h-5 w-5 text-[color:var(--ink)]" aria-hidden="true" />
          {unread > 0 && (
            <span
              className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-red-500"
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
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
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
