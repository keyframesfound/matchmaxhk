import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/useAuth";
import { getMyBell } from "@/features/cases/bus.functions";

/** Shared by the header bell and the phone Notifications tab (same query key). */
export function useBellQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["bell"],
    queryFn: getMyBell,
    enabled: Boolean(user),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}
