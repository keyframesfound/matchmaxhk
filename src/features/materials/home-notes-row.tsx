import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, ChevronLeft, ChevronRight, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  fetchHomeNotes,
  fetchTutorPublicNotes,
  type HomeNote,
} from "@/features/materials/home-notes.queries";
import { formatMaterialTypeLabel } from "@/features/materials/queries";

/**
 * Issue #312: the 'Study notes' row on the home page (under the search bar,
 * above the IB rail) and the 'Authored notes' block on the public tutor
 * profile. Same carousel chrome as the tutor rails — heading, View all,
 * arrows, mobile swipe + md paged track — with flat border-defined cards
 * (no shadows). Data comes from the get_home_notes / get_tutor_public_notes
 * SECURITY DEFINER RPCs; when they are missing the queries degrade to [] and
 * both blocks render nothing (the home row also needs >= 3 public notes).
 * Azure is never spent here — it stays on money CTAs only.
 */

const HOME_NOTES_LIMIT = 8;
const NOTES_PER_PAGE = 4;
const MIN_HOME_NOTES = 3;

export function HomeNoteCard({ note, className }: { note: HomeNote; className?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const noteTarget = note.slug || note.id;

  const openNote = () => {
    void navigate({ to: "/notes/$slug", params: { slug: noteTarget } });
  };

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={note.title}
      onClick={openNote}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openNote();
        }
      }}
      className={cn(
        "flex h-full cursor-pointer flex-col gap-3 rounded-lg border border-border bg-[color:var(--surface)] p-5 transition-colors hover:bg-[color:var(--surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">
            {formatMaterialTypeLabel(note.materialType, t)}
            {note.curriculumTag ? ` · ${note.curriculumTag}` : ""}
            {note.subjectTag ? ` · ${note.subjectTag}` : ""}
          </p>
          <h3 className="mt-1 text-base font-bold leading-snug text-[color:var(--ink)]">
            {note.title}
          </h3>
        </div>
        <p className="shrink-0 text-lg font-bold text-[color:var(--ink)]">
          HK${Number(note.priceHkd).toFixed(0)}
        </p>
      </div>

      <p className="text-xs font-semibold text-muted-foreground">
        {t("notes.home.bought_count", { count: note.boughtCount })}
      </p>

      <div className="mt-auto pt-1">
        {/* Clicking the tutor opens the profile, not the note (stopPropagation
            so the card-level note navigation does not win). */}
        <a
          href={`/tutors/${note.tutorCode}`}
          onClick={(event) => event.stopPropagation()}
          className="text-xs text-muted-foreground hover:underline"
        >
          <span className="font-bold text-[color:var(--brand-link)]">{note.tutorCode}</span>
          {" · "}
          {note.tutorDisplayName}
        </a>
      </div>
    </article>
  );
}

function renderNoteCard(note: HomeNote, className?: string) {
  return <HomeNoteCard key={note.id} note={note} className={className} />;
}

// The Study Materials route (/study-materials) lands with the marketplace
// batch — plain anchors keep this file tsc-clean before that route exists in
// the route tree, and work unchanged once it does.
function SeeAllTile({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <a
      href="/study-materials"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-panel)] border border-dashed border-border bg-[color:var(--surface-subtle)]/40 text-center transition-colors hover:bg-[color:var(--surface-subtle)]",
        className,
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card">
        <ArrowRight className="h-5 w-5 text-[color:var(--brand-link)]" aria-hidden="true" />
      </span>
      <span className="text-sm font-bold text-[color:var(--ink)]">
        {t("materials.toggle_materials")}
      </span>
    </a>
  );
}

function NotesCarouselArrows({
  pages,
  currentPage,
  goToPage,
}: {
  pages: number;
  currentPage: number;
  goToPage: (next: number) => void;
}) {
  const { t } = useTranslation();
  if (pages <= 1) return null;
  return (
    <div className="ml-auto hidden shrink-0 items-center gap-1.5 md:flex">
      <button
        type="button"
        aria-label={t("notes.home.prev")}
        disabled={currentPage === 0}
        onClick={() => goToPage(currentPage - 1)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-[color:var(--ink)] transition-colors hover:bg-[color:var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={t("notes.home.next")}
        disabled={currentPage === pages - 1}
        onClick={() => goToPage(currentPage + 1)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-[color:var(--ink)] transition-colors hover:bg-[color:var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Issue #312: the home-page notes row. Renders nothing below 3 public notes. */
export function HomeNotesRow() {
  const { t } = useTranslation();
  const { data: notes, isLoading } = useQuery({
    queryKey: ["landing", "home_notes"],
    queryFn: () => fetchHomeNotes(HOME_NOTES_LIMIT),
  });

  // Pagination state must be created unconditionally (rules of hooks), so the
  // loading/empty early returns happen after it.
  const [page, setPage] = useState(0);
  const visible = notes ?? [];
  const pages: HomeNote[][] = [];
  for (let i = 0; i < visible.length; i += NOTES_PER_PAGE) {
    pages.push(visible.slice(i, i + NOTES_PER_PAGE));
  }
  const currentPage = Math.min(page, Math.max(0, pages.length - 1));
  const goToPage = (next: number) => setPage(Math.max(0, Math.min(pages.length - 1, next)));

  if (isLoading) {
    return (
      <section className="mx-auto max-w-7xl">
        <Skeleton className="mb-4 h-8 w-40" />
        <div className="-mx-4 flex gap-3 overflow-hidden px-4 md:mx-0 md:grid md:grid-cols-4 md:gap-6 md:px-0">
          {Array.from({ length: NOTES_PER_PAGE }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-48 w-[min(70vw,300px)] shrink-0 rounded-lg border border-border md:w-auto"
            />
          ))}
        </div>
      </section>
    );
  }

  if (visible.length < MIN_HOME_NOTES) return null;

  return (
    <section className="mx-auto max-w-7xl">
      <div className="mb-4 flex items-center gap-2 sm:gap-3">
        <h2 className="min-w-0 truncate text-xl font-black tracking-tight text-[color:var(--ink)] md:text-2xl">
          {t("notes.home.heading")}
        </h2>
        <Button
          asChild
          variant="ghost"
          className="h-8 shrink-0 rounded-full px-2.5 text-[13px] font-bold text-[color:var(--brand-link)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--ink)] sm:h-9 sm:px-3 sm:text-sm"
        >
          <a href="/study-materials">
            {t("notes.home.view_all")}
            <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </a>
        </Button>
        <NotesCarouselArrows pages={pages.length} currentPage={currentPage} goToPage={goToPage} />
      </div>

      {/* Mobile: one swipeable row — first page of notes, then the see-all tile */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-1 pb-2 scroll-px-4 md:hidden">
        {visible
          .slice(0, NOTES_PER_PAGE)
          .map((note) => renderNoteCard(note, "w-[min(70vw,300px)] shrink-0 snap-start"))}
        <SeeAllTile className="min-h-48 w-[min(70vw,300px)] shrink-0 snap-start" />
      </div>

      {/* md+: paged sliding track, 4 cards per page */}
      <div className="hidden overflow-hidden pt-1 md:block">
        <div
          className="flex items-stretch transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${currentPage * 100}%)` }}
        >
          {pages.map((pageNotes, pageIndex) => {
            const isCurrentPage = pageIndex === currentPage;
            const withSeeAllTile = pages.length > 1 && pageIndex === pages.length - 1;
            return (
              <div
                key={pageIndex}
                inert={!isCurrentPage}
                aria-hidden={!isCurrentPage}
                className="grid w-full shrink-0 grid-cols-2 gap-6 lg:grid-cols-4"
              >
                {pageNotes.map((note) => renderNoteCard(note))}
                {withSeeAllTile ? <SeeAllTile className="min-h-48" /> : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * Issue #312: the 'Authored notes' block on the public tutor profile —
 * the tutor's public notes in the same card shape, hidden entirely when the
 * tutor has none. The #176 TutorMaterialsSection further down keeps its
 * buy/book cards; this block adds the delivered-order bought counts.
 */
export function TutorAuthoredNotes({ tutorCode }: { tutorCode: string }) {
  const { t } = useTranslation();
  const { data: notes = [] } = useQuery({
    queryKey: ["tutor", "authored_notes", tutorCode],
    queryFn: () => fetchTutorPublicNotes(tutorCode),
  });

  if (notes.length === 0) return null;

  return (
    <section className="border-b border-border px-5 py-5 last:border-b-0 sm:px-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-[color:var(--foreground)]/15 bg-[color:var(--foreground)]/[0.04]">
          <FileText className="h-4 w-4 text-[color:var(--muted-foreground)]" strokeWidth={2.1} />
        </span>
        <h2 className="text-base font-bold tracking-tight text-[color:var(--ink)] sm:text-lg">
          {t("notes.home.authored_heading")}
        </h2>
      </div>
      <div className="mt-3.5 grid gap-4 sm:grid-cols-2">
        {notes.map((note) => renderNoteCard(note))}
      </div>
    </section>
  );
}
