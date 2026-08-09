import type { ReactNode } from "react";
import { BookOpen, Clock3 } from "lucide-react";
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
        "flex h-full w-full flex-col overflow-hidden rounded-sm border border-[color:var(--brand-teal)]/35 bg-white transition-all hover:-translate-y-0.5 hover:shadow-brand",
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
      <div className="bg-[#0A245F] px-4 pb-4 pt-4">
        <div className="flex items-center gap-4">
          {tutor.photo_url ? (
            <img
              src={tutor.photo_url}
              alt={tutor.tutor_code}
              className="h-14 w-14 shrink-0 rounded-full border-[3px] border-[color:var(--brand-teal)] object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[3px] border-[color:var(--brand-teal)] bg-white text-lg font-bold text-[color:var(--brand-teal)]">
              {getTutorInitials(tutor.tutor_code)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-black tracking-tight text-white">
              {formatTutorCode(tutor.tutor_code)}
            </p>
            <p className="mt-0.5 line-clamp-1 text-[12px] font-semibold leading-tight text-white/95">
              {tutor.headline ?? "Headline Here"}
            </p>
          </div>
          {badgeLabel ? (
            <span className="rounded-sm border border-white/20 bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
              {badgeLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pt-3 pb-5">
        <h3 className="text-[13px] font-bold tracking-tight text-[#0A245F]">Subject Taught</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {chips.map(({ subject, grade }) => (
            <span
              key={subject}
              className="rounded-full bg-[color:var(--brand-teal)]/16 px-3 py-1 text-[12px] font-semibold text-[#0A245F]"
            >
              {(() => {
                const { prefix, value } = splitGradeLabel(grade);
                return (
                  <>
                    {subject} : {prefix}
                    <span className="font-black text-[#0A245F]">{value}</span>
                  </>
                );
              })()}
            </span>
          ))}
          {extraCount > 0 ? (
            <span className="rounded-full bg-[color:var(--brand-teal)]/16 px-3 py-1 text-[12px] font-semibold text-[#0A245F]">
              +{extraCount}
            </span>
          ) : null}
        </div>

        <h3 className="mt-4 text-[14px] font-bold tracking-tight text-[#0A245F]">
          {tutor.university ?? tutor.highschool ?? "University - From Database"}
        </h3>

        <div className="h-4" />

        <div className="mt-auto grid grid-cols-2 gap-2 border-t border-border pt-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Target Student
            </p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-[13px] font-semibold leading-tight text-[#0A245F]">
              <BookOpen className="h-4 w-4 text-[#0A245F]" />
              {tutor.target_students[0] ?? "IB, Senior Secondary"}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Gender
            </p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-[13px] font-semibold leading-tight text-[#0A245F]">
              <Clock3 className="h-4 w-4 text-[#0A245F]" />
              {getTutorGenderLabel(tutor.gender) || "Not specified"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-white px-4 py-2.5">
        <p className="text-3xl font-black leading-none tracking-tight text-[#0A245F]">
          HK${tutor.hourly_rate}
          <span className="ml-1 text-[13px] font-semibold text-muted-foreground">
            {priceSuffix}
          </span>
        </p>
        {footerAction}
      </div>
    </article>
  );
}