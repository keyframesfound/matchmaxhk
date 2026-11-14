import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Bell,
  BellOff,
  Bookmark,
  BookmarkCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/useAuth";
import {
  ACCOUNT_SAVED_LIMIT,
  GUEST_SAVED_LIMIT,
  clearLocalSavedSearches,
  hasSavableFilters,
  normalizeSearchParams,
  readLocalSavedSearches,
  removeSavedSearch,
  saveSearch,
  searchKey,
  useSavedSearches,
  type SavedSearchParams,
  type SavedSearchScope,
} from "@/features/search/saved-searches";
import {
  deleteMySavedSearch,
  listMySavedSearches,
  saveMySearch,
  setMySavedSearchAlerts,
} from "@/features/search/saved-searches.functions";

const pillClass =
  "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]";

const SCOPE_ICON = { tutors: GraduationCap, cases: ClipboardList, notes: FileText } as const;
const ACCOUNT_KEY = ["saved-searches", "account"] as const;

type UiSavedSearch = {
  id: string;
  scope: SavedSearchScope;
  params: SavedSearchParams;
  label: string;
  /** Account searches only; device searches have no alerts. */
  alertsEnabled: boolean | null;
};

/** One-time upload of device saves after sign-in (per page load). */
let localUploadStarted = false;

/**
 * #725: one list for the UI. Signed in → the account (synced, with alerts);
 * guest → this device. Device saves are uploaded once after sign-in.
 */
function useSavedSearchList(scope: SavedSearchScope) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const local = useSavedSearches(scope);
  const accountQuery = useQuery({
    queryKey: ACCOUNT_KEY,
    queryFn: () => listMySavedSearches(),
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!user || localUploadStarted) return;
    const pending = readLocalSavedSearches();
    if (pending.length === 0) return;
    localUploadStarted = true;
    void (async () => {
      for (const item of pending) {
        try {
          await saveMySearch({
            data: { scope: item.scope, params: item.params, label: item.label },
          });
        } catch {
          // keep going; a failed upload just stays on the device
        }
      }
      clearLocalSavedSearches();
      void queryClient.invalidateQueries({ queryKey: ACCOUNT_KEY });
    })();
  }, [user, queryClient]);

  const items: UiSavedSearch[] = user
    ? (accountQuery.data ?? [])
        .filter((item) => item.scope === scope)
        .map((item) => ({ ...item, alertsEnabled: item.alertsEnabled }))
    : local.map((item) => ({ ...item, alertsEnabled: null }));

  const refresh = () => queryClient.invalidateQueries({ queryKey: ACCOUNT_KEY });
  return { items, signedIn: Boolean(user), refresh };
}

/** #725: "🔖 Save search" next to the result count (needs ≥1 filter). */
export function SaveSearchButton({
  scope,
  params,
  label,
}: {
  scope: SavedSearchScope;
  params: Record<string, unknown>;
  label: string;
}) {
  const { t } = useTranslation();
  const { items, signedIn, refresh } = useSavedSearchList(scope);
  const saveMutation = useMutation({
    mutationFn: (input: { params: SavedSearchParams; label: string }) =>
      saveMySearch({ data: { scope, params: input.params, label: input.label } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(t("saved_search.limit", { count: ACCOUNT_SAVED_LIMIT }));
        return;
      }
      void refresh();
      toast.success(t("saved_search.saved"));
    },
    onError: () => toast.error(t("saved_search.error")),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMySavedSearch({ data: { id } }),
    onSuccess: () => {
      void refresh();
      toast.success(t("saved_search.removed"));
    },
    onError: () => toast.error(t("saved_search.error")),
  });

  if (!hasSavableFilters(params) || !label.trim()) return null;
  const normalized = normalizeSearchParams(params);
  const key = searchKey(scope, normalized);
  const existing = items.find((item) => searchKey(item.scope, item.params) === key);
  const busy = saveMutation.isPending || deleteMutation.isPending;

  const onClick = () => {
    if (busy) return;
    if (existing) {
      if (signedIn) deleteMutation.mutate(existing.id);
      else {
        removeSavedSearch(existing.id);
        toast.success(t("saved_search.removed"));
      }
      return;
    }
    if (signedIn) {
      saveMutation.mutate({ params: normalized, label: label.slice(0, 80) });
      return;
    }
    const ok = saveSearch(
      { scope, params: normalized, label: label.slice(0, 80) },
      GUEST_SAVED_LIMIT,
    );
    if (!ok) {
      toast.error(t("saved_search.limit", { count: GUEST_SAVED_LIMIT }));
      return;
    }
    toast.success(t("saved_search.saved_guest"));
  };

  return (
    <button
      type="button"
      aria-pressed={Boolean(existing)}
      disabled={busy}
      onClick={onClick}
      className={cn(
        pillClass,
        existing
          ? "border-[color:var(--brand-link)] bg-[color:var(--brand-link)]/10 text-[color:var(--ink)]"
          : "border-border bg-card text-[color:var(--ink)] hover:bg-[color:var(--surface-subtle)]",
      )}
    >
      {existing ? (
        <BookmarkCheck className="h-4 w-4 text-[color:var(--brand-link)]" aria-hidden="true" />
      ) : (
        <Bookmark className="h-4 w-4" aria-hidden="true" />
      )}
      {existing ? t("saved_search.saved_state") : t("saved_search.save")}
    </button>
  );
}

/** #725: "Saved ··· Manage" strip; tapping a pill re-applies every filter. */
export function SavedSearchStrip({
  scope,
  onApply,
  className,
}: {
  scope: SavedSearchScope;
  onApply: (params: SavedSearchParams) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const { items, signedIn, refresh } = useSavedSearchList(scope);
  const [managing, setManaging] = useState(false);
  const remove = async (id: string) => {
    if (!signedIn) {
      removeSavedSearch(id);
      return;
    }
    try {
      await deleteMySavedSearch({ data: { id } });
      void refresh();
    } catch {
      toast.error(t("saved_search.error"));
    }
  };
  const toggleAlerts = async (id: string, enabled: boolean) => {
    try {
      await setMySavedSearchAlerts({ data: { id, enabled } });
      void refresh();
      toast.success(enabled ? t("saved_search.alerts_on") : t("saved_search.alerts_off"));
    } catch {
      toast.error(t("saved_search.error"));
    }
  };
  if (items.length === 0) return null;
  const Icon = SCOPE_ICON[scope];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[color:var(--ink)]">{t("saved_search.title")}</p>
        <button
          type="button"
          onClick={() => setManaging((value) => !value)}
          className="text-sm font-semibold text-[color:var(--brand-link)] underline-offset-4 hover:underline"
        >
          {managing ? t("saved_search.done") : t("saved_search.manage")}
        </button>
      </div>
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
        {items.map((item) =>
          managing ? (
            <span
              key={item.id}
              className={cn(pillClass, "border-border bg-card pr-1 text-[color:var(--ink)]")}
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              {item.label}
              {item.alertsEnabled !== null ? (
                <button
                  type="button"
                  onClick={() => void toggleAlerts(item.id, !item.alertsEnabled)}
                  aria-label={
                    item.alertsEnabled
                      ? t("saved_search.alerts_turn_off", { label: item.label })
                      : t("saved_search.alerts_turn_on", { label: item.label })
                  }
                  className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-muted"
                >
                  {item.alertsEnabled ? (
                    <Bell
                      className="h-3.5 w-3.5 text-[color:var(--brand-link)]"
                      aria-hidden="true"
                    />
                  ) : (
                    <BellOff className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  )}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void remove(item.id)}
                aria-label={t("saved_search.remove", { label: item.label })}
                className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-muted"
              >
                <X className="h-3.5 w-3.5 text-[color:var(--ink)]/60" aria-hidden="true" />
              </button>
            </span>
          ) : (
            <button
              key={item.id}
              type="button"
              onClick={() => onApply(item.params)}
              className={cn(
                pillClass,
                "border-border bg-card text-[color:var(--ink)] hover:bg-[color:var(--surface-subtle)]",
              )}
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              {item.label}
              {item.alertsEnabled ? (
                <Bell
                  className="h-3 w-3 text-[color:var(--brand-link)]"
                  aria-label={t("saved_search.alerts_on_short")}
                />
              ) : null}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
