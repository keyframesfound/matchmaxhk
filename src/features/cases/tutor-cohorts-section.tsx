import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cohortAvailability, type CohortAvailabilityState } from "@/features/cases/group-cohorts";
import { cn } from "@/lib/utils";

/**
 * Issue #391, "Group classes" section on the public tutor profile: the
 * tutor's open cohorts with live seats, linking to /group-classes to book.
 * Self-fetching like the ExperiencePill; degrades to nothing when the tutor
 * runs no cohorts (or pre-migration).
 */

type CohortRow = {
  id: string;
  title: string;
  subject: string;
  student_level: string;
  weekly_schedule: string;
  mode: string;
  district: string | null;
  per_student_rate_hkd: number;
  min_seats: number;
  max_seats: number;
  status: string;
  description: string | null;
};

const STATE_PILL_STYLES: Record<CohortAvailabilityState, string> = {
  forming: "border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  running: "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  full: "border-border bg-muted text-[color:var(--ink)]",
  closed: "border-border bg-muted text-muted-foreground",
};

export function TutorGroupClassesSection({ tutorId }: { tutorId: string }) {
  const { t } = useTranslation();

  const cohortsQuery = useQuery({
    queryKey: ["tutor-cohorts", tutorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_cohorts")
        .select(
          "id, title, subject, student_level, weekly_schedule, mode, district, per_student_rate_hkd, min_seats, max_seats, status, description",
        )
        .eq("tutor_id", tutorId)
        .neq("status", "closed")
        .order("created_at", { ascending: false });
      // Pre-migration tab / hiccup → no section, never an error state.
      if (error) return [];
      return (data ?? []) as CohortRow[];
    },
    enabled: Boolean(tutorId),
  });

  const cohorts = cohortsQuery.data ?? [];
  if (cohorts.length === 0) return null;

  return (
    <section className="border-t border-border py-8 sm:py-10">
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-[color:var(--brand-link)]" aria-hidden="true" />
        <h2 className="text-base font-medium text-[color:var(--ink)]">
          {t("profile.section_group_classes")}
        </h2>
      </div>
      <ul className="space-y-3">
        {cohorts.map((cohort) => {
          // Seat sums live server-side on the board; the profile shows the
          // structural state (forming/running) from min_seats only.
          const availability = cohortAvailability(cohort, []);
          return (
            <li key={cohort.id} className="rounded-sm border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    STATE_PILL_STYLES[availability.state],
                  )}
                >
                  {t(`group_classes.state_${availability.state}`)}
                </span>
                <span className="text-sm font-medium text-[color:var(--ink)]">{cohort.title}</span>
                <span className="ml-auto text-sm font-medium text-[color:var(--ink)]">
                  ${cohort.per_student_rate_hkd}
                  <span className="ml-1 text-[0.7em] font-medium text-muted-foreground">
                    {t("group_classes.per_student_rate_suffix")}
                  </span>
                </span>
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{cohort.subject}</span>
                <span>· {cohort.student_level}</span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays
                    className="h-3.5 w-3.5 text-[color:var(--brand-link)]"
                    aria-hidden="true"
                  />
                  {cohort.weekly_schedule}
                </span>
                {cohort.mode === "in_person" ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin
                      className="h-3.5 w-3.5 text-[color:var(--brand-link)]"
                      aria-hidden="true"
                    />
                    {cohort.district}
                  </span>
                ) : (
                  <span>{t("group_classes.mode_online")}</span>
                )}
              </p>
              {cohort.description ? (
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {cohort.description}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="mt-4">
        <Button type="button" size="sm" variant="outline" asChild>
          <Link to="/group-classes">{t("profile.group_classes_view_all")}</Link>
        </Button>
      </div>
    </section>
  );
}
