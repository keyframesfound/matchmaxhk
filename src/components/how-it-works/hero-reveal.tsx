import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Asterisk, BadgeCheck } from "lucide-react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";

import { BlurHighlightText } from "@/components/ui/blur-highlight-text";
import { Button } from "@/components/ui/button";
import { fetchPublishedTutors, type Tutor } from "@/features/tutors/queries";
import { formatTutorCode, getTutorSubjectChips } from "@/features/tutors/tutor-display";
import { cn } from "@/lib/utils";

const MATRIX_TUTOR_LIMIT = 16;
const COLUMN_COUNT = 4;
const UNFURL_END = 0.15;
const COPY_REVEAL = 0.74;
const TILE_HEIGHT = "h-[210px] md:h-[340px]";

type StageActiveChange = (active: boolean) => void;

function useStageActive(
  ref: RefObject<HTMLElement | null>,
  onStageActiveChange?: StageActiveChange,
) {
  const callbackRef = useRef(onStageActiveChange);
  useEffect(() => {
    callbackRef.current = onStageActiveChange;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      callbackRef.current?.(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => callbackRef.current?.(Boolean(entry?.isIntersecting)),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
}

function TutorTile({ tutor }: { tutor: Tutor }) {
  const chips = getTutorSubjectChips(tutor).slice(0, 2);
  const initials =
    (tutor.tutor_code ?? "MM")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 2)
      .toUpperCase() || "MM";

  return (
    <Link
      to="/tutors/$tutorCode"
      params={{ tutorCode: tutor.tutor_code }}
      className={cn(
        "group flex flex-col overflow-hidden rounded-[var(--radius-panel)] border border-black/10 bg-[#f7fafc] text-left shadow-[0_24px_48px_-28px_rgba(0,0,0,0.85)] transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ecdf8]",
        TILE_HEIGHT,
      )}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#dfe9f1]">
        {tutor.photo_url ? (
          <img
            src={tutor.photo_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-2xl font-black tracking-tight text-[#0f1419]/30">
            {initials}
          </span>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-black/5 bg-white/90 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#0f1419] shadow-sm backdrop-blur-sm">
          <BadgeCheck className="h-3 w-3 text-[#1d9bf0]" aria-hidden="true" />
          {formatTutorCode(tutor.tutor_code)}
        </span>
      </div>
      <div className="shrink-0 border-t border-black/5 p-2.5 md:p-3">
        <p className="truncate text-[13px] font-bold text-[#0f1419] md:text-sm">
          {tutor.display_name}
        </p>
        {chips.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {chips.map((chip) => (
              <span
                key={chip.subject}
                className="rounded-[4px] border border-black/10 bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-bold leading-none text-[#0f1419]/75 md:text-[11px]"
              >
                {chip.subject}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

function PlaceholderTile() {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex flex-col overflow-hidden rounded-[var(--radius-panel)] border border-white/[0.06] bg-[linear-gradient(160deg,#0e1420_0%,#080b12_100%)]",
        TILE_HEIGHT,
      )}
    >
      <div className="min-h-0 flex-1" />
      <div className="space-y-2 border-t border-white/[0.05] p-3">
        <div className="h-3 w-2/3 rounded-full bg-white/[0.07]" />
        <div className="h-2.5 w-1/2 rounded-full bg-white/[0.05]" />
      </div>
    </div>
  );
}

function HeroCopy({ copyActive }: { copyActive?: boolean }) {
  const { t, i18n } = useTranslation();
  const highlights = i18n.language?.startsWith("zh") ? ["由學生創辦"] : ["Built By Students"];

  return (
    <div>
      <p className="text-sm font-bold text-white/60">{t("hiw.hero_eyebrow")}</p>
      <div className="relative mt-4 w-fit">
        <BlurHighlightText
          as="h1"
          active={copyActive}
          highlights={highlights}
          className="max-w-3xl text-4xl font-extrabold leading-[1.02] tracking-tight text-white sm:text-6xl"
        >
          {t("hiw.hero_title")}
        </BlurHighlightText>
        <Asterisk
          className="absolute -right-6 -top-4 h-5 w-5 text-white/35 sm:-right-9 sm:-top-5 sm:h-7 sm:w-7"
          aria-hidden="true"
        />
      </div>
      <p className="mt-5 max-w-xl text-base leading-7 text-white/65">{t("hiw.hero_body")}</p>
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Button asChild size="lg" variant="solid" color="accent">
          <Link to="/tutors">
            {t("hiw.hero_cta_browse")} <ArrowRight />
          </Link>
        </Button>
        <Button
          asChild
          size="lg"
          variant="outline"
          className="border-white/25 bg-white/5 text-white shadow-none hover:border-white/40 hover:bg-white/10 hover:text-white"
        >
          <Link to="/join">{t("hiw.hero_cta_apply")}</Link>
        </Button>
      </div>
    </div>
  );
}

function PinnedStage({
  tutors,
  onStageActiveChange,
}: {
  tutors: Tutor[];
  onStageActiveChange?: StageActiveChange;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [copyActive, setCopyActive] = useState(false);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const progress = useSpring(scrollYProgress, { stiffness: 100, damping: 20, mass: 0.5 });

  useStageActive(sectionRef, onStageActiveChange);

  useEffect(() => {
    setCopyActive(progress.get() > COPY_REVEAL);
  }, [progress]);
  useMotionValueEvent(progress, "change", (value) => setCopyActive(value > COPY_REVEAL));

  const bannerWidth = useTransform(progress, [0, UNFURL_END], ["88vw", "100vw"]);
  const bannerHeight = useTransform(progress, [0, UNFURL_END], ["78vh", "100vh"]);
  const bannerRadius = useTransform(progress, [0, UNFURL_END], ["48px", "0px"]);
  const ringOpacity = useTransform(progress, [0, UNFURL_END * 0.8], [1, 0]);

  const matrixRotateX = useTransform(progress, [UNFURL_END, 1], [25, 4]);
  const matrixRotateY = useTransform(progress, [UNFURL_END, 1], [-45, -8]);
  const matrixRotateZ = useTransform(progress, [UNFURL_END, 1], [15, 2]);
  const matrixZ = useTransform(progress, [UNFURL_END, 1], [-800, 0]);

  const yCol1 = useTransform(progress, [UNFURL_END, 1], ["0%", "-38%"]);
  const yCol2 = useTransform(progress, [UNFURL_END, 1], ["-38%", "8%"]);
  const yCol3 = useTransform(progress, [UNFURL_END, 1], ["0%", "-38%"]);
  const yCol4 = useTransform(progress, [UNFURL_END, 1], ["-30%", "18%"]);
  const columnMotion = [yCol1, yCol2, yCol3, yCol4];

  const copyOpacity = useTransform(progress, [COPY_REVEAL, COPY_REVEAL + 0.12], [0, 1]);
  const copyY = useTransform(progress, [COPY_REVEAL, 0.9], [48, 0]);

  const columns = useMemo(() => {
    const featured = tutors.slice(0, MATRIX_TUTOR_LIMIT);
    return Array.from({ length: COLUMN_COUNT }, (_, column) =>
      featured.filter((_, index) => index % COLUMN_COUNT === column),
    ).map((columnTutors) => [...columnTutors, ...columnTutors]);
  }, [tutors]);

  return (
    <section ref={sectionRef} className="relative h-[350vh] bg-[#050505] md:h-[500vh]">
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden">
        <motion.div
          style={{ width: bannerWidth, height: bannerHeight, borderRadius: bannerRadius }}
          className="relative mx-auto max-w-[1920px] overflow-hidden border border-white/10 bg-black"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_30%,rgba(29,161,242,0.28),transparent_33%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
            style={{ perspective: "1200px" }}
          >
            <motion.div
              style={{
                rotateX: matrixRotateX,
                rotateY: matrixRotateY,
                rotateZ: matrixRotateZ,
                z: matrixZ,
                transformStyle: "preserve-3d",
              }}
              className="flex h-[150vh] w-[130vw] items-center justify-center gap-4 will-change-transform md:gap-6"
            >
              {columns.map((columnTutors, columnIndex) => (
                <motion.div
                  key={columnIndex}
                  style={{ y: columnMotion[columnIndex] }}
                  className={cn(
                    "flex w-[42vw] flex-col gap-4 md:w-[22vw] md:gap-6",
                    columnIndex > 1 && "hidden md:flex",
                  )}
                >
                  {columnTutors.length > 0
                    ? columnTutors.map((tutor, index) => (
                        <TutorTile key={`${tutor.id}-${index}`} tutor={tutor} />
                      ))
                    : Array.from({ length: 6 }).map((_, index) => <PlaceholderTile key={index} />)}
                </motion.div>
              ))}
            </motion.div>
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 shadow-[inset_0_100px_150px_-50px_rgba(0,0,0,1),inset_0_-150px_190px_-40px_rgba(0,0,0,0.98)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 shadow-[inset_150px_0_150px_-50px_rgba(0,0,0,1),inset_-150px_0_150px_-50px_rgba(0,0,0,1)]"
          />
          <motion.div
            style={{ opacity: copyOpacity, y: copyY }}
            className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-5 pb-12 sm:px-8 sm:pb-16 lg:px-12"
          >
            <div className="pointer-events-auto">
              <HeroCopy copyActive={copyActive} />
            </div>
          </motion.div>
          <motion.div
            aria-hidden="true"
            style={{ opacity: ringOpacity }}
            className="pointer-events-none absolute inset-0 z-40 rounded-[inherit] border-[3px] border-white/15"
          />
        </motion.div>
      </div>
    </section>
  );
}

function StaticHero({
  tutors,
  onStageActiveChange,
}: {
  tutors: Tutor[];
  onStageActiveChange?: StageActiveChange;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  useStageActive(sectionRef, onStageActiveChange);
  const featured = tutors.slice(0, 8);

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-[#050505] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_30%,rgba(29,161,242,0.28),transparent_33%)]"
      />
      <div className="relative mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <HeroCopy />
        <div className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {featured.length > 0
            ? featured.map((tutor) => <TutorTile key={tutor.id} tutor={tutor} />)
            : Array.from({ length: 4 }).map((_, index) => <PlaceholderTile key={index} />)}
        </div>
      </div>
    </section>
  );
}

export function HeroReveal({ onStageActiveChange }: { onStageActiveChange?: StageActiveChange }) {
  const shouldReduceMotion = useReducedMotion();
  const { data: tutors = [] } = useQuery({
    queryKey: ["tutors", "published"],
    queryFn: fetchPublishedTutors,
  });

  return shouldReduceMotion ? (
    <StaticHero tutors={tutors} onStageActiveChange={onStageActiveChange} />
  ) : (
    <PinnedStage tutors={tutors} onStageActiveChange={onStageActiveChange} />
  );
}
