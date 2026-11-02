import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchTutorPublicNotes, type HomeNote } from "@/features/materials/home-notes.queries";
import { fetchMarketplaceMaterials, formatMaterialTypeLabel } from "@/features/materials/queries";
import { NoteBrowseCard } from "@/features/materials/note-browse-card";

/**
 * Issue #312: the 'Study notes' row on the home page (under the search bar,
 * above the IB rail) and the 'Authored notes' block on the public tutor
 * profile. Same carousel chrome as the tutor rails, heading, View all,
 * arrows, mobile swipe + md paged track, with flat border-defined cards
 * (no shadows). Data comes from the get_home_notes / get_tutor_public_notes
 * SECURITY DEFINER RPCs; when they are missing the queries degrade to [] and
 * both blocks render nothing (the home row also needs >= 3 public notes).
 * Azure is never spent here, it stays on money CTAs only.
 */

const HOME_NOTES_LIMIT = 8;

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

const NOTE_KINDS = new Set(["notes", "mock", "exemplar", "flashcards"]);

/**
 * #557 CEO lock (2026-11-02): the thin home "Study notes" row sits BELOW the
 * tutor carousels and uses the compact Carousell-style browse card (photo,
 * title, price, seller name) in one horizontal swipe row. No seller CTA on
 * Explore (Upload / How it works live on the Notes market header); the row
 * hides when nothing is published yet, the Notes pill under the search bar
 * is the always-there entry.
 */
export function HomeNotesRow() {
  const { t } = useTranslation();
  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["materials", "marketplace"],
    queryFn: fetchMarketplaceMaterials,
  });
  const notes = materials.filter((m) => NOTE_KINDS.has(m.material_type)).slice(0, HOME_NOTES_LIMIT);

  if (isLoading || notes.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1536px]">
      <div className="mb-3 flex items-center gap-2 sm:gap-3">
        <h2 className="min-w-0 truncate text-xl font-bold tracking-tight text-[color:var(--ink)] md:text-2xl">
          {t("notes.home.heading")}
        </h2>
        <Button
          asChild
          variant="ghost"
          refined
          hoverArrow
          className="ml-auto h-8 shrink-0 rounded-full px-2.5 text-[13px] font-bold text-[color:var(--brand-link)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--ink)] sm:h-9 sm:px-3 sm:text-sm"
        >
          <Link to="/tutors" search={{ view: "materials" }}>
            {t("notes.home.view_all")}
            <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
      <div className="-mx-4 rail-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-1 pb-2 scroll-px-4 md:mx-0 md:px-0">
        {notes.map((material) => (
          <NoteBrowseCard
            key={material.id}
            material={material}
            className="w-[42vw] max-w-[200px] shrink-0 snap-start md:w-[200px]"
          />
        ))}
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
        <h2 className="text-lg font-bold tracking-tight text-[color:var(--ink)] sm:text-xl">
          {t("notes.home.authored_heading")}
        </h2>
      </div>
      <div className="mt-3.5 grid gap-4 sm:grid-cols-2">
        {notes.map((note) => renderNoteCard(note))}
      </div>
    </section>
  );
}
