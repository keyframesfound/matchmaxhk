import { formatDistanceToNow } from "date-fns";
import { CalendarClock } from "lucide-react";

import { WhatsAppIcon } from "@/components/layout/WhatsAppFloatButton";
import { cn } from "@/lib/utils";
import { buildCaseApplyWhatsAppUrl, formatCaseTitle } from "@/features/cases/display";
import type { PublicCaseBoardItem } from "@/lib/cases.functions";

const MODE_LABEL: Record<string, string> = {
  online: "Online",
  in_person: "In-person",
  either: "Online & in-person",
};

const GENDER_LABEL: Record<string, string> = {
  any: "No preference",
  female: "Female tutor",
  male: "Male tutor",
};

const START_LABEL: Record<string, string> = {
  asap: "Starts ASAP",
  two_weeks: "Within 2 weeks",
  flexible: "Flexible start",
};

function BoardChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[4px] border border-[color:var(--brand-teal)]/45 bg-[color:var(--brand-teal)]/8 px-2 py-0.5 text-[10px] font-bold leading-snug text-[color:var(--ink)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-[12px] font-semibold text-[color:var(--ink)]">{value}</p>
    </div>
  );
}

export function PublicCaseCard({
  item,
  whatsappNumber,
}: {
  item: PublicCaseBoardItem;
  whatsappNumber: string;
}) {
  const budgetLabel =
    item.budgetMin === null && item.budgetMax === null
      ? "Budget open"
      : `HK$${item.budgetMin ?? "?"}–${item.budgetMax ?? "?"}`;
  const curriculum = item.examSystem && item.examSystem !== "Not sure yet" ? item.examSystem : null;
  const applyUrl = buildCaseApplyWhatsAppUrl(whatsappNumber, item.caseCode);

  return (
    <article className="relative flex h-full w-full flex-col overflow-hidden rounded-[10px] border border-[color:var(--brand-teal)]/25 bg-[color:var(--surface)] shadow-[0_10px_30px_rgba(4,19,68,0.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(4,19,68,0.10)]">
      <header className="border-b border-[color:var(--brand-teal)]/20 bg-[color:var(--surface)] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 text-[15px] font-black leading-snug tracking-tight text-[color:var(--ink)] md:text-[17px]">
            {formatCaseTitle(item.studentLevel, item.subjects) || item.title}
          </h3>
          <p className="shrink-0 pt-0.5 font-mono text-[11px] font-bold text-muted-foreground">
            {item.caseCode}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {curriculum ? <BoardChip>{curriculum}</BoardChip> : null}
          <BoardChip>{MODE_LABEL[item.mode] ?? item.mode}</BoardChip>
          {item.district ? <BoardChip>{item.district}</BoardChip> : null}
          {item.startTiming === "asap" ? (
            <BoardChip className="border-amber-500/50 bg-amber-500/10">
              <CalendarClock className="mr-1 h-3 w-3" aria-hidden="true" />
              Starts ASAP
            </BoardChip>
          ) : null}
        </div>
      </header>

      <div className="flex flex-1 flex-col px-4 pb-3 pt-3">
        {item.description ? (
          <p className="line-clamp-3 text-[12px] font-medium leading-relaxed text-muted-foreground md:text-[13px]">
            {item.description}
          </p>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-[color:var(--brand-teal)]/15 pt-3">
          <MetaRow
            label="Lessons"
            value={`${item.sessionsPerWeek}x / week · ${item.sessionLengthMinutes} min`}
          />
          <MetaRow label="Tutor gender" value={GENDER_LABEL[item.preferredGender] ?? "Any"} />
          <MetaRow
            label="Start"
            value={
              item.startTiming && START_LABEL[item.startTiming]
                ? START_LABEL[item.startTiming]
                : "Flexible"
            }
          />
        </div>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-[color:var(--brand-teal)]/20 bg-[color:var(--surface)] px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-lg font-black leading-none tracking-tight text-[color:var(--ink)] md:text-xl">
            {budgetLabel}
            {item.budgetMin !== null || item.budgetMax !== null ? (
              <span className="ml-1 text-[10px] font-semibold text-muted-foreground md:text-[13px]">
                /hr
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-[10px] font-medium text-muted-foreground">
            Posted {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
          </p>
        </div>
        <a
          href={applyUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Apply for case ${item.caseCode} via WhatsApp`}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-sm bg-[color:var(--surface-invert)] px-4 text-[13px] font-bold text-white transition-colors hover:bg-[color:var(--surface-invert-hover)]"
        >
          <WhatsAppIcon className="h-4 w-4" aria-hidden="true" />
          Apply
        </a>
      </footer>
    </article>
  );
}
