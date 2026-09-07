import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Asterisk } from "lucide-react";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useTranslation } from "react-i18next";

import { BlurHighlightText } from "@/components/ui/blur-highlight-text";
import { Button } from "@/components/ui/button";
import { PublicTutorCard } from "@/features/tutors/public-tutor-card";
import { fetchPublishedTutors, type Tutor } from "@/features/tutors/queries";

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

function RevealTutorCard({ tutor, onView }: { tutor: Tutor; onView: (tutorCode: string) => void }) {
  const { t } = useTranslation();
  return (
    <PublicTutorCard
      tutor={tutor}
      priceSuffix={t("featured.per_hour")}
      onOpen={onView}
      footerAction={
        <Button
          asChild
          className="h-9 shrink-0 rounded-sm bg-[color:var(--surface-invert)] px-3 text-[13px] font-bold text-white hover:bg-[color:var(--surface-invert-hover)] md:px-4"
        >
          <Link to="/tutors/$tutorCode" params={{ tutorCode: tutor.tutor_code }}>
            {t("hiw.card_view_profile")}
          </Link>
        </Button>
      }
    />
  );
}

function PlaceholderTile() {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-[20rem] flex-col overflow-hidden rounded-[var(--radius-panel)] border border-white/[0.06] bg-[linear-gradient(160deg,#0e1420_0%,#080b12_100%)] md:min-h-[23rem]"
    >
      <div className="min-h-0 flex-1" />
      <div className="space-y-2 border-t border-white/[0.05] p-3">
        <div className="h-3 w-2/3 rounded-full bg-white/[0.07]" />
        <div className="h-2.5 w-1/2 rounded-full bg-white/[0.05]" />
      </div>
    </div>
  );
}

function HeroCopy() {
  const { t } = useTranslation();

  return (
    <div className="text-center">
      <p className="text-sm font-bold text-white">{t("hiw.hero_eyebrow")}</p>
      <div className="relative mx-auto mt-4 w-fit">
        <BlurHighlightText
          as="h1"
          active
          className="max-w-3xl text-4xl font-extrabold leading-[1.02] tracking-tight text-white sm:text-6xl"
        >
          {t("hiw.hero_title")}
        </BlurHighlightText>
        <Asterisk
          className="absolute -right-6 -top-4 h-5 w-5 text-white/35 sm:-right-9 sm:-top-5 sm:h-7 sm:w-7"
          aria-hidden="true"
        />
      </div>
      <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white">{t("hiw.hero_body")}</p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
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

function StaticHero({
  tutors,
  openTutor,
  onStageActiveChange,
}: {
  tutors: Tutor[];
  openTutor: (tutorCode: string) => void;
  onStageActiveChange?: StageActiveChange;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  useStageActive(sectionRef, onStageActiveChange);
  const featured =
    tutors.length > 0 ? Array.from({ length: 8 }, (_, index) => tutors[index % tutors.length]) : [];

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-[#050505] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_30%,rgba(29,161,242,0.28),transparent_33%)]"
      />
      <div className="relative mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <HeroCopy />
        <div className="mt-14 grid items-start grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {featured.length > 0
            ? featured.map((tutor, index) => (
                <RevealTutorCard key={`${tutor.id}-${index}`} tutor={tutor} onView={openTutor} />
              ))
            : Array.from({ length: 4 }).map((_, index) => <PlaceholderTile key={index} />)}
        </div>
      </div>
    </section>
  );
}

export function HeroReveal({ onStageActiveChange }: { onStageActiveChange?: StageActiveChange }) {
  const navigate = useNavigate();
  const { data: tutors = [] } = useQuery({
    queryKey: ["tutors", "published"],
    queryFn: fetchPublishedTutors,
  });

  const openTutor = useCallback(
    (tutorCode: string) => {
      void navigate({ to: "/tutors/$tutorCode", params: { tutorCode } });
    },
    [navigate],
  );

  return (
    <StaticHero tutors={tutors} openTutor={openTutor} onStageActiveChange={onStageActiveChange} />
  );
}
