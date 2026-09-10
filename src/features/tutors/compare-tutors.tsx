import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getTutorGenderLabel,
  getTutorLessonModeLabel,
  type Tutor,
} from "@/features/tutors/queries";
import {
  buildTutorWhatsAppUrl,
  formatTutorCode,
  getTutorSubjectGroups,
} from "@/features/tutors/tutor-display";
import { setCompareBarVisible } from "@/lib/compare-bar";

export const MAX_COMPARE = 4;

function formatSubjectGroups(tutor: Tutor): string[] {
  return getTutorSubjectGroups(tutor).map((group) => {
    const systemLabel =
      { ib: "IBDP", dse: "HKDSE", alevel: "A-Level", igcse: "IGCSE", ap: "AP", sat: "SAT" }[
        group.systemId
      ] ?? "Other";
    return `${systemLabel}: ${group.subjects.join(", ")}`;
  });
}

function CompareBar({
  selectedTutors,
  onOpenCompare,
  onClear,
}: {
  selectedTutors: Tutor[];
  onOpenCompare: () => void;
  onClear: () => void;
}) {
  const count = selectedTutors.length;
  return (
    <div className="fixed bottom-20 left-1/2 z-40 w-[min(92vw,30rem)] -translate-x-1/2 sm:bottom-6">
      <div className="flex items-center justify-between gap-3 rounded-full border border-[color:var(--foreground)]/15 bg-[color:var(--surface)] px-4 py-2.5 shadow-[0_16px_40px_rgba(4,19,68,0.18)]">
        <div className="flex min-w-0 items-center gap-2">
          <ListChecks
            className="h-4 w-4 shrink-0 text-[color:var(--muted-foreground)]"
            aria-hidden="true"
          />
          <p className="truncate text-sm font-semibold text-[color:var(--ink)]">
            {count} of {MAX_COMPARE} selected
            {count === 1 ? " — pick at least 2" : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            className="h-9 rounded-full px-4 text-[13px] font-bold"
            disabled={count < 2}
            onClick={onOpenCompare}
          >
            Compare
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-9 rounded-full px-3 text-[13px] font-bold text-[color:var(--ink)] hover:bg-[color:var(--surface-subtle)]"
            onClick={onClear}
          >
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}

function CompareDialog({
  open,
  onOpenChange,
  tutors,
  whatsappNumber,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tutors: Tutor[];
  whatsappNumber: string;
}) {
  const columns = `minmax(7.5rem, 0.9fr) repeat(${tutors.length}, minmax(10.5rem, 1.4fr))`;
  const rows: { label: string; render: (t: Tutor) => React.ReactNode }[] = [
    {
      label: "Rate",
      render: (t) => (
        <p className="text-lg font-bold text-[color:var(--ink)]">
          HK${t.hourly_rate}
          <span className="ml-1 text-xs font-semibold text-muted-foreground">/hr</span>
        </p>
      ),
    },
    {
      label: "Academic background",
      render: (t) => (
        <div className="space-y-0.5">
          {[t.academic_headline, t.university, t.secondary_school]
            .filter(Boolean)
            .slice(0, 2)
            .map((line, index) => (
              <p
                key={index}
                className="text-[13px] font-semibold leading-snug text-[color:var(--ink)]"
              >
                {line}
              </p>
            ))}
          {!t.academic_headline && !t.university && !t.secondary_school ? (
            <span className="text-sm text-muted-foreground">—</span>
          ) : null}
        </div>
      ),
    },
    {
      label: "Subjects",
      render: (t) => {
        const groups = formatSubjectGroups(t);
        if (groups.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <div className="space-y-1">
            {groups.map((line) => (
              <p
                key={line}
                className="text-[13px] font-semibold leading-snug text-[color:var(--ink)]"
              >
                {line}
              </p>
            ))}
          </div>
        );
      },
    },
    {
      label: "Lesson mode",
      render: (t) => (
        <p className="text-[13px] font-semibold text-[color:var(--ink)]">
          {(getTutorLessonModeLabel(t.lesson_mode) ?? "—").replace(/ tutoring$/, "")}
        </p>
      ),
    },
    {
      label: "Location",
      render: (t) => (
        <p className="text-[13px] font-semibold text-[color:var(--ink)]">
          {t.stations.length > 0 ? t.stations.slice(0, 3).join(", ") : (t.district ?? "—")}
        </p>
      ),
    },
    {
      label: "Gender",
      render: (t) => {
        const label = getTutorGenderLabel(t.gender);
        return <p className="text-[13px] font-semibold text-[color:var(--ink)]">{label || "—"}</p>;
      },
    },
    {
      label: "Languages",
      render: (t) => (
        <p className="text-[13px] font-semibold text-[color:var(--ink)]">
          {t.languages.length > 0 ? t.languages.join(", ") : "—"}
        </p>
      ),
    },
    {
      label: "Experience",
      render: (t) => (
        <p className="text-[13px] font-semibold text-[color:var(--ink)]">
          {t.experience_years != null ? `${t.experience_years} yrs` : "—"}
        </p>
      ),
    },
    {
      label: "Achievements",
      render: (t) =>
        t.achievements.length > 0 ? (
          <ul className="space-y-1">
            {t.achievements.slice(0, 2).map((a, index) => (
              <li key={index} className="text-[13px] leading-snug text-muted-foreground">
                • {a.short_text}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      label: "",
      render: (t) => (
        <Button asChild size="sm" className="h-9 rounded-sm px-4 text-[13px] font-bold shadow-none">
          <a
            href={buildTutorWhatsAppUrl(whatsappNumber, t.tutor_code)}
            target="_blank"
            rel="noreferrer"
          >
            Request tutor
          </a>
        </Button>
      ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-6xl overflow-y-auto rounded-sm p-0 sm:rounded-sm">
        <DialogHeader className="border-b border-border px-5 py-4 text-left sm:px-6">
          <DialogTitle className="text-lg font-bold tracking-tight text-[color:var(--ink)]">
            Compare tutors
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Side-by-side comparison of your shortlisted profiles.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto px-5 pb-6 sm:px-6">
          <div className="min-w-[36rem]" style={{ display: "grid", gridTemplateColumns: columns }}>
            <div />
            {tutors.map((t) => (
              <div key={t.id} className="px-3 py-3 text-center">
                {t.photo_url ? (
                  <img
                    src={t.photo_url}
                    alt={formatTutorCode(t.tutor_code)}
                    className="mx-auto h-12 w-12 rounded-full border border-border object-cover"
                  />
                ) : (
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-[color:var(--ink)]">
                    {formatTutorCode(t.tutor_code).slice(0, 2)}
                  </div>
                )}
                <p className="mt-1.5 text-sm font-semibold text-[color:var(--ink)]">
                  {formatTutorCode(t.tutor_code)}
                </p>
              </div>
            ))}
            {rows.map(({ label, render }) => (
              <div key={label || "actions"} className="contents">
                <div className="border-t border-border/70 px-2 py-3 text-[11px] font-medium text-muted-foreground">
                  {label}
                </div>
                {tutors.map((t) => (
                  <div
                    key={t.id}
                    className="border-t border-border/70 px-3 py-3 align-top text-left"
                  >
                    {render(t)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useTutorCompare(tutors: Tutor[]) {
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const compareTutors = useMemo(
    () =>
      compareIds
        .map((id) => tutors.find((tut) => tut.id === id))
        .filter((tut): tut is Tutor => Boolean(tut)),
    [compareIds, tutors],
  );

  const toggleCompare = (tutor: Tutor) => {
    setCompareIds((prev) => {
      if (prev.includes(tutor.id)) return prev.filter((id) => id !== tutor.id);
      if (prev.length >= MAX_COMPARE) {
        toast.error(`You can compare up to ${MAX_COMPARE} tutors.`);
        return prev;
      }
      return [...prev, tutor.id];
    });
  };

  const compareBarVisible = compareTutors.length > 0 && !compareOpen;

  useEffect(() => {
    setCompareBarVisible("tutor-compare", compareBarVisible);
    return () => setCompareBarVisible("tutor-compare", false);
  }, [compareBarVisible]);

  return {
    compareIds,
    compareTutors,
    toggleCompare,
    compareOpen,
    setCompareOpen,
    clearCompare: () => setCompareIds([]),
  };
}

export { CompareBar, CompareDialog };
