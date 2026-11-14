import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bookmark, BookmarkCheck, ClipboardList, FileText, GraduationCap, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/useAuth";
import {
  ACCOUNT_SAVED_LIMIT,
  GUEST_SAVED_LIMIT,
  hasSavableFilters,
  normalizeSearchParams,
  removeSavedSearch,
  saveSearch,
  searchKey,
  useSavedSearches,
  type SavedSearchParams,
  type SavedSearchScope,
} from "@/features/search/saved-searches";

const pillClass =
  "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]";

const SCOPE_ICON = { tutors: GraduationCap, cases: ClipboardList, notes: FileText } as const;

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
  const { user } = useAuth();
  const saved = useSavedSearches(scope);
  if (!hasSavableFilters(params) || !label.trim()) return null;
  const normalized = normalizeSearchParams(params);
  const key = searchKey(scope, normalized);
  const existing = saved.find((item) => searchKey(item.scope, item.params) === key);

  const onClick = () => {
    if (existing) {
      removeSavedSearch(existing.id);
      toast.success(t("saved_search.removed"));
      return;
    }
    const ok = saveSearch(
      { scope, params: normalized, label: label.slice(0, 80) },
      user ? ACCOUNT_SAVED_LIMIT : GUEST_SAVED_LIMIT,
    );
    if (!ok) {
      toast.error(
        t("saved_search.limit", { count: user ? ACCOUNT_SAVED_LIMIT : GUEST_SAVED_LIMIT }),
      );
      return;
    }
    toast.success(user ? t("saved_search.saved") : t("saved_search.saved_guest"));
  };

  return (
    <button
      type="button"
      aria-pressed={Boolean(existing)}
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
  const saved = useSavedSearches(scope);
  const [managing, setManaging] = useState(false);
  if (saved.length === 0) return null;
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
        {saved.map((item) =>
          managing ? (
            <button
              key={item.id}
              type="button"
              onClick={() => removeSavedSearch(item.id)}
              aria-label={t("saved_search.remove", { label: item.label })}
              className={cn(pillClass, "border-border bg-card text-[color:var(--ink)]")}
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              {item.label}
              <X className="h-3.5 w-3.5 text-[color:var(--ink)]/60" aria-hidden="true" />
            </button>
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
            </button>
          ),
        )}
      </div>
    </div>
  );
}
