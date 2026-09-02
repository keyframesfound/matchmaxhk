import { type MouseEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Award, UserRound } from "lucide-react";
import { getTutorGenderLabel, type Tutor } from "@/features/tutors/queries";
import {
  formatTutorCode,
  getTutorSubjectChips,
  type TutorSubjectChip,
} from "@/features/tutors/tutor-display";
import { cn } from "@/lib/utils";

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
    <span
      data-academic-chip
      className="inline-flex max-w-full items-start rounded-[4px] border border-[color:var(--brand-teal)]/45 bg-[color:var(--brand-teal)]/8 px-2 py-1 text-[9px] font-bold leading-snug text-[color:var(--ink)] shadow-[0_1px_2px_rgba(4,19,68,0.04)] md:px-2.5 md:py-1.5 md:text-[10px]"
    >
      <span className="break-words">{chip.subject}</span>
      {grade ? (
        <>
          <span className="mx-0.5 shrink-0 text-[color:var(--brand-teal)]">:</span>
          <span className="shrink-0 font-black">
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
  saveAction?: ReactNode;
  onOpen?: (tutorCode: string) => void;
  badgeLabel?: string;
  className?: string;
};

export function PublicTutorCard({
  tutor,
  priceSuffix,
  footerAction,
  saveAction,
  onOpen,
  badgeLabel,
  className,
}: PublicTutorCardProps) {
  const interactive = typeof onOpen === "function";
  const academicChips = useMemo(() => getTutorSubjectChips(tutor), [tutor]);
  const academicChipsRef = useRef<HTMLDivElement | null>(null);
  const academicWidthRef = useRef<number | null>(null);
  const [areAcademicChipsExpanded, setAreAcademicChipsExpanded] = useState(false);
  const [visibleAcademicChipCount, setVisibleAcademicChipCount] = useState(academicChips.length);
  const genderLabel = getTutorGenderLabel(tutor.gender);
  const primaryCredential = removeEmoji(
    tutor.academic_headline ??
      tutor.university ??
      tutor.secondary_school ??
      "Academic profile verified",
  );
  const supportingCredentials = [tutor.university, tutor.secondary_school]
    .map((value) => (value ? removeEmoji(value) : ""))
    .filter((value) => value && value !== primaryCredential)
    .slice(0, 2);

  useEffect(() => {
    setAreAcademicChipsExpanded(false);
    academicWidthRef.current = null;
    setVisibleAcademicChipCount(academicChips.length);
  }, [academicChips]);

  useEffect(() => {
    if (areAcademicChipsExpanded) return;

    const measureAcademicPreview = () => {
      const container = academicChipsRef.current;
      if (!container) return;

      if (academicWidthRef.current !== container.clientWidth) {
        academicWidthRef.current = container.clientWidth;
        if (visibleAcademicChipCount !== academicChips.length) {
          setVisibleAcademicChipCount(academicChips.length);
          return;
        }
      }

      const chips = Array.from(container.querySelectorAll<HTMLElement>("[data-academic-chip]"));
      const button = container.querySelector<HTMLElement>("[data-academic-more]");
      const rowOffsets = Array.from(
        new Set([...chips, ...(button ? [button] : [])].map((item) => item.offsetTop)),
      ).sort(
        (first, second) => first - second,
      );

      if (visibleAcademicChipCount === academicChips.length) {
        if (rowOffsets.length > 2) {
          setVisibleAcademicChipCount(Math.max(0, academicChips.length - 1));
        }
        return;
      }

      if (button && rowOffsets.indexOf(button.offsetTop) > 1) {
        setVisibleAcademicChipCount((count) => Math.max(0, count - 1));
      }
    };

    const frame = window.requestAnimationFrame(measureAcademicPreview);
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measureAcademicPreview);

    if (academicChipsRef.current) resizeObserver?.observe(academicChipsRef.current);
    window.addEventListener("resize", measureAcademicPreview);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measureAcademicPreview);
    };
  }, [academicChips, areAcademicChipsExpanded, visibleAcademicChipCount]);

  const toggleAcademicChips = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setAreAcademicChipsExpanded((expanded) => !expanded);
  };

  return (
    <article
      className={cn(
        "flex h-full min-h-[20rem] w-full flex-col overflow-hidden rounded-[10px] border border-[color:var(--brand-teal)]/25 bg-[color:var(--surface)] shadow-[0_10px_30px_rgba(4,19,68,0.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(4,19,68,0.10)] md:min-h-[23rem]",
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
      <header className="relative border-b border-[color:var(--brand-teal)]/20 bg-[color:var(--surface)] px-3 py-2.5 md:px-4 md:py-3">
        <div className="flex items-start gap-2.5 md:gap-3.5">
          <div className="flex w-12 shrink-0 flex-col items-center gap-1.5 md:w-14">
            {tutor.photo_url ? (
              <img
                src={tutor.photo_url}
                alt={`Tutor ${formatTutorCode(tutor.tutor_code)}`}
                className="h-11 w-11 rounded-full border border-border bg-muted object-cover md:h-[3.25rem] md:w-[3.25rem]"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted text-sm font-bold text-[color:var(--ink)] md:h-[3.25rem] md:w-[3.25rem] md:text-base">
                {getTutorInitials(tutor.tutor_code)}
              </div>
            )}
            <p className="whitespace-nowrap text-[10px] font-bold tracking-wide text-muted-foreground md:text-[11px]">
              {formatTutorCode(tutor.tutor_code)}
            </p>
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <p className="line-clamp-2 text-[14px] font-black leading-tight tracking-tight text-[color:var(--ink)] md:pr-20 md:text-[17px]">
              {primaryCredential}
            </p>
            {supportingCredentials.map((credential, index) => (
              <p
                key={`${credential}-${index}`}
                className="mt-1.5 text-[11px] font-semibold leading-snug text-muted-foreground md:text-[13px]"
              >
                {credential}
              </p>
            ))}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1 md:absolute md:right-4 md:top-3">
            {genderLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[9px] font-bold text-[color:var(--ink)] md:px-2.5 md:text-[10px]">
                <UserRound className="h-3 w-3 text-[color:var(--brand-teal)]" aria-hidden="true" />
                {genderLabel}
              </span>
            ) : null}
            {badgeLabel ? (
              <span className="rounded-full border border-[color:var(--brand-teal)]/25 bg-[color:var(--brand-teal)]/8 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[color:var(--ink)] md:text-[9px]">
                {badgeLabel}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col px-3 pb-2.5 pt-2.5 md:px-4 md:pb-3 md:pt-3">
        {academicChips.length > 0 ? (
          <section className="border-b border-[color:var(--brand-teal)]/20 pb-2.5 md:pb-3">
            <h3 className="text-[13px] font-black tracking-tight text-[color:var(--ink)] md:text-[15px]">
              Academic achievements
            </h3>
            <div className="relative mt-2">
              <div
                id={`academic-achievements-${tutor.tutor_code}`}
                ref={academicChipsRef}
                className="flex flex-wrap items-start gap-2 overflow-hidden transition-[max-height,opacity] duration-300 ease-out"
              >
                {academicChips
                  .slice(0, areAcademicChipsExpanded ? undefined : visibleAcademicChipCount)
                  .map((chip, index) => (
                  <AcademicResultChip key={`${chip.subject}-${index}`} chip={chip} />
                  ))}
                {!areAcademicChipsExpanded && visibleAcademicChipCount < academicChips.length ? (
                  <button
                    data-academic-more
                    type="button"
                    aria-expanded={false}
                    aria-controls={`academic-achievements-${tutor.tutor_code}`}
                    onClick={toggleAcademicChips}
                    onKeyDown={(event) => event.stopPropagation()}
                    className="inline-flex items-center self-center px-0.5 py-1 text-[11px] font-bold leading-snug text-[color:var(--brand-link)] underline-offset-2 transition-colors hover:text-[color:var(--ink)] hover:underline md:py-1.5 md:text-[12px]"
                  >
                    ... more
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <section
          className={cn("flex flex-1 flex-col", academicChips.length > 0 ? "pt-2.5" : "pt-0")}
        >
          <h3 className="flex items-center gap-1.5 text-[11px] font-black tracking-tight text-[color:var(--ink)] md:text-[12px]">
            <Award className="h-3.5 w-3.5 text-[color:var(--brand-teal)]" aria-hidden="true" />
            Achievements and Experiences
          </h3>

          {tutor.achievements.length > 0 ? (
            <ul className="mt-1.5 space-y-1.5">
              {tutor.achievements.slice(0, 3).map((achievement, index) => (
                <li
                  key={`${achievement.short_text}-${index}`}
                  className="flex gap-1.5 text-[10px] font-medium leading-snug text-[color:var(--ink)] md:text-[11px]"
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

          <p className="mt-2 line-clamp-3 text-[12px] font-bold leading-snug tracking-tight text-[color:var(--ink)] md:mt-2.5 md:text-[14px]">
            {removeEmoji(
              tutor.headline ?? "Experienced tutor matching students with tailored support",
            )}
          </p>
        </section>
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-[color:var(--brand-teal)]/20 bg-[color:var(--surface)] px-3 py-2 md:gap-3 md:px-4 md:py-2.5">
        <p className="text-xl font-black leading-none tracking-tight text-[color:var(--ink)] md:text-3xl">
          HK${tutor.hourly_rate}
          <span className="ml-1 text-[10px] font-semibold text-muted-foreground md:text-[13px]">
            {priceSuffix}
          </span>
        </p>
        <div className="flex items-center gap-1.5 md:gap-2">
          {saveAction}
          {footerAction}
        </div>
      </footer>
    </article>
  );
}
