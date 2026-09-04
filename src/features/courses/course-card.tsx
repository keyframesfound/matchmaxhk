import { ArrowRight, Clock, MapPin } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { CourseSaveButton } from "./saved-courses";
import { courseModeLabel, formatCoursePrice, type CourseWithOrganization } from "./queries";

const LEVEL_BADGE_CLASSES: Record<string, string> = {
  IB: "bg-blue-50 text-blue-700 ring-blue-700/10 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-400/20",
  DSE: "bg-pink-50 text-pink-700 ring-pink-700/10 dark:bg-pink-500/10 dark:text-pink-400 dark:ring-pink-400/20",
  IGCSE:
    "bg-indigo-50 text-indigo-700 ring-indigo-700/10 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-400/20",
  AP: "bg-orange-50 text-orange-700 ring-orange-700/10 dark:bg-orange-500/10 dark:text-orange-400 dark:ring-orange-400/20",
  "A-Level":
    "bg-emerald-50 text-emerald-700 ring-emerald-700/10 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20",
  Primary:
    "bg-sky-50 text-sky-700 ring-sky-700/10 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-400/20",
  Secondary:
    "bg-violet-50 text-violet-700 ring-violet-700/10 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-400/20",
  International:
    "bg-amber-50 text-amber-700 ring-amber-700/10 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20",
};

const DEFAULT_BADGE_CLASS =
  "bg-gray-50 text-gray-700 ring-gray-700/10 dark:bg-gray-500/10 dark:text-gray-400 dark:ring-gray-400/20";

export function CourseLevelBadge({ level }: { level: string | null }) {
  if (!level) return null;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
        LEVEL_BADGE_CLASSES[level] ?? DEFAULT_BADGE_CLASS
      }`}
    >
      {level}
    </span>
  );
}

type CourseCardProps = {
  course: CourseWithOrganization;
};

export function CourseCard({ course }: CourseCardProps) {
  const price = formatCoursePrice(course.price, course.currency);
  const orgName = course.organization?.name ?? "MatchMax partner";
  const initials = orgName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

  return (
    <Link
      to="/courses/$courseId"
      params={{ courseId: course.id }}
      className="group grid gap-4 rounded-lg border border-border bg-card p-5 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-[color:var(--brand-teal)]/45 hover:shadow-md sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-6"
    >
      {course.organization?.logo_url ? (
        <img
          src={course.organization.logo_url}
          alt=""
          className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
          loading="lazy"
        />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#1FA8B6]/10 text-sm font-bold text-[#1FA8B6]">
          {initials || "MM"}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <CourseLevelBadge level={course.level} />
          {course.subject ? (
            <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              {course.subject}
            </span>
          ) : null}
        </div>
        <h3 className="mt-2 text-base font-semibold text-[color:var(--ink)] group-hover:text-[color:var(--brand-link)] sm:text-lg">
          {course.title}
        </h3>
        {course.summary ? (
          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{course.summary}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {courseModeLabel(course.mode)}
          </span>
          {course.district ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {course.district}
            </span>
          ) : null}
          <span className="font-medium text-[color:var(--ink)]">{orgName}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border pt-4 sm:min-w-28 sm:flex-col sm:items-end sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
        <CourseSaveButton courseId={course.id} compact />
        {price ? (
          <span className="text-lg font-bold text-[color:var(--ink)]">{price}</span>
        ) : (
          <span className="text-sm font-semibold text-muted-foreground">Enquire</span>
        )}
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-link)] group-hover:text-[color:var(--brand-teal)]">
          View course
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
