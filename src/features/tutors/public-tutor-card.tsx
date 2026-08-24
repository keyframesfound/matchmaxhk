import type { ReactNode } from "react";
import { BookOpen, UserRound } from "lucide-react";
import { getTutorGenderLabel, type Tutor } from "@/features/tutors/queries";
import { cn } from "@/lib/utils";

export function formatTutorCode(code?: string | null) {
  const normalized = (code ?? "").trim().toUpperCase();
  if (!normalized) return "MM-XXXX";
  if (/^MM-\d{4}$/.test(normalized)) return normalized;
  if (/^\d{4}$/.test(normalized)) return `MM-${normalized}`;
  if (/^MM-/.test(normalized)) return normalized;
  return normalized;
}

export function buildTutorWhatsAppUrl(whatsappNumber: string | undefined, tutorCode: string) {
  const digits = (whatsappNumber ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";

  const message = `Hi MatchMax! I'd like to request tutor ${formatTutorCode(tutorCode)}.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function getTutorInitials(tutorCode?: string | null) {
  const normalized = (tutorCode ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!normalized) return "MM";
  return normalized.slice(0, 2);
}

function normalizeSubjectKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function gradeLabel(grade: string) {
  const trimmed = grade.trim();
  if (!trimmed) return "Grade -";
  return /^grade\s+/i.test(trimmed) ? trimmed : `Grade ${trimmed}`;
}

function splitGradeLabel(grade: string) {
  const label = gradeLabel(grade);
  const match = label.match(/^(Grade\s+)(.+)$/i);
  if (!match) {
    return { prefix: "", value: label };
  }

  return { prefix: match[1], value: match[2] };
}

function getTutorSubjectChips(tutor: Tutor, limit = 3) {
  const gradeLookup = new Map<string, string>();
  for (const result of tutor.exam_results ?? []) {
    for (const entry of result.subjects ?? []) {
      const subject = (entry.subject ?? "").trim();
      const grade = (entry.grade ?? "").trim();
      if (!subject || !grade) continue;
      const key = normalizeSubjectKey(subject);
      if (!gradeLookup.has(key)) gradeLookup.set(key, grade);
    }
  }

  const chips = tutor.subjects.slice(0, limit).map((subject) => {
    const key = normalizeSubjectKey(subject);
    let grade = gradeLookup.get(key);

    if (!grade) {
      for (const [candidateKey, candidateGrade] of gradeLookup.entries()) {
        if (candidateKey.includes(key) || key.includes(candidateKey)) {
          grade = candidateGrade;
          break;
        }
      }
    }

    return {
      subject,
      grade: gradeLabel(grade ?? ""),
    };
  });

  return {
    chips,
    extraCount: Math.max(0, tutor.subjects.length - limit),
  };
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
  const { chips, extraCount } = getTutorSubjectChips(tutor);

  return (
    <article
      className={cn(
        "flex h-full min-h-[20rem] w-full flex-col overflow-hidden rounded-[10px] border border-[color:var(--brand-teal)]/25 bg-white shadow-[0_10px_30px_rgba(4,19,68,0.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(4,19,68,0.10)] md:min-h-[25rem]",
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

      <div className="flex flex-1 flex-col px-3 pt-2.5 pb-3.5 md:px-4 md:pt-3 md:pb-5">
        <h3 className="text-[11px] font-bold tracking-tight text-[color:var(--brand-navy)] md:text-[13px]">
          Subject Taught
        </h3>
        <div className="mt-1.5 flex min-h-[3.25rem] flex-wrap content-start gap-1.5 md:min-h-[4.25rem] md:gap-2">
          {chips.map(({ subject, grade }) => (
            <span
              key={subject}
              className="rounded-[2px] bg-[color:var(--brand-teal)]/12 px-2 py-0.5 text-[10px] font-semibold text-[color:var(--brand-navy)] md:px-3 md:py-1 md:text-[12px]"
            >
              {(() => {
                const { prefix, value } = splitGradeLabel(grade);
                return (
                  <>
                    {subject} : {prefix}
                    <span className="inline-block text-[11px] font-black leading-none tracking-tight text-[color:var(--brand-navy)] md:text-[13px]">
                      {value}
                    </span>
                  </>
                );
              })()}
            </span>
          ))}
          {extraCount > 0 ? (
            <span className="rounded-[2px] bg-[color:var(--brand-teal)]/12 px-2 py-0.5 text-[10px] font-semibold text-[color:var(--brand-navy)] md:px-3 md:py-1 md:text-[12px]">
              +{extraCount}
            </span>
          ) : null}
        </div>

        <h3 className="mt-2 min-h-[3rem] line-clamp-3 text-[12px] font-bold leading-snug tracking-tight text-[color:var(--brand-navy)] md:mt-3 md:min-h-[3.75rem] md:text-[14px]">
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
