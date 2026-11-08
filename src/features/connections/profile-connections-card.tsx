import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CalendarDays, Lock, UserRoundPlus } from "lucide-react";

import { listMyConnections } from "@/features/connections/connections.functions";

/**
 * #617: the Airbnb-style 2-up square grid on the tutor's Account home
 * (profile tab). Left = Cases & Rosters (existing /account/cases surface),
 * right = Connections (the new hub) with the NEW badge + active/pending
 * counts. Unverified tutors see the locked gate copy on the right card.
 */
export function ProfileConnectionsCard({ tutorVerified }: { tutorVerified: boolean }) {
  const { t } = useTranslation();

  // Shared cache with the hub (same key) — opening the hub reuses this read.
  const connectionsQuery = useQuery({
    queryKey: ["connections", "hub"],
    queryFn: () => listMyConnections(),
    staleTime: 30_000,
  });
  const items = tutorVerified ? (connectionsQuery.data?.items ?? []) : [];
  const connectedCount = items.filter((i) => i.status === "ACCEPTED").length;
  const pendingCount = items.filter((i) => i.status === "PENDING").length;
  const loading = tutorVerified && connectionsQuery.isLoading;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">{t("connections.card_grid_title")}</h2>
      <div className="mt-3 grid max-w-xl grid-cols-2 gap-4">
        {/* Left square: existing tutor account cases area. */}
        <Link
          to="/account/cases"
          className="group flex aspect-square flex-col justify-between rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-[color:var(--foreground)]/[0.03]"
        >
          <CalendarDays className="h-6 w-6 text-[color:var(--ink)]" aria-hidden="true" />
          <div>
            <p className="text-base font-bold text-[color:var(--ink)]">
              {t("connections.card_cases")}
            </p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              {t("connections.card_cases_sub")}
            </p>
          </div>
        </Link>

        {/* Right square: Connections hub (gated for unverified tutors). */}
        {tutorVerified ? (
          <Link
            to="/account/connections"
            className="group flex aspect-square flex-col justify-between rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-[color:var(--foreground)]/[0.03]"
          >
            <div className="flex items-start justify-between">
              <UserRoundPlus className="h-6 w-6 text-[color:var(--ink)]" aria-hidden="true" />
              <span className="rounded-full bg-[color:var(--brand-link)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                {t("connections.new_badge")}
              </span>
            </div>
            <div>
              <p className="text-base font-bold text-[color:var(--ink)]">
                {t("connections.card_connections")}
              </p>
              {loading ? (
                <p className="mt-1 h-4 w-24 animate-pulse rounded bg-[color:var(--foreground)]/10" />
              ) : (
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  {t("connections.count_line", {
                    connected: connectedCount,
                    pending: pendingCount,
                  })}
                </p>
              )}
            </div>
          </Link>
        ) : (
          <div className="flex aspect-square flex-col justify-between rounded-2xl border border-dashed border-border bg-card p-5">
            <Lock className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-base font-bold text-[color:var(--ink)]">
                {t("connections.card_connections")}
              </p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                {t("connections.gate_body")}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
