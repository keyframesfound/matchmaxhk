import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listSearchTagsAdmin,
  setSearchTagOverride,
  type AdminTagRow,
} from "@/features/search/search.functions";

function TagRow({ row, onSaved }: { row: AdminTagRow; onSaved: () => void }) {
  const { t } = useTranslation();
  const [merge, setMerge] = useState(row.mergedInto ?? "");
  const save = useMutation({
    mutationFn: (input: { hidden: boolean; mergedInto: string | null }) =>
      setSearchTagOverride({ data: { tag: row.tag, ...input } }),
    onSuccess: () => {
      toast.success(t("search_tags_admin.saved"));
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-sm">
      <span className="min-w-[8rem] font-mono">#{row.tag}</span>
      <span className="text-xs text-muted-foreground">
        {t("search_tags_admin.uses", { n: row.count })}
      </span>
      {row.hidden && (
        <span className="text-xs font-semibold text-amber-700">
          {t("search_tags_admin.hidden")}
        </span>
      )}
      <Input
        className="h-8 w-36"
        value={merge}
        aria-label={t("search_tags_admin.merge_into")}
        placeholder={t("search_tags_admin.merge_into")}
        onChange={(e) => setMerge(e.target.value)}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={save.isPending}
        onClick={() => save.mutate({ hidden: row.hidden, mergedInto: merge.trim() || null })}
      >
        {t("search_tags_admin.save_merge")}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={save.isPending}
        onClick={() => save.mutate({ hidden: !row.hidden, mergedInto: row.mergedInto })}
      >
        {row.hidden ? t("search_tags_admin.unhide") : t("search_tags_admin.hide")}
      </Button>
    </li>
  );
}

/**
 * #553 tag moderation (CEO 2026-11-01): hide a tag from typeahead / public
 * chips or merge an alias into a canonical tag. Content rows are untouched.
 */
export function SearchTagAdminPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ["admin", "search-tags"];
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => listSearchTagsAdmin(),
  });
  return (
    <section className="mt-8 space-y-3 rounded-3xl border border-border bg-card p-8">
      <h2 className="text-xl font-bold">{t("search_tags_admin.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("search_tags_admin.subtitle")}</p>
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {isError && <p className="text-sm text-destructive">{t("search_tags_admin.error")}</p>}
      {data && data.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("search_tags_admin.empty")}</p>
      )}
      <ul className="divide-y divide-border">
        {data?.map((row) => (
          <TagRow
            key={row.tag}
            row={row}
            onSaved={() => void queryClient.invalidateQueries({ queryKey })}
          />
        ))}
      </ul>
    </section>
  );
}
