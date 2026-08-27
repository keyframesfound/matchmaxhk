import { type MouseEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Award, ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import { getTutorGenderLabel, type Tutor } from "@/features/tutors/queries";
import {
  formatTutorCode,
  getTutorSubjectChips,
  type TutorSubjectChip,
} from "@/features/tutors/tutor-display";
import { cn } from "@/lib/utils";

const RESULTS_PER_PAGE = 6;

function paginateAcademicChips(chips: TutorSubjectChip[]) {
  return Array.from({ length: Math.ceil(chips.length / RESULTS_PER_PAGE) }, (_, pageIndex) =>
    chips.slice(pageIndex * RESULTS_PER_PAGE, pageIndex * RESULTS_PER_PAGE + RESULTS_PER_PAGE),
  );
}

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
    <span className="inline-flex max-w-full items-center rounded-[4px] border border-[color:var(--brand-teal)]/45 bg-[color:var(--brand-teal)]/8 px-2 py-1 text-[9px] font-bold leading-tight text-[color:var(--brand-navy)] shadow-[0_1px_2px_rgba(4,19,68,0.04)] md:px-2.5 md:py-1.5 md:text-[10px]">
      <span className="max-w-[8.5rem] truncate">{chip.subject}</span>
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
  const academicChips = useMemo(() => getTutorSubjectChips(tutor), [tutor]);
  const academicPages = useMemo(() => paginateAcademicChips(academicChips), [academicChips]);
  const [academicPage, setAcademicPage] = useState(0);
  const [pageDirection, setPageDirection] = useState<"next" | "previous">("next");
  const achievementAreaRef = useRef<HTMLDivElement | null>(null);
  const measurementRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [achievementAreaHeight, setAchievementAreaHeight] = useState<number | null>(null);
  const maxAcademicPage = Math.max(0, academicPages.length - 1);
  const visibleAcademicPage = Math.min(academicPage, maxAcademicPage);
  const visibleAcademicChips = academicPages[visibleAcademicPage] ?? [];
  const hasAcademicPager = academicPages.length > 1;
  const genderLabel = getTutorGenderLabel(tutor.gender);
  const primaryCredential = removeEmoji(
    tutor.university ?? tutor.academic_summary ?? "Academic profile verified",
  );
  const supportingCredentials = [tutor.highschool, tutor.academic_summary]
    .map((value) => (value ? removeEmoji(value) : ""))
    .filter((value) => value && value !== primaryCredential)
    .slice(0, 2);

  useEffect(() => {
    measurementRefs.current = measurementRefs.current.slice(0, academicPages.length);

    const updateAchievementAreaHeight = () => {
      const maximumHeight = Math.max(
        0,
        ...measurementRefs.current.map((element) =>
          Math.ceil(element?.getBoundingClientRect().height ?? 0),
        ),
      );
      setAchievementAreaHeight(maximumHeight || null);
    };

    updateAchievementAreaHeight();
    const frame = window.requestAnimationFrame(updateAchievementAreaHeight);
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateAchievementAreaHeight);

    if (achievementAreaRef.current) resizeObserver?.observe(achievementAreaRef.current);
    window.addEventListener("resize", updateAchievementAreaHeight);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateAchievementAreaHeight);
    };
  }, [academicPages]);

  const changeAcademicPage = (event: MouseEvent<HTMLButtonElement>, direction: -1 | 1) => {
    event.stopPropagation();
    setPageDirection(direction === 1 ? "next" : "previous");
    setAcademicPage((current) => Math.max(0, Math.min(maxAcademicPage, current + direction)));
  };

  return (
    <article
      className={cn(
        "flex h-full min-h-[20rem] w-full flex-col overflow-hidden rounded-[10px] border border-[color:var(--brand-teal)]/25 bg-white shadow-[0_10px_30px_rgba(4,19,68,0.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(4,19,68,0.10)] md:min-h-[23rem]",
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
      <header className="border-b border-[color:var(--brand-teal)]/20 bg-white px-3 py-2.5 md:px-4 md:py-3">
        <div className="flex items-start gap-2.5 md:gap-3.5">
          <div className="flex w-12 shrink-0 flex-col items-center gap-1.5 md:w-14">
            {tutor.photo_url ? (
              <img
                src={tutor.photo_url}
                alt={`Tutor ${formatTutorCode(tutor.tutor_code)}`}
                className="h-11 w-11 rounded-full border border-border bg-muted object-cover md:h-[3.25rem] md:w-[3.25rem]"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted text-sm font-bold text-[color:var(--brand-navy)] md:h-[3.25rem] md:w-[3.25rem] md:text-base">
                {getTutorInitials(tutor.tutor_code)}
              </div>
            )}
            <p className="whitespace-nowrap text-[10px] font-bold tracking-wide text-muted-foreground md:text-[11px]">
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
                className="mt-1.5 line-clamp-1 text-[11px] font-semibold leading-snug text-muted-foreground md:text-[13px]"
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

      <div className="flex flex-1 flex-col px-3 pb-2.5 pt-2.5 md:px-4 md:pb-3 md:pt-3">
        {academicChips.length > 0 ? (
          <section className="border-b border-[color:var(--brand-teal)]/20 pb-2.5 md:pb-3">
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
            <div
              className={cn(
                "mt-2 grid items-stretch gap-1.5 md:gap-2",
                hasAcademicPager
                  ? "grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] md:grid-cols-[2rem_minmax(0,1fr)_2rem]"
                  : "grid-cols-1",
              )}
            >
              {hasAcademicPager ? (
                <button
                  type="button"
                  aria-label="Previous academic achievements"
                  disabled={visibleAcademicPage === 0}
                  onClick={(event) => changeAcademicPage(event, -1)}
                  onKeyDown={(event) => event.stopPropagation()}
                  className="flex w-7 items-center justify-center self-stretch rounded-md border border-white/70 bg-white/55 text-[color:var(--brand-navy)] shadow-sm backdrop-blur-md transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted/65 disabled:text-muted-foreground md:w-8"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
              <div
                ref={achievementAreaRef}
                className="relative min-w-0"
                style={achievementAreaHeight ? { minHeight: achievementAreaHeight } : undefined}
              >
                <div
                  key={visibleAcademicPage}
                  className={cn(
                    "flex min-w-0 flex-wrap content-start items-start gap-1.5 overflow-hidden md:gap-2",
                    hasAcademicPager && `tutor-achievement-page-${pageDirection}`,
                  )}
                >
                  {visibleAcademicChips.map((chip, index) => (
                    <AcademicResultChip key={`${chip.subject}-${index}`} chip={chip} />
                  ))}
                </div>

                <div
                  aria-hidden="true"
                  className="pointer-events-none invisible absolute inset-x-0 top-0 -z-10"
                >
                  {academicPages.map((page, pageIndex) => (
                    <div
                      key={pageIndex}
                      ref={(element) => {
                        measurementRefs.current[pageIndex] = element;
                      }}
                      className="flex flex-wrap content-start items-start gap-1.5 md:gap-2"
                    >
                      {page.map((chip, index) => (
                        <AcademicResultChip key={`${chip.subject}-${index}`} chip={chip} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              {hasAcademicPager ? (
                <button
                  type="button"
                  aria-label="Next academic achievements"
                  disabled={visibleAcademicPage === maxAcademicPage}
                  onClick={(event) => changeAcademicPage(event, 1)}
                  onKeyDown={(event) => event.stopPropagation()}
                  className="flex w-7 items-center justify-center self-stretch rounded-md border border-white/70 bg-white/55 text-[color:var(--brand-navy)] shadow-sm backdrop-blur-md transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted/65 disabled:text-muted-foreground md:w-8"
                >
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        <section
          className={cn("flex flex-1 flex-col", academicChips.length > 0 ? "pt-2.5" : "pt-0")}
        >
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

          <p className="mt-2 line-clamp-3 text-[12px] font-bold leading-snug tracking-tight text-[color:var(--brand-navy)] md:mt-2.5 md:text-[14px]">
            {removeEmoji(
              tutor.headline ?? "Experienced tutor matching students with tailored support",
            )}
          </p>
        </section>
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-[color:var(--brand-teal)]/20 bg-white px-3 py-2 md:gap-3 md:px-4 md:py-2.5">
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
