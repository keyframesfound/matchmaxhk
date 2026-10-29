import { type MouseEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Award,
  BadgeCheck,
  CalendarDays,
  Check,
  Columns2,
  GraduationCap,
  Hash,
  LineChart,
  School,
  Share2,
  UserRound,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getTutorCardHighlights, type Tutor } from "@/features/tutors/queries";
import {
  formatAvailabilityDate,
  formatTutorCode,
  getTutorAvailabilityReadiness,
  getTutorEducationLines,
  getTutorPriceDisplay,
  getTutorStatusLabelKey,
  type TutorSubjectChip,
} from "@/features/tutors/tutor-display";
import { groupRateFloor } from "@/features/tutors/rates";
import {
  isParentFavorite,
  selectDemandBadge,
  type EngagementSummary,
} from "@/features/tutors/engagement";
import {
  DemandBadge,
  GroupClassBadge,
  ParentFavoriteBadge,
} from "@/features/tutors/engagement-badges";
import { ExperiencePill } from "@/features/tutors/experience-badge";
import { useFitText } from "@/hooks/use-fit-text";
import { shareOrCopy } from "@/lib/share";
import { cn } from "@/lib/utils";
import { academicTierLabel } from "@/features/tutors/verticals-labels";
import { getActiveCustomHeadline } from "@/features/tutors/custom-headline";
import {
  buildCoreAcademicBreakdown,
  countCoreAcademicGrades,
} from "@/features/tutors/core-academic-breakdown";
import { useDisplayCurrency } from "@/features/currency/display-currency-context";
import { convertedTextFromHkd } from "@/features/currency/convert";
import { DEFAULT_CURRENCY, formatMoney, toCurrencyCode } from "@/lib/money";
import { InitialAvatar } from "@/components/ui/initial-avatar";

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
      className="inline-flex max-w-full items-start rounded-[4px] border border-[color:var(--foreground)]/15 bg-[color:var(--foreground)]/[0.04] px-1.5 py-0.5 text-xs leading-snug text-[color:var(--ink)] md:px-2 md:py-1 @max-sm:text-[11px]"
    >
      <span className="break-words font-medium">{chip.subject}</span>
      {grade ? (
        <>
          <span className="mx-0.5 shrink-0 text-muted-foreground">:</span>
          <span className="shrink-0 font-semibold">
            {grade.prefix}
            {grade.value}
          </span>
        </>
      ) : null}
    </span>
  );
}

type FitTextProps = {
  as: "p" | "li";
  maxLines: 1 | 2;
  contentKey: string | number;
  className?: string;
  children: ReactNode;
  /** Native hover tooltip (#114): the tutor's own quoted figure. */
  title?: string;
};

function FitText({ as, maxLines, contentKey, className, children, title }: FitTextProps) {
  const ref = useFitText<HTMLParagraphElement & HTMLLIElement>({
    maxLines,
    contentKey,
  });

  if (as === "li") {
    return (
      <li ref={ref} className={className} title={title}>
        {children}
      </li>
    );
  }

  return (
    <p ref={ref} className={className} title={title}>
      {children}
    </p>
  );
}

type PublicTutorCardProps = {
  tutor: Tutor;
  priceSuffix: string;
  footerAction: ReactNode;
  saveAction?: ReactNode;
  onOpen?: (tutorCode: string) => void;
  className?: string;
  compareSelected?: boolean;
  onCompareToggle?: () => void;
  shareable?: boolean;
  /** Issue #217: clicking a profile-tag chip searches /tutors?tag=<tag>. */
  tagQuery?: (tag: string) => void;
  /** data-tour anchor for the coach-mark tours (issue #397). */
  tourId?: string;
  /** Issues #102/#151: engagement summary from get_tutor_engagement. When
   *  absent (or null) no demand / Parent Favorite badges render. */
  engagement?: EngagementSummary | null;
};

export function PublicTutorCard({
  tutor,
  priceSuffix,
  footerAction,
  saveAction,
  onOpen,
  className,
  compareSelected,
  onCompareToggle,
  shareable = true,
  tagQuery,
  tourId,
  engagement,
}: PublicTutorCardProps) {
  const { t, i18n } = useTranslation();
  // Issue #114: honor the visitor's display currency; the native-figure
  // tooltip only appears when the tutor quotes in a different currency.
  const { currency: displayCurrency, rates: fxRates } = useDisplayCurrency();
  const interactive = typeof onOpen === "function";
  // Issue #309: the academic chips show APPROVED tutor_grades labels only.
  // Pending/rejected rows never reach the public card; the slip file itself is
  // never displayed or linked to parents.
  const approvedGradeLabels = useMemo(
    () => (tutor.approved_grade_labels ?? []).map((label) => label.trim()).filter(Boolean),
    [tutor],
  );
  const academicChips = useMemo<TutorSubjectChip[]>(
    () => approvedGradeLabels.map((label) => ({ subject: label, grade: null })),
    [approvedGradeLabels],
  );
  // One Verified badge, derived from ">=1 approved grade" (#309), now the
  // minimalist BLUE TICK in MatchMax azure (issue #411 branding).
  const verified = approvedGradeLabels.length > 0;
  // Issue #411: Row 1 is the active dual-language custom headline
  // (custom_headline_en/zh with strict fallback to the derived headline).
  const activeHeadline = useMemo(
    () => getActiveCustomHeadline(tutor, i18n.language),
    [tutor, i18n.language],
  );
  const cardHighlights = useMemo(() => getTutorCardHighlights(tutor), [tutor]);
  const price = useMemo(() => getTutorPriceDisplay(tutor), [tutor]);
  // Issue #391: cheapest per-student group figure across small-group rate
  // rows and open cohorts, drives the 👥 badge. Group rates never touch the
  // 1-on-1 card floor above.
  const groupRate = useMemo(() => {
    const fromRows = groupRateFloor(tutor.rate_rows ?? []);
    const fromCohorts = tutor.group_cohort_rate_hkd ?? null;
    if (fromRows === null) return fromCohorts;
    if (fromCohorts === null) return fromRows;
    return Math.min(fromRows, fromCohorts);
  }, [tutor]);
  const availabilityReadiness = useMemo(() => getTutorAvailabilityReadiness(tutor), [tutor]);
  const academicChipsRef = useRef<HTMLDivElement | null>(null);
  const academicWidthRef = useRef<number | null>(null);
  const [areAcademicChipsExpanded, setAreAcademicChipsExpanded] = useState(false);
  // Issue #411: Core Academic Breakdown "View all N grades" expand toggle —
  // the card stretches to reveal every pill only when the tutor clicks.
  const [isBreakdownExpanded, setIsBreakdownExpanded] = useState(false);
  const visibleGradeCap = 6;
  const [visibleAcademicChipCount, setVisibleAcademicChipCount] = useState(academicChips.length);
  const [hasPhotoError, setHasPhotoError] = useState(false);
  useEffect(() => setHasPhotoError(false), [tutor.photo_url]);
  const showPhoto = Boolean(tutor.photo_url) && !hasPhotoError;
  const genderLabel = t(`tutor_card.gender_${(tutor.gender ?? "").toLowerCase()}`, {
    defaultValue: "",
  }) as string;
  // Issues #77/#52: tutor status pill ("University student" etc.).
  const statusKey = getTutorStatusLabelKey(tutor.tutor_status);
  // Issues #102/#151: dynamic demand badge (null = hidden, empty-restaurant
  // guard) + Parent Favorite, computed from the engagement summary prop.
  const demandBadge = engagement
    ? selectDemandBadge({
        remaining_student_slots: tutor.remaining_student_slots,
        inquiries_7d: engagement.inquiries_7d,
        saves_total: engagement.saves_total,
      })
    : null;
  const showParentFavorite = engagement ? isParentFavorite(engagement) : false;
  const statusLabel = statusKey ? t(statusKey) : "";
  // Issue #502: the preferred/display name is the primary identity under the
  // photo; the tutor code stays visible as secondary meta so parents can
  // still quote the MM-T... code when requesting. Unnamed cards (display
  // name blank or equal to the code) keep today's code-only rendering.
  const formattedCode = formatTutorCode(tutor.tutor_code);
  const displayName = tutor.display_name.trim();
  const cardIdentity = displayName || formattedCode;
  const isNamed = Boolean(displayName) && displayName !== formattedCode;
  const compareLabel = (selected: boolean) =>
    selected
      ? isNamed
        ? t("tutor_card.compare_remove_named", { name: displayName, code: formattedCode })
        : t("tutor_card.compare_remove", { code: formattedCode })
      : isNamed
        ? t("tutor_card.compare_add_named", { name: displayName, code: formattedCode })
        : t("tutor_card.compare_add", { code: formattedCode });
  const primaryCredential = removeEmoji(
    activeHeadline ??
      tutor.undergrad_university ??
      tutor.secondary_school ??
      t("tutor_card.verified_fallback"),
  );
  // Issue #411: Core Academic Breakdown, per-curriculum totals + grade pills.
  const breakdown = useMemo(
    () => buildCoreAcademicBreakdown(tutor.exam_results ?? [], tutor.academic_headline),
    [tutor.exam_results, tutor.academic_headline],
  );
  const breakdownGradeCount = useMemo(() => countCoreAcademicGrades(breakdown), [breakdown]);
  // Issue #107: degree line (postgrad • undergrad) + secondary school. Issue
  // #138: each school/uni line may wrap to two lines instead of truncating.
  const educationLines = getTutorEducationLines(tutor).filter(
    (line) => removeEmoji(line.text) !== primaryCredential,
  );
  // Issue #190: one compact chip per vertical the tutor opted into
  // (Kindergarten / University). Canonical target_students markers only;
  // legacy curriculum strings (IBDP…) never render here. No GPA on cards.
  const verticalTierChips = useMemo(() => {
    const levels = Array.isArray(tutor.target_students) ? tutor.target_students : [];
    const chips: string[] = [];
    if (levels.includes("Kindergarten")) chips.push(academicTierLabel("kindergarten"));
    if (levels.includes("University")) chips.push(academicTierLabel("university"));
    return chips;
  }, [tutor.target_students]);

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
      ).sort((first, second) => first - second);

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

  // Issue #411: stretch the card to reveal every grade pill (and back).
  const toggleBreakdownGrades = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsBreakdownExpanded((expanded) => !expanded);
  };

  const handleCompareToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onCompareToggle?.();
  };

  const handleShare = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    void shareOrCopy(
      {
        // Issue #417/#502: share title is the tutor's display name (falls
        // back to the tutor code); the URL is the canonical profile path
        // resolved at click time (SSR-safe). The text keeps the code so
        // parents can quote it.
        title: cardIdentity,
        // Issue #125: a flagged pricing field strips the rate, omit it.
        // Issue #319: the shared figure is always the card floor ("$X up/hr"),
        // never a range and never max_hourly_rate_hkd.
        text:
          price.baseRate > 0
            ? `Check out tutor ${tutor.tutor_code} on MatchMax, $${price.baseRate} up/hr.`
            : `Check out tutor ${tutor.tutor_code} on MatchMax.`,
        url: `${window.location.origin}/tutors/${tutor.tutor_code}`,
      },
      t("share.copied"),
      t("share.share_failed"),
    );
  };

  return (
    <article
      data-tour={tourId}
      className={cn(
        "@container relative flex h-full min-h-[20rem] w-full flex-col overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card transition-[transform,border-color] duration-200 hover:-translate-y-1 hover:border-[color:var(--foreground)]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:min-h-[23rem]",
        interactive && "cursor-pointer",
        compareSelected && "border-[color:var(--ring)] ring-2 ring-[color:var(--ring)]",
        className,
      )}
      role={interactive ? "link" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? () => onOpen(tutor.tutor_code) : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if ((event.target as HTMLElement).closest("a, button")) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen(tutor.tutor_code);
              }
            }
          : undefined
      }
    >
      <header className="relative border-b border-border px-3 py-2.5 md:px-4 md:py-3">
        <div className="flex items-start gap-2.5 md:gap-3.5">
          {/* Photo column sizes to its widest child (the status pill, capped
              at max-w-24) so the badge fits under the tutor code instead of
              ellipsizing in a fixed 3/3.5rem rail. */}
          <div className="flex w-max min-w-12 max-w-24 shrink-0 flex-col items-center gap-1.5 md:min-w-14">
            <div className="relative">
              {showPhoto ? (
                <img
                  src={tutor.photo_url ?? ""}
                  alt={
                    isNamed
                      ? t("tutor_card.tutor_alt_named", { name: displayName, code: formattedCode })
                      : t("tutor_card.tutor_alt", { code: formattedCode })
                  }
                  loading="lazy"
                  decoding="async"
                  onError={() => setHasPhotoError(true)}
                  className="h-11 w-11 rounded-full border border-border bg-muted object-cover md:h-[3.25rem] md:w-[3.25rem]"
                />
              ) : (
                // Issue #437: branded deterministic initial avatar replaces
                // the grey/muted circle fallback (no silhouettes anywhere).
                <InitialAvatar
                  stableId={tutor.user_id ?? tutor.tutor_code}
                  name={cardIdentity}
                  className="h-11 w-11 text-sm md:h-[3.25rem] md:w-[3.25rem] md:text-base"
                />
              )}
            </div>
            {/* Issue #502: primary identity under the photo — display name
                when set, else the tutor code (today's behaviour). */}
            <p className="max-w-full whitespace-normal text-center text-xs font-semibold break-words text-muted-foreground">
              {cardIdentity}
            </p>
            {/* Issue #502: the code stays reachable for parent requests as a
                small secondary line when a display name leads. */}
            {isNamed ? (
              <p className="max-w-full text-[11px] leading-tight text-muted-foreground">
                ({formattedCode})
              </p>
            ) : null}
            {/* Issues #77/#52: tutor status badge (uni student / full-part-time
                / examiner) under the tutor code. Wraps to two lines for long
                labels instead of ellipsizing. */}
            {statusLabel ? (
              <span className="max-w-full whitespace-normal rounded-md bg-muted px-1.5 py-0.5 text-center text-[11px] font-semibold leading-tight text-[color:var(--ink)]">
                {statusLabel}
              </span>
            ) : null}
            {/* Issue #199: neutral SEN capability badge (azure stays reserved
                for money CTAs). Shown only when sen_enabled. */}
            {tutor.sen_enabled ? (
              <span
                className="max-w-full whitespace-normal rounded-md border border-border bg-muted px-1.5 py-0.5 text-center text-[11px] font-bold leading-tight text-[color:var(--ink)]"
                title={t("sen.badge_title")}
              >
                SEN
              </span>
            ) : null}
            {/* Issue #411: BLUE TICK verified badge (MatchMax azure) replacing
                the #309 emerald pill. Icon-only, like the industry standard;
                the #309 disclaimer line still renders under the header and the
                Self-Reported pill is untouched. */}
            {verified ? (
              <span
                className="inline-flex max-w-full items-center justify-center"
                title={t("tutor_card.verified_disclaimer")}
              >
                <BadgeCheck
                  className="h-5 w-5 fill-[#1d9bf0] text-white dark:text-[#0b2230]"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                <span className="sr-only">{t("tutor_card.verified_badge")}</span>
              </span>
            ) : null}
            {/* Issues #102/#151: dynamic demand + Parent Favorite badges in
                the card's badge column (same wrap-friendly pill anatomy as
                the status/SEN/Verified badges above). */}
            {demandBadge ? <DemandBadge kind={demandBadge} /> : null}
            {showParentFavorite ? <ParentFavoriteBadge /> : null}
            {/* Issue #391: group-classes availability pill (rate rows +
                open cohorts). */}
            {groupRate !== null ? <GroupClassBadge rate={groupRate} /> : null}
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <FitText
              as="p"
              maxLines={2}
              contentKey={primaryCredential}
              className={cn(
                "break-words text-sm font-bold leading-tight text-[color:var(--ink)] md:text-base @max-sm:text-xs!",
                // Keep the headline clear of the absolutely-positioned gender badge.
                genderLabel && "pr-16 md:pr-[4.5rem]",
              )}
            >
              {primaryCredential}
            </FitText>
            {educationLines.map((line, index) => (
              <p
                key={`${line.icon}-${index}`}
                className="mt-1 flex min-w-0 items-center gap-1.5 text-xs leading-snug text-muted-foreground"
              >
                {line.icon === "graduation" ? (
                  <GraduationCap
                    className="h-3 w-3 shrink-0 text-[color:var(--brand-link)]"
                    aria-hidden="true"
                  />
                ) : (
                  <School
                    className="h-3 w-3 shrink-0 text-[color:var(--brand-link)]"
                    aria-hidden="true"
                  />
                )}
                <span className="min-w-0 break-words line-clamp-2">{removeEmoji(line.text)}</span>
              </p>
            ))}
            {/* Issue #387: verified experience pill, self-fetching, hides
                completely at 0 verified lessons (Ryan-frozen card: this is the
                ONLY visual addition; nothing else on the card changes). */}
            <ExperiencePill tutorId={tutor.id} className="mt-1.5" />
          </div>

          {genderLabel ? (
            <span className="absolute right-3 top-2.5 inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-semibold text-[color:var(--ink)] @max-sm:px-1.5 @max-sm:py-0.5 @max-sm:text-[11px] md:right-4 md:top-3">
              <UserRound className="h-3 w-3 text-[color:var(--brand-link)]" aria-hidden="true" />
              {genderLabel}
            </span>
          ) : null}
        </div>
      </header>

      {/* Issue #309: the exact card line under the Verified badge. */}
      {verified ? (
        <p className="border-b border-border bg-[color:var(--surface-subtle)] px-3 py-1.5 text-[11px] leading-snug text-muted-foreground md:px-4">
          {t("tutor_card.verified_disclaimer")}
        </p>
      ) : null}

      {availabilityReadiness === "pre_booking" && tutor.earliest_start_date ? (
        <p className="flex items-center gap-1.5 border-b border-border bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 md:px-4 dark:text-amber-400">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t("tutor_card.available_from", {
            date: formatAvailabilityDate(tutor.earliest_start_date, i18n.language),
          })}
        </p>
      ) : null}

      <div className="flex flex-1 flex-col px-3 pb-2.5 pt-2.5 md:px-4 md:pb-3 md:pt-3">
        {/* Issue #190: compact vertical tier chips (Kindergarten / University). */}
        {verticalTierChips.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {verticalTierChips.map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold leading-tight text-[color:var(--ink)]"
              >
                {label}
              </span>
            ))}
          </div>
        ) : null}
        {breakdown.length > 0 || academicChips.length > 0 ? (
          <section className="border-b border-border pb-2.5 md:pb-3">
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <LineChart
                className="h-3.5 w-3.5 text-[color:var(--brand-link)] @max-sm:h-3 @max-sm:w-3"
                strokeWidth={2.5}
                aria-hidden="true"
              />
              {/* Issue #411: the EXACT shared label (same key as the detail
                  page, never a "Academic Breakdown" variant). */}
              {t("profile.section_academic")}
            </h3>

            {/* Issue #411: per-curriculum groups, the total score is the
                group header ("IBDP: 45/45"), grade pills underneath, subtle
                divider between curriculums. Hidden entirely when the tutor
                has no exam scores at all (Examiner / pro tutors). */}
            {breakdown.map((group, groupIndex) => {
              const gradesShown = isBreakdownExpanded
                ? group.grades
                : (() => {
                    let before = 0;
                    for (let i = 0; i < groupIndex; i += 1) before += breakdown[i].grades.length;
                    const room = Math.max(0, visibleGradeCap - before);
                    return group.grades.slice(0, room);
                  })();
              if (!isBreakdownExpanded && gradesShown.length === 0) return null;
              return (
                <div
                  key={`${group.curriculum}-${groupIndex}`}
                  className={groupIndex > 0 ? "mt-2 border-t border-border pt-2" : "mt-2"}
                >
                  <p className="text-xs font-bold leading-snug text-[color:var(--ink)]">
                    {group.total ? `${group.curriculum}: ${group.total}` : group.curriculum}
                  </p>
                  {gradesShown.length > 0 ? (
                    <div className="mt-1 flex flex-wrap items-start gap-2">
                      {gradesShown.map((grade, gradeIndex) => (
                        <AcademicResultChip
                          key={`${grade.subject}-${gradeIndex}`}
                          chip={{ subject: grade.subject, grade: grade.grade || null }}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {/* Issue #411 extension system: pills beyond the cap collapse
                behind a "View all N grades" toggle so the card stretches
                only on click. */}
            {breakdownGradeCount > visibleGradeCap ? (
              <button
                type="button"
                aria-expanded={isBreakdownExpanded}
                onClick={toggleBreakdownGrades}
                onKeyDown={(event) => event.stopPropagation()}
                className="mt-1.5 inline-flex items-center gap-0.5 rounded-sm text-xs font-medium leading-snug text-[color:var(--brand-link)] underline-offset-2 transition-colors hover:text-[color:var(--ink)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] md:text-sm @max-sm:text-[11px]!"
              >
                {isBreakdownExpanded
                  ? t("tutor_card.show_fewer_grades")
                  : t("tutor_card.view_all_grades", { count: breakdownGradeCount })}
              </button>
            ) : null}

            {/* Issue #309: staff-APPROVED grade labels keep their chips row. */}
            {academicChips.length > 0 ? (
              <div className="relative mt-2">
                <div
                  id={`academic-achievements-${tutor.tutor_code}`}
                  ref={academicChipsRef}
                  className="flex flex-wrap items-start gap-2 overflow-hidden"
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
                      className="inline-flex translate-y-0.5 items-center self-center rounded-sm px-0.5 py-1 text-xs font-medium leading-snug text-[color:var(--brand-link)] underline-offset-2 transition-colors hover:text-[color:var(--ink)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] md:py-1.5 md:text-sm @max-sm:text-[11px]!"
                    >
                      ... {t("tutor_card.more")}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section
          className={cn("flex flex-1 flex-col", academicChips.length > 0 ? "pt-2.5" : "pt-0")}
        >
          <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Award
              className="h-3.5 w-3.5 text-[color:var(--brand-link)] @max-sm:h-3 @max-sm:w-3"
              strokeWidth={2.5}
              aria-hidden="true"
            />
            {t("tutor_card.achievements_and_experiences")}
          </h3>

          {tutor.achievements.length > 0 ? (
            <ul className="mt-1.5 list-disc space-y-1.5 pl-4 marker:text-[color:var(--brand-link)]">
              {tutor.achievements.slice(0, 3).map((achievement, index) => (
                <FitText
                  key={`${achievement.short_text}-${index}`}
                  as="li"
                  maxLines={1}
                  contentKey={achievement.short_text}
                  className="whitespace-nowrap text-[13px] leading-snug text-[color:var(--ink)]"
                >
                  {removeEmoji(achievement.short_text)}
                </FitText>
              ))}
            </ul>
          ) : null}

          <ul
            className="mt-2.5 list-disc space-y-1 pl-4 marker:text-[color:var(--brand-link)] md:mt-3"
            aria-label={t("tutor_card.highlights_label")}
          >
            {(cardHighlights.length > 0
              ? cardHighlights
              : [t("tutor_card.highlight_fallback")]
            ).map((highlight, index) => (
              <FitText
                key={`${highlight}-${index}`}
                as="li"
                maxLines={1}
                contentKey={highlight}
                className="whitespace-nowrap text-xs leading-snug text-[color:var(--ink)] md:text-sm @max-sm:text-xs!"
              >
                {removeEmoji(highlight)}
              </FitText>
            ))}
          </ul>

          {/* Issue #217: profile tags, click one to search it. Kept out of
              the compare flow via stopPropagation, like the other buttons. */}
          {tutor.profile_tags.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-border pt-2.5 md:mt-3">
              {tutor.profile_tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    tagQuery?.(tag);
                  }}
                  onKeyDown={(event) => event.stopPropagation()}
                  aria-label={t("tutor_card.tag_search", { tag })}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium leading-tight text-muted-foreground transition-colors",
                    tagQuery
                      ? "hover:border-[color:var(--brand-link)] hover:text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                      : "cursor-default",
                  )}
                >
                  <Hash className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {tag}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <footer className="flex min-w-0 flex-nowrap items-center justify-between gap-2 border-t border-border px-3 py-2 md:gap-3 md:px-4 md:py-2.5">
        {price.baseRate > 0 ? (
          <FitText
            as="p"
            maxLines={1}
            contentKey={`${price.baseRate}-${priceSuffix}`}
            className="min-w-0 flex-1 whitespace-nowrap text-xl font-bold leading-none text-[color:var(--ink)] md:text-3xl @max-sm:text-lg!"
            title={
              displayCurrency !== DEFAULT_CURRENCY &&
              convertedTextFromHkd(price.baseRate, displayCurrency, fxRates) &&
              toCurrencyCode(tutor.currency) !== displayCurrency
                ? t("currency.base_price_tooltip", {
                    amount: formatMoney(tutor.hourly_rate, toCurrencyCode(tutor.currency)),
                  })
                : undefined
            }
          >
            {/* Issue #319: one "$X up/hr" figure, the base rate floor. Extra
                rate rows never appear here, so they can never lower it.
                #114: converted figure when the visitor picked a display
                currency; tooltip shows the tutor's own quote when it differs. */}
            {convertedTextFromHkd(price.baseRate, displayCurrency, fxRates) ?? `$${price.baseRate}`}
            <span className="ml-1 text-[0.6em] font-medium text-muted-foreground md:text-[0.4em] @max-sm:text-[0.66em]!">
              {t("tutor_card.price_up")}
              {priceSuffix}
            </span>
          </FitText>
        ) : (
          // Pricing flagged (issue #125) or unset: the card shows no rate.
          <div className="flex-1" />
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1.5 md:gap-2">
          {onCompareToggle ? (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-pressed={compareSelected ?? false}
                    aria-label={compareLabel(compareSelected ?? false)}
                    onClick={handleCompareToggle}
                    onKeyDown={(event) => event.stopPropagation()}
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] @max-sm:h-8 @max-sm:w-8",
                      compareSelected
                        ? "bg-[color:var(--btn-accent)] text-[color:var(--btn-accent-fg)]"
                        : "text-[color:var(--ink)] hover:bg-[color:var(--foreground)]/[0.06]",
                    )}
                  >
                    {compareSelected ? (
                      <Check className="h-4 w-4" strokeWidth={2.8} aria-hidden="true" />
                    ) : (
                      <Columns2 className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{compareLabel(Boolean(compareSelected))}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
          {saveAction}
          {shareable ? (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`${t("share.share_tutor")} (${formatTutorCode(tutor.tutor_code)})`}
                    onClick={handleShare}
                    onKeyDown={(event) => event.stopPropagation()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-[color:var(--ink)] transition-colors hover:bg-[color:var(--foreground)]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] @max-sm:h-8 @max-sm:w-8"
                  >
                    <Share2 className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{t("share.share_tutor")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
          {footerAction}
        </div>
      </footer>
    </article>
  );
}
