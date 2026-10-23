// Issue #387 — Verified Experience display on PUBLIC surfaces.
//
// Reads the anon-executable SECURITY DEFINER aggregate RPC
// get_tutor_experience (migration 20261023080000) straight from the client —
// the same tolerant pattern as review-summary-block: any error (42P01 /
// PGRST202 on a pre-migration deploy) hides the component, never breaks the
// page. Zero-state rule: 0 verified lessons → render NOTHING (never
// "0 lessons · 0 hours"). No shadows (repo rule) — border + tint only.

import { format } from "date-fns";
import { zhHK } from "date-fns/locale";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { supabase } from "@/integrations/supabase/client";
import { EXPERIENCE, formatExperienceHours } from "@/features/tutors/experience";
import { cn } from "@/lib/utils";

type TutorExperience = {
  total_lessons: number;
  total_hours: number | string;
  first_lesson_at: string | null;
  last_lesson_at: string | null;
};

function useTutorExperience(tutorId: string | undefined): TutorExperience | null {
  const [exp, setExp] = useState<TutorExperience | null>(null);
  useEffect(() => {
    if (!tutorId) return;
    let cancelled = false;
    (async () => {
      // Keep the rpc call BOUND to the client — extracting the method loses
      // `this` and supabase-js throws reading `this.rest`.
      const client = supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      };
      const { data, error } = await client.rpc("get_tutor_experience", { p_tutor: tutorId });
      if (cancelled || error || !data) return;
      // PostgREST wraps RETURNS TABLE in an array — take the single row.
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return;
      setExp(row as TutorExperience);
    })();
    return () => {
      cancelled = true;
    };
  }, [tutorId]);
  return exp;
}

function monthYear(iso: string, lang: string): string {
  return format(new Date(iso), "LLL yyyy", {
    locale: lang.toLowerCase().startsWith("zh") ? zhHK : undefined,
  });
}

/**
 * The shared "X lessons · Y hours · [Start] – [Present|End]" text. Null until
 * the RPC resolves non-empty, so both surfaces hide completely at zero.
 */
function useExperienceText(tutorId: string | undefined): { text: string; title: string } | null {
  const { t, i18n } = useTranslation();
  const exp = useTutorExperience(tutorId);
  if (!exp || !Number(exp.total_lessons)) return null;

  const now = new Date();
  const last = exp.last_lesson_at ? new Date(exp.last_lesson_at) : null;
  const first = exp.first_lesson_at ? new Date(exp.first_lesson_at) : null;
  const withinPresent =
    last !== null &&
    now.getTime() - last.getTime() <= EXPERIENCE.presentWindowDays * 24 * 60 * 60 * 1000;
  const start = first ? monthYear(exp.first_lesson_at as string, i18n.language) : "";
  const range = withinPresent
    ? t("experience.range_present", { start })
    : last
      ? t("experience.range_ended", {
          start,
          end: monthYear(exp.last_lesson_at as string, i18n.language),
        })
      : start;
  const text = [
    t("experience.lessons", { count: Number(exp.total_lessons) }),
    t("experience.hours", { hours: formatExperienceHours(Number(exp.total_hours)) }),
    range,
  ].join(" · ");
  return { text, title: t("experience.pill_title") };
}

/** Small pill on the public tutor card (badge anatomy, zero-state hidden). */
export function ExperiencePill({ tutorId, className }: { tutorId: string; className?: string }) {
  const data = useExperienceText(tutorId);
  if (!data) return null;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center whitespace-normal rounded-md border border-border bg-muted px-1.5 py-0.5 text-center text-[11px] font-bold leading-tight text-[color:var(--ink)]",
        className,
      )}
      title={data.title}
    >
      {data.text}
    </span>
  );
}

/** Profile-header line under the tutor's headline. */
export function ExperienceLine({ tutorId, className }: { tutorId: string; className?: string }) {
  const data = useExperienceText(tutorId);
  if (!data) return null;
  return (
    <p className={cn("text-sm text-muted-foreground", className)} title={data.title}>
      {data.text}
    </p>
  );
}
