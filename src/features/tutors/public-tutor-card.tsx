import { type MouseEvent, type ReactNode, useState } from "react";
import { Award, ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import { getTutorGenderLabel, type Tutor } from "@/features/tutors/queries";
import {
  formatTutorCode,
  formatTutorGradeLabel,
  type TutorSubjectChip,
} from "@/features/tutors/tutor-display";
import { cn } from "@/lib/utils";

const RESULTS_PER_PAGE = 3;

function getTutorInitials(tutorCode?: string | null) {
  const normalized = (tutorCode ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!normalized) return "MM";
  return normalized.slice(0, 2);
}

function removeEmoji(value: string) {
  return value
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function splitGradeLabel(grade: string | null) {
  if (!grade) return null;
  const match = grade.match(/^(Grade\s+)(.+)$/i);
  if (!match) return { prefix: "", value: grade };
  return { prefix: match[1], value: match[2] };
}

function AcademicResultChip({ chip }: { chip: TutorSubjectChip }) {
  const grade = splitGradeLabel(chip.grade);

  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-[color:var(--brand-teal)]/55 bg-[color:var(--brand-teal)]/10 px-2.5 py-1 text-[10px] font-bold leading-none text-[color:var(--brand-navy)] md:px-3 md:py-1.5 md:text-[11px]">
      {chip.subject}
      {grade ? (
        <>
          <span className="mx-1 text-[color:var(--brand-teal)]">:</span>
          <span className="font-black">
            {grade.prefix}
            {grade.value}
          </span>
        </>
      ) : null}
    </span>
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
  const primaryExam = (tutor.exam_results ?? []).find((result) =>
    result.subjects.some((entry) => entry.subject.trim()),
  );
  const academicChips = (primaryExam?.subjects ?? [])
    .map((entry) => ({
      subject: entry.subject.trim(),
      grade: formatTutorGradeLabel(entry.grade),
    }))
    .filter((entry) => entry.subject);
  const [academicPage, setAcademicPage] = useState(0);
  const maxAcademicPage = Math.max(0, Math.ceil(academicChips.length / RESULTS_PER_PAGE) - 1);
  const visibleAcademicPage = Math.min(academicPage, maxAcademicPage);
  const visibleAcademicChips = academicChips.slice(
    visibleAcademicPage * RESULTS_PER_PAGE,
    visibleAcademicPage * RESULTS_PER_PAGE + RESULTS_PER_PAGE,
  );
  const hasAcademicPager = academicChips.length > RESULTS_PER_PAGE;
  const genderLabel = getTutorGenderLabel(tutor.gender);
  const primaryCredential = removeEmoji(
    tutor.university ?? tutor.academic_summary ?? "Academic profile verified",
  );
  const supportingCredentials = [tutor.highschool, tutor.academic_summary]
    .map((value) => (value ? removeEmoji(value) : ""))
    .filter((value) => value && value !== primaryCredential)
    .slice(0, 2);

  const changeAcademicPage = (event: MouseEvent<HTMLButtonElement>, direction: -1 | 1) => {
    event.stopPropagation();
    setAcademicPage((current) => Math.max(0, Math.min(maxAcademicPage, current + direction)));
  };

  return (
    <article
      className={cn(
        "flex h-full min-h-[23rem] w-full flex-col overflow-hidden rounded-[10px] border border-[color:var(--brand-teal)]/25 bg-white shadow-[0_10px_30px_rgba(4,19,68,0.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(4,19,68,0.10)] md:min-h-[28rem]",
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
      <header className="border-b border-[color:var(--brand-teal)]/20 bg-white px-3 py-3 md:px-4 md:py-4">
        <div className="flex items-start gap-2.5 md:gap-3.5">
          <div className="flex w-12 shrink-0 flex-col items-center gap-1.5 md:w-14">
            {tutor.photo_url ? (
              <img
                src={tutor.photo_url}
                alt={`Tutor ${formatTutorCode(tutor.tutor_code)}`}
                className="h-11 w-11 rounded-[6px] border border-border bg-muted object-cover shadow-sm md:h-[3.25rem] md:w-[3.25rem]"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-[6px] border border-border bg-muted text-sm font-bold text-[color:var(--brand-navy)] shadow-sm md:h-[3.25rem] md:w-[3.25rem] md:text-base">
                {getTutorInitials(tutor.tutor_code)}
              </div>
            )}
            <p className="whitespace-nowrap text-[8px] font-semibold tracking-wide text-muted-foreground md:text-[9px]">
              {formatTutorCode(tutor.tutor_code)}
            </p>
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <p className="line-clamp-2 text-[14px] font-black leading-tight tracking-tight text-[color:var(--brand-navy)] md:text-[17px]">
              {primaryCredential}
            </p>
            {supportingCredentials.map((credential, index) => (
              <p
                key={`${credential}-${index}`}
                className="mt-1 line-clamp-1 text-[9px] font-medium leading-tight text-muted-foreground md:text-[11px]"
              >
                {credential}
              </p>
            ))}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            {genderLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[9px] font-bold text-[color:var(--brand-navy)] md:px-2.5 md:text-[10px]">
                <UserRound className="h-3 w-3 text-[color:var(--brand-teal)]" aria-hidden="true" />
                {genderLabel}
              </span>
            ) : null}
            {badgeLabel ? (
              <span className="rounded-full border border-[color:var(--brand-teal)]/25 bg-[color:var(--brand-teal)]/8 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[color:var(--brand-navy)] md:text-[9px]">
                {badgeLabel}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col px-3 pb-3.5 pt-3 md:px-4 md:pb-4 md:pt-3.5">
        {academicChips.length > 0 ? (
          <section className="border-b border-[color:var(--brand-teal)]/20 pb-3 md:pb-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[13px] font-black tracking-tight text-[color:var(--brand-navy)] md:text-[15px]">
                Academic achievements
              </h3>
              {hasAcademicPager ? (
                <span className="text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground md:text-[9px]">
                  {visibleAcademicPage + 1} / {maxAcademicPage + 1}
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex min-h-[2.1rem] items-center gap-1.5 md:gap-2">
              {hasAcademicPager ? (
                <button
                  type="button"
                  aria-label="Previous academic achievements"
                  disabled={visibleAcademicPage === 0}
                  onClick={(event) => changeAcademicPage(event, -1)}
                  onKeyDown={(event) => event.stopPropagation()}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[color:var(--brand-teal)]/40 bg-[color:var(--brand-teal)]/10 text-[color:var(--brand-navy)] transition-colors hover:bg-[color:var(--brand-teal)]/20 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground md:h-7 md:w-7"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
              <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-hidden md:gap-2">
                {visibleAcademicChips.map((chip, index) => (
                  <AcademicResultChip key={`${chip.subject}-${index}`} chip={chip} />
                ))}
              </div>
              {hasAcademicPager ? (
                <button
                  type="button"
                  aria-label="Next academic achievements"
                  disabled={visibleAcademicPage === maxAcademicPage}
                  onClick={(event) => changeAcademicPage(event, 1)}
                  onKeyDown={(event) => event.stopPropagation()}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[color:var(--brand-teal)]/40 bg-[color:var(--brand-teal)]/10 text-[color:var(--brand-navy)] transition-colors hover:bg-[color:var(--brand-teal)]/20 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground md:h-7 md:w-7"
                >
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className={cn("flex flex-1 flex-col", academicChips.length > 0 ? "pt-3" : "pt-0")}>
          <h3 className="flex items-center gap-1.5 text-[11px] font-black tracking-tight text-[color:var(--brand-navy)] md:text-[12px]">
            <Award className="h-3.5 w-3.5 text-[color:var(--brand-teal)]" aria-hidden="true" />
            Achievements and Experiences
          </h3>

          {tutor.achievements.length > 0 ? (
            <ul className="mt-1.5 space-y-1.5">
              {tutor.achievements.slice(0, 3).map((achievement, index) => (
                <li
                  key={`${achievement.short_text}-${index}`}
                  className="flex gap-1.5 text-[10px] font-medium leading-snug text-[color:var(--brand-navy)] md:text-[11px]"
                >
                  <Award
                    className="mt-0.5 h-3 w-3 shrink-0 text-[color:var(--brand-teal)]"
                    aria-hidden="true"
                  />
                  <span className="line-clamp-1">{removeEmoji(achievement.short_text)}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <p className="mt-2.5 line-clamp-3 text-[12px] font-bold leading-snug tracking-tight text-[color:var(--brand-navy)] md:mt-3 md:text-[14px]">
            {removeEmoji(
              tutor.headline ?? "Experienced tutor matching students with tailored support",
            )}
          </p>
        </section>
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-[color:var(--brand-teal)]/20 bg-white px-3 py-2.5 md:gap-3 md:px-4 md:py-3">
        <p className="text-xl font-black leading-none tracking-tight text-[color:var(--brand-navy)] md:text-3xl">
          HK${tutor.hourly_rate}
          <span className="ml-1 text-[10px] font-semibold text-muted-foreground md:text-[13px]">
            {priceSuffix}
          </span>
        </p>
        {footerAction}
      </footer>
    </article>
  );
}
