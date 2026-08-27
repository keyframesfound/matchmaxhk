import { type MouseEvent, type ReactNode, useState } from "react";
import { Award, BookOpen, ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import { getSystem, type ExamResult } from "@/features/tutors/examSystems";
import { getTutorGenderLabel, type Tutor } from "@/features/tutors/queries";
import {
  formatTutorCode,
  formatTutorGradeLabel,
  getTutorSubjectChips,
  type TutorSubjectChip,
} from "@/features/tutors/tutor-display";
import { cn } from "@/lib/utils";

const SUBJECTS_PER_PAGE = 3;

function getTutorInitials(tutorCode?: string | null) {
  const normalized = (tutorCode ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!normalized) return "MM";
  return normalized.slice(0, 2);
}

function splitGradeLabel(grade: string | null) {
  if (!grade) return null;
  const match = grade.match(/^(Grade\s+)(.+)$/i);
  if (!match) return { prefix: "", value: grade };
  return { prefix: match[1], value: match[2] };
}

function SubjectGradeChip({
  chip,
  compact = false,
}: {
  chip: TutorSubjectChip;
  compact?: boolean;
}) {
  const grade = splitGradeLabel(chip.grade);

  return (
    <span
      className={cn(
        "rounded-[2px] bg-[color:var(--brand-teal)]/12 font-semibold text-[color:var(--brand-navy)]",
        compact
          ? "px-1.5 py-0.5 text-[9px]"
          : "px-2 py-0.5 text-[10px] md:px-3 md:py-1 md:text-[12px]",
      )}
    >
      {chip.subject}
      {grade ? (
        <>
          {" : "}
          {grade.prefix}
          <span
            className={cn(
              "inline-block font-black leading-none tracking-tight text-[color:var(--brand-navy)]",
              compact ? "text-[10px]" : "text-[11px] md:text-[13px]",
            )}
          >
            {grade.value}
          </span>
        </>
      ) : null}
    </span>
  );
}

function CompactQualification({ result }: { result: ExamResult }) {
  const systemLabel = getSystem(result.system)?.label ?? result.system.toUpperCase();
  const chips = result.subjects
    .map((entry) => ({
      subject: entry.subject.trim(),
      grade: formatTutorGradeLabel(entry.grade),
    }))
    .filter((entry) => entry.subject);

  if (chips.length === 0) return null;

  return (
    <div className="rounded-xl border border-[color:var(--brand-teal)]/20 bg-[color:var(--brand-teal)]/6 px-2 py-1.5 md:px-2.5">
      <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground md:text-[9px]">
        {systemLabel}
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {chips.map((chip, index) => (
          <SubjectGradeChip key={`${chip.subject}-${index}`} chip={chip} compact />
        ))}
      </div>
    </div>
  );
}

type PublicTutorCardProps = {
  tutor: Tutor;
  priceSuffix: string;
  footerAction: ReactNode;
  onOpen?: (tutorCode: string) => void;
  badgeLabel?: string;
  className?: string;
};

export function PublicTutorCard({
  tutor,
  priceSuffix,
  footerAction,
  onOpen,
  badgeLabel,
  className,
}: PublicTutorCardProps) {
  const interactive = typeof onOpen === "function";
  const chips = getTutorSubjectChips(tutor);
  const examResults = (tutor.exam_results ?? []).filter((result) =>
    result.subjects.some((entry) => entry.subject.trim()),
  );
  const [subjectPage, setSubjectPage] = useState(0);
  const maxSubjectPage = Math.max(0, Math.ceil(chips.length / SUBJECTS_PER_PAGE) - 1);
  const visibleSubjectPage = Math.min(subjectPage, maxSubjectPage);
  const visibleChips = chips.slice(
    visibleSubjectPage * SUBJECTS_PER_PAGE,
    visibleSubjectPage * SUBJECTS_PER_PAGE + SUBJECTS_PER_PAGE,
  );
  const hasSubjectPager = chips.length > SUBJECTS_PER_PAGE;
  const primaryExam = examResults[0];
  const secondaryExam = examResults[1];

  const changeSubjectPage = (event: MouseEvent<HTMLButtonElement>, direction: -1 | 1) => {
    event.stopPropagation();
    setSubjectPage((current) => Math.max(0, Math.min(maxSubjectPage, current + direction)));
  };

  return (
    <article
      className={cn(
        "flex h-full min-h-[24rem] w-full flex-col overflow-hidden rounded-[10px] border border-[color:var(--brand-teal)]/25 bg-white shadow-[0_10px_30px_rgba(4,19,68,0.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(4,19,68,0.10)] md:min-h-[30rem]",
        interactive && "cursor-pointer",
        className,
      )}
      role={interactive ? "link" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? () => onOpen(tutor.tutor_code) : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen(tutor.tutor_code);
              }
            }
          : undefined
      }
    >
      <div className="bg-[color:var(--brand-navy)] px-3 pb-2.5 pt-2.5 md:px-4 md:pb-4 md:pt-4">
        <div className="flex items-center gap-2.5 md:gap-4">
          {tutor.photo_url ? (
            <img
              src={tutor.photo_url}
              alt={tutor.tutor_code}
              className="h-11 w-11 shrink-0 rounded-full border-[3px] border-[color:var(--brand-teal)] object-cover shadow-sm md:h-14 md:w-14"
            />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[3px] border-[color:var(--brand-teal)] bg-[color:var(--brand-teal)]/10 text-sm font-bold text-[color:var(--brand-teal)] shadow-sm md:h-14 md:w-14 md:text-lg">
              {getTutorInitials(tutor.tutor_code)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-lg font-black tracking-tight text-white md:text-2xl">
              {formatTutorCode(tutor.tutor_code)}
            </p>
            <p className="mt-0.5 line-clamp-2 min-h-[1.5rem] text-[10px] font-semibold leading-tight text-white/95 md:min-h-[2rem] md:text-[12px]">
              {tutor.university ?? tutor.highschool ?? "University - From Database"}
            </p>
          </div>
          {badgeLabel ? (
            <span className="rounded-sm border border-white/20 bg-white/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white md:py-1 md:text-[10px]">
              {badgeLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-3 pb-3.5 pt-2.5 md:px-4 md:pb-5 md:pt-3">
        <h3 className="text-[11px] font-bold tracking-tight text-[color:var(--brand-navy)] md:text-[13px]">
          Subject Taught
        </h3>
        <div className="mt-1.5 flex min-h-[2.25rem] items-center gap-1.5 md:min-h-[2.75rem] md:gap-2">
          {hasSubjectPager ? (
            <button
              type="button"
              aria-label="Previous subjects"
              disabled={visibleSubjectPage === 0}
              onClick={(event) => changeSubjectPage(event, -1)}
              onKeyDown={(event) => event.stopPropagation()}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[color:var(--brand-teal)]/40 bg-[color:var(--brand-teal)]/12 text-[color:var(--brand-navy)] transition-colors hover:bg-[color:var(--brand-teal)]/20 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground md:h-7 md:w-7"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-nowrap items-start gap-1.5 overflow-hidden md:gap-2">
            {visibleChips.map((chip, index) => (
              <SubjectGradeChip key={`${chip.subject}-${index}`} chip={chip} />
            ))}
          </div>
          {hasSubjectPager ? (
            <button
              type="button"
              aria-label="Next subjects"
              disabled={visibleSubjectPage === maxSubjectPage}
              onClick={(event) => changeSubjectPage(event, 1)}
              onKeyDown={(event) => event.stopPropagation()}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[color:var(--brand-teal)]/40 bg-[color:var(--brand-teal)]/12 text-[color:var(--brand-navy)] transition-colors hover:bg-[color:var(--brand-teal)]/20 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground md:h-7 md:w-7"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {primaryExam ? (
          <div className="mt-2.5">
            <h3 className="text-[10px] font-bold tracking-tight text-[color:var(--brand-navy)] md:text-[11px]">
              Academic Excellence
            </h3>
            <div className={cn("mt-1.5 grid gap-1.5", secondaryExam && "md:grid-cols-2")}>
              <CompactQualification result={primaryExam} />
              {secondaryExam ? <CompactQualification result={secondaryExam} /> : null}
            </div>
          </div>
        ) : null}

        {tutor.achievements.length > 0 ? (
          <div className="mt-2.5">
            <h3 className="flex items-center gap-1 text-[10px] font-bold tracking-tight text-[color:var(--brand-navy)] md:text-[11px]">
              <Award className="h-3.5 w-3.5 text-[color:var(--brand-teal)]" aria-hidden="true" />
              Achievements and Experiences
            </h3>
            <ul className="mt-1 space-y-1">
              {tutor.achievements.slice(0, 3).map((achievement, index) => (
                <li
                  key={`${achievement.short_text}-${index}`}
                  className="flex gap-1.5 text-[10px] font-medium leading-snug text-[color:var(--brand-navy)] md:text-[11px]"
                >
                  <Award
                    className="mt-0.5 h-3 w-3 shrink-0 text-[color:var(--brand-teal)]"
                    aria-hidden="true"
                  />
                  <span className="line-clamp-1">{achievement.short_text}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <h3 className="mt-2.5 line-clamp-3 text-[12px] font-bold leading-snug tracking-tight text-[color:var(--brand-navy)] md:mt-3 md:text-[14px]">
          {tutor.headline ?? "Experienced tutor matching students with tailored support"}
        </h3>

        <div className="mt-auto grid grid-cols-2 gap-2 border-t border-[color:var(--brand-teal)]/20 pt-2.5 md:pt-4">
          <div>
            <p className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground md:text-[11px]">
              Target Student
            </p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold leading-tight text-[color:var(--brand-navy)] md:text-[13px]">
              <BookOpen className="h-3 w-3 text-[color:var(--brand-navy)] md:h-4 md:w-4" />
              {tutor.target_students[0] ?? "IB, Senior Secondary"}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground md:text-[11px]">
              Gender
            </p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold leading-tight text-[color:var(--brand-navy)] md:text-[13px]">
              <UserRound className="h-3 w-3 text-[color:var(--brand-navy)] md:h-4 md:w-4" />
              {getTutorGenderLabel(tutor.gender) || "Not specified"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[color:var(--brand-teal)]/20 bg-white px-3 py-1.5 md:gap-3 md:px-4 md:py-2.5">
        <p className="text-xl font-black leading-none tracking-tight text-[color:var(--brand-navy)] md:text-3xl">
          HK${tutor.hourly_rate}
          <span className="ml-1 text-[10px] font-semibold text-muted-foreground md:text-[13px]">
            {priceSuffix}
          </span>
        </p>
        {footerAction}
      </div>
    </article>
  );
}
