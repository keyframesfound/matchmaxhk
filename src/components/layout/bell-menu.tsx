import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { formatPostedAgo } from "@/lib/relative-time";
import { Bell, GraduationCap, MessageCircle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/features/i18n/config";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BellDot } from "@/components/layout/bell-dot";
import { useBellQuery } from "@/components/layout/use-bell-query";
import { markNotificationsRead, type BellItem } from "@/features/cases/bus.functions";
import { completeMyAction, dismissMyAction } from "@/features/cases/action-required.functions";
import { bellGroup, bellIcon, bellLabel, type BellGroup } from "@/features/cases/bell-view";
import { buildWaSummary, waSummaryTimestamp } from "@/features/cases/wa-summary";
import { cn } from "@/lib/utils";

/** HKT clock stamp for the WA digest lines ("6 Nov, 16:00" / "11月6日 16:00"). */
function hktWhen(iso: string): { en: string; zh: string } {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return { en: "", zh: "" };
  const en = new Intl.DateTimeFormat("en-HK", {
    timeZone: "Asia/Hong_Kong",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
  const zh = new Intl.DateTimeFormat("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
  return { en, zh };
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea path (non-secure contexts / permissions)
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * #292, the bell, fed by the #205 bus. Red dot = unread in-app count; it
 * clears when the list is opened (mark-all on the /notifications page, or
 * per-item on click). A save is never an event.
 * #671: family filter chips (Cases · Schedule · Ratings · Account) shared
 * with the inbox page via bell-view.ts, plus the V1 paste-ready WhatsApp
 * summary (clipboard only — no automated WA delivery).
 */
export function BellMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [group, setGroup] = useState<"all" | BellGroup>("all");

  const { data } = useBellQuery();

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
  const allItems = data?.items ?? [];
  // #671: family filters over the same inbox — the dropdown mirrors the
  // /notifications page chips so the two surfaces never drift.
  const items =
    group === "all" ? allItems : allItems.filter((i) => bellGroup(i.event_type) === group);

  // #671 V1 WA summary: bilingual paste-ready digest of the current inbox.
  async function copyWaSummary() {
    const ten = i18n.getFixedT("en");
    const tzh = i18n.getFixedT("zh-HK");
    const stamp = waSummaryTimestamp();
    const lines = allItems.slice(0, 10).map((item) => {
      const when = hktWhen(item.created_at);
      return {
        en: `${bellLabel(item, ten)}${when.en ? ` · ${when.en}` : ""}`,
        zh: `${bellLabel(item, tzh)}${when.zh ? ` · ${when.zh}` : ""}`,
      };
    });
    const text = buildWaSummary({
      generatedEn: stamp.en,
      generatedZh: stamp.zh,
      lines,
      emptyEn: ten("sor.bell_empty"),
      emptyZh: tzh("sor.bell_empty"),
    });
    const ok = await copyToClipboard(text);
    if (ok) toast.success(t("sor.nf_wa_copied"));
    else toast.error(t("sor.nf_wa_copy_failed"));
  }

  const chip = (key: "all" | BellGroup, label: string, count?: number) => (
    <button
      key={key}
      type="button"
      onClick={() => setGroup(key)}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        group === key
          ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-[color:var(--background)]"
          : "border-[color:var(--ink)]/15 text-muted-foreground hover:bg-[color:var(--foreground)]/[0.04]",
      )}
    >
      {label}
      {count !== undefined && count > 0 ? ` · ${count}` : ""}
    </button>
  );

  const groupCount = (g: BellGroup) => allItems.filter((i) => bellGroup(i.event_type) === g).length;

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
          <BellDot unread={unread} openActions={openActions} className="right-1.5 top-1.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 overflow-hidden rounded-2xl border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-0"
      >
        {/* #671: family filters — Cases · Schedule · Ratings · Account. */}
        <div className="flex flex-wrap gap-1.5 border-b border-[color:var(--ink)]/10 px-3 py-2">
          {chip("all", t("sor.nf_filter_all"))}
          {chip("cases", t("sor.nf_group_cases"), groupCount("cases"))}
          {chip("schedule", t("sor.nf_group_schedule"), groupCount("schedule"))}
          {chip("ratings", t("sor.nf_group_ratings"), groupCount("ratings"))}
          {chip("account", t("sor.nf_group_account"), groupCount("account"))}
        </div>
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
                    : bellLabel(item, t);
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
                      <span className="block text-sm">{bellLabel(item, t)}</span>
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
        <div className="border-t border-[color:var(--ink)]/10">
          <DropdownMenuItem asChild>
            <button
              type="button"
              onClick={() => {
                void copyWaSummary();
              }}
            >
              <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
              <span className="flex-1">
                <span className="block text-sm">{t("sor.nf_wa_copy")}</span>
                <span className="block text-[10px] text-muted-foreground">
                  {t("sor.nf_wa_v1_hint")}
                </span>
              </span>
            </button>
          </DropdownMenuItem>
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
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
