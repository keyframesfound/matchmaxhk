import { useQuery } from "@tanstack/react-query";

import {
  listMyNoteLikeIds,
  listNoteLikeCounts,
  NOTE_LIKE_BATCH_MAX,
} from "@/features/materials/note-likes.functions";

/**
 * #726 like reads for the card grids. Counts arrive in ONE batch call for the
 * visible window (capped at NOTE_LIKE_BATCH_MAX, same convention as #768's
 * public counts), never one request per card. Own state stays a note-page
 * concern: cards resolve it lazily on the first tap.
 */

export const NOTE_LIKE_STATE_QUERY_KEY = ["notes", "like-state"] as const;
export const NOTE_LIKE_COUNTS_QUERY_KEY = ["notes", "like-counts"] as const;
export const NOTE_LIKE_MINE_QUERY_KEY = ["notes", "like-mine"] as const;

export function useNoteLikeCounts(materialIds: string[]): Record<string, number> {
  const key = Array.from(new Set(materialIds)).slice(0, NOTE_LIKE_BATCH_MAX).join(",");
  const ids = key ? key.split(",") : [];
  const query = useQuery({
    queryKey: [...NOTE_LIKE_COUNTS_QUERY_KEY, key],
    queryFn: () => listNoteLikeCounts({ data: { materialIds: ids } }),
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
  return query.data ?? {};
}

/**
 * #726: the viewer's own likes for the same visible window, so a card paints
 * the filled heart immediately. One batch call, same cap as the counts, and
 * an empty result for guests.
 */
export function useMyNoteLikeIds(materialIds: string[]): Set<string> {
  const key = Array.from(new Set(materialIds)).slice(0, NOTE_LIKE_BATCH_MAX).join(",");
  const ids = key ? key.split(",") : [];
  const query = useQuery({
    queryKey: [...NOTE_LIKE_MINE_QUERY_KEY, key],
    queryFn: () => listMyNoteLikeIds({ data: { materialIds: ids } }),
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
  return new Set(query.data ?? []);
}
