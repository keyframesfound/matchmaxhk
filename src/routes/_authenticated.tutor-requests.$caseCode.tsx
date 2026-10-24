import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
// Locale-aware relative times (zh-HK, GLM round-3 minor on #430). The
// share/WhatsApp message templates below stay English on purpose — they are
// outbound message copy, not on-page UI.
import { formatPostedAgo } from "@/lib/relative-time";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarClock,
  Check,
  Clock,
  GraduationCap,
  MapPin,
  Share2,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { PublicPage } from "@/components/layout/PublicPage";
import { WhatsAppIcon } from "@/components/layout/WhatsAppFloatButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CASE_GENDER_LABEL,
  CASE_GENDER_LABEL_ZH,
  CASE_LANGUAGE_LABEL,
  CASE_LANGUAGE_LABEL_ZH,
  CASE_MODE_LABEL,
  CASE_MODE_LABEL_ZH,
  CASE_START_LABEL,
  CASE_START_LABEL_ZH,
  buildCaseApplyWhatsAppUrl,
  caseBudgetForTutor,
  caseBudgetHkdBounds,
  formatCaseRate,
} from "@/features/cases/display";
import {
  CaseChipLink,
  CaseFeePill,
  caseGradeLabel,
  useCaseTitles,
} from "@/features/cases/case-card";
import { caseScreeningLabel } from "@/features/cases/display";
import { flagCaseComplianceConcern } from "@/features/cases/centre-case.functions";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { caseChips } from "@/features/cases/case-chips";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getPublicCaseByCode, type PublicCaseBoardItem } from "@/lib/cases.functions";
import { shareOrCopy } from "@/lib/share";
import { buildCaseTitle, caseTitleFieldsFromBoard } from "@/features/cases/case-title";
import { CaseSaveButton } from "@/features/cases/saved-cases";
import { caseAcademicTier } from "@/features/tutors/verticals";
import { kindergartenTopicLabel } from "@/features/tutors/verticals-labels";
import { useDisplayCurrency } from "@/features/currency/display-currency-context";
import { useTutorDisplayCurrency } from "@/features/currency/tutor-currency";

type CaseDetailData = { item: PublicCaseBoardItem; whatsappNumber: string };

export const Route = createFileRoute("/_authenticated/tutor-requests/$caseCode")({
  loader: async ({ params }) => {
    const data = await getPublicCaseByCode({ data: { caseCode: params.caseCode } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ match }) => {
    const data = (match.loaderData ?? null) as CaseDetailData | null;
    // Map at the boundary: the raw item has examSystem/studentLevel, not
    // curriculum/grade — an unmapped pass titles subject-only (GLM blocker).
    const title = data
      ? `${buildCaseTitle(caseTitleFieldsFromBoard(data.item), "en") || data.item.title} — Case ${data.item.caseCode} | MatchMax`
      : "Tutor request | MatchMax";
    const description = (
      data?.item.description ??
      "Open tutoring request from a Hong Kong parent on MatchMax. Apply via WhatsApp — free for tutors."
    ).slice(0, 200);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: CaseDetailPage,
});

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <Check
        className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--muted-foreground)]"
        aria-hidden="true"
      />
      <span>{children}</span>
    </li>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold tracking-tight text-[color:var(--ink)]">{children}</h2>;
}

function CaseDetailPage() {
  const { t, i18n } = useTranslation();
  // GLM round-3 minor on #430: this page's sentence lines previously rendered
  // hardcoded English inside t()-keyed headings — zh-HK visitors got a
  // mixed-language page. Every visible string now routes through the
  // case_board.* keys; the structured value slots use the zh label maps in
  // display.ts when the active locale is zh-HK.
  const zh = i18n.language === "zh-HK";
  const { item, whatsappNumber } = Route.useLoaderData() as CaseDetailData;
  // Issue #113: convert the budget for tutors quoting in another currency.
  const tutorCurrency = useTutorDisplayCurrency();
  const { rates: tutorFxRates } = useDisplayCurrency();
  const tutorBudget = caseBudgetForTutor(item, tutorCurrency, tutorFxRates, item.rateUnit);
  const applyUrl = buildCaseApplyWhatsAppUrl(whatsappNumber, item.caseCode);
  const { primary: title, secondary: titleSecondary } = useCaseTitles(item);
  const [isSharing, setIsSharing] = useState(false);

  // Issue #423: the gender Female/Male Only chip is a HARD preference —
  // when the viewing tutor's own profile gender contradicts it, Apply dims
  // and shows ⚠️ (a warning, not a block). Guests and genderless tutors
  // never see a mismatch.
  const { user } = useAuth();
  const [viewerGender, setViewerGender] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void supabase
      .from("tutors")
      .select("gender")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const gender = (data?.gender as string | null)?.toLowerCase() ?? null;
        setViewerGender(gender);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);
  const genderMismatch =
    (item.preferredGender === "female" && viewerGender === "male") ||
    (item.preferredGender === "male" && viewerGender === "female");

  // Issue #412 E: centre cases show the screening summary and require one
  // radio before Apply — confirm enables the WhatsApp link; clarify posts
  // the concern to the desk and re-holds the case instead.
  const [screeningChoice, setScreeningChoice] = useState<"confirm" | "clarify" | null>(null);
  const [clarifyNote, setClarifyNote] = useState("");
  const flagConcernFn = useServerFn(flagCaseComplianceConcern);
  const flagConcern = useMutation({
    mutationFn: (note: string) => flagConcernFn({ data: { caseId: item.id, note } }),
    onSuccess: () => {
      toast.success(t("case_board.screening_clarify_sent"));
      setClarifyNote("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const screeningLocked = Boolean(item.centre) && screeningChoice !== "confirm";
  const applyDisabled = screeningLocked || (Boolean(item.centre) && screeningChoice === "clarify");

  // Issue #423: "Rate TBA" is allowed ONLY on the detail page — the matrix
  // omits the rate everywhere else, and "HK$?" never renders.
  const { min: rateMin, max: rateMax } = caseBudgetHkdBounds(item);
  const rateHkd = formatCaseRate(rateMin, rateMax, item.rateUnit);
  const rateLabel = tutorBudget.primary ?? (rateHkd || t("case_request.rate_tba"));

  const handleShare = () => {
    setIsSharing(true);
    // Issue #423: a both-blank budget has no rate text — never "HK$?".
    const shareRate = tutorBudget.primary ?? rateHkd;
    void shareOrCopy({
      title: `${title} — Case ${item.caseCode} | MatchMax`,
      text: shareRate
        ? `Check out this tutoring request (Case ${item.caseCode}) on MatchMax — ${shareRate}.`
        : `Check out this tutoring request (Case ${item.caseCode}) on MatchMax.`,
      url: window.location.href,
    }).finally(() => setIsSharing(false));
  };

  // Locale-aware value labels for the meta row and the lessons/preferences
  // sentences (GLM round-3 minor on #430): known tokens use the EN maps (or
  // the zh maps above when zh-HK is active), unknown tokens pass through.
  const modeText = item.mode
    ? ((zh ? CASE_MODE_LABEL_ZH[item.mode] : CASE_MODE_LABEL[item.mode]) ?? item.mode)
    : null;
  const genderText = item.preferredGender
    ? ((zh
        ? CASE_GENDER_LABEL_ZH[item.preferredGender]
        : CASE_GENDER_LABEL[item.preferredGender]) ?? item.preferredGender)
    : null;
  const startText = item.startTiming
    ? ((zh ? CASE_START_LABEL_ZH[item.startTiming] : CASE_START_LABEL[item.startTiming]) ??
      item.startTiming)
    : null;
  const languageText = item.languageOfInstruction
    ? ((zh
        ? CASE_LANGUAGE_LABEL_ZH[item.languageOfInstruction]
        : CASE_LANGUAGE_LABEL[item.languageOfInstruction]) ?? item.languageOfInstruction)
    : null;

  const meta = [
    {
      icon: GraduationCap,
      label: caseGradeLabel(item),
    },
    {
      icon: MapPin,
      label: item.district ?? modeText ?? t("case_board.location_flexible"),
    },
    {
      icon: Clock,
      label: t("case_board.meta_schedule", {
        per_week: item.sessionsPerWeek,
        minutes: item.sessionLengthMinutes,
      }),
    },
    {
      icon: Wallet,
      // Issue #113: tutor-quoting currencies get the converted figure first.
      label: rateLabel,
      hint:
        tutorBudget.primary && rateHkd
          ? t("case_board.meta_original", { rate: rateHkd })
          : undefined,
    },
  ];

  // Issue #423: one chip system, grouped soft vs hard for the detail skim.
  const chips = caseChips(item);
  const hardChips = chips.filter((chip) => chip.hard);
  const softChips = chips.filter((chip) => !chip.hard);

  // Issue #423 section 3 / #385 rules: the net payout block swaps by
  // package_type. Per-lesson math only — short packages store no lesson
  // count, so no package total is invented.
  const agreedRate =
    item.budgetMaxHkd ?? item.budgetMax ?? item.budgetMinHkd ?? item.budgetMin ?? null;
  const rateUnitSuffix =
    item.rateUnit === "lesson" ? "lesson" : item.rateUnit === "month" ? "month" : "hr";
  // Localized unit word for prose ("per hr" / 每小時); money strings keep the
  // repo-wide "HK$300/hr" convention on both locales.
  const unitLabel = t(
    item.rateUnit === "lesson"
      ? "case_board.unit_lesson"
      : item.rateUnit === "month"
        ? "case_board.unit_month"
        : "case_board.unit_hr",
  );
  const payout =
    item.packageType === "pro_bono"
      ? [
          t("case_board.payout_probono_tuition"),
          t("case_board.payout_probono_admin"),
          t("case_board.payout_probono_net"),
        ]
      : item.packageType === "short_20"
        ? [
            t("case_board.payout_short_tuition", {
              rate: agreedRate !== null ? `HK$${agreedRate}` : t("case_request.rate_tba"),
              unit: unitLabel,
            }),
            t("case_board.payout_short_admin"),
            t("case_board.payout_short_net"),
          ]
        : agreedRate !== null
          ? [
              t("case_board.payout_ongoing_tuition", {
                rate: `HK$${agreedRate}/${rateUnitSuffix}`,
                fee: `HK$${Math.round(agreedRate * 1.5)}`,
              }),
              t("case_board.payout_ongoing_l1"),
              t("case_board.payout_ongoing_l2", {
                rate: `HK$${Math.round(agreedRate * 0.5)}`,
              }),
              t("case_board.payout_ongoing_l3", {
                rate: `HK$${agreedRate}`,
                unit: unitLabel,
              }),
            ]
          : null;

  const lessons = [
    t("case_board.detail_subjects", {
      list:
        item.subjects.filter(Boolean).join(zh ? "、" : ", ") ||
        t("case_board.detail_subjects_none"),
    }),
    t("case_board.detail_cadence", {
      per_week: item.sessionsPerWeek,
      minutes: item.sessionLengthMinutes,
    }),
    `${t("case_board.detail_lessons_mode", { mode: modeText ?? "" })}${
      item.district ? ` · ${item.district}` : ""
    }`,
  ];

  const curriculum =
    item.examSystem && item.examSystem !== "Not sure yet"
      ? item.examSystem
      : t("case_board.detail_flexible");
  const preferences = [
    t("case_board.detail_pref_curriculum", { value: curriculum }),
    t("case_board.detail_pref_gender", {
      value: genderText ?? t("case_board.detail_no_preference"),
    }),
    t("case_board.detail_pref_start", {
      value: startText ?? t("case_board.detail_flexible"),
    }),
  ];
  if (item.languageOfInstruction && item.languageOfInstruction !== "either") {
    preferences.splice(
      1,
      0,
      t("case_board.detail_pref_language", {
        value: languageText ?? item.languageOfInstruction,
      }),
    );
  }
  if (item.studentCount > 1) {
    preferences.push(t("case_board.detail_pref_students", { students: item.studentCount }));
  }
  if (item.packageType === "short_20") {
    preferences.push(t("case_board.detail_pref_short"));
  } else if (item.packageType === "pro_bono") {
    preferences.push(t("case_board.detail_pref_probono"));
  }

  // Issue #190: vertical details — uni block for the University tier,
  // K focus topics for the Kindergarten tier (legacy rows derive the tier).
  const tier = caseAcademicTier(item.academicTier, item.studentLevel);
  if (tier === "university") {
    if (item.uniField) {
      preferences.push(t("case_request.detail_uni_field", { value: item.uniField }));
    }
    if (item.uniName) {
      preferences.push(t("case_request.detail_uni_name", { value: item.uniName }));
    }
    if (item.uniProgram) {
      preferences.push(t("case_request.detail_uni_program", { value: item.uniProgram }));
    }
    if (item.uniCourseCodes) {
      preferences.push(t("case_request.detail_uni_courses", { value: item.uniCourseCodes }));
    }
  }
  if (tier === "kindergarten" && item.kindergartenFocus.length > 0) {
    preferences.push(
      t("case_request.detail_k_focus", {
        value: item.kindergartenFocus.map(kindergartenTopicLabel).join("、"),
      }),
    );
  }

  return (
    <PublicPage>
      <section className="flex w-full justify-center px-4 py-10 sm:px-6 sm:py-14">
        <article className="w-full max-w-2xl">
          <Link
            to="/tutor-requests"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("case_board.all_open_requests")}
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-fit rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
                  {item.caseCode}
                </span>
                <CaseFeePill packageType={item.packageType} />
                <span className="text-xs text-muted-foreground">
                  {t("case_board.posted_ago", {
                    ago: formatPostedAgo(item.createdAt, i18n.language),
                  })}
                </span>
              </div>
              {/* Bilingual auto-title block (#411 pattern): locale-primary
                  headline, parallel locale line beneath. */}
              <h1 className="text-2xl font-bold tracking-tight text-[color:var(--ink)] sm:text-3xl">
                {title}
              </h1>
              {titleSecondary ? (
                <p className="text-lg text-muted-foreground">{titleSecondary}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                {meta.map(({ icon: Icon, label, hint }) => (
                  <span key={label} className="flex items-center gap-1.5" title={hint}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {label}
                  </span>
                ))}
                {item.startTiming === "asap" ? (
                  <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                    <CalendarClock className="h-4 w-4" aria-hidden="true" />
                    {t("case_board.starts_asap")}
                  </span>
                ) : null}
              </div>
              {/* One chip system, grouped soft vs hard (#423 section 3). */}
              {chips.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("case_board.chips_title")}
                  </p>
                  {hardChips.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-xs font-medium text-muted-foreground">
                        {t("case_board.chips_hard")}:
                      </span>
                      {hardChips.map((chip) => (
                        <CaseChipLink key={chip.key} chip={chip} />
                      ))}
                    </div>
                  ) : null}
                  {softChips.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-xs font-medium text-muted-foreground">
                        {t("case_board.chips_soft")}:
                      </span>
                      {softChips.map((chip) => (
                        <CaseChipLink key={chip.key} chip={chip} />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                aria-label={t("case_board.share_case")}
                title={t("case_board.share_case")}
                disabled={isSharing}
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4" aria-hidden="true" />
              </Button>
              <CaseSaveButton caseId={item.id} />
              {genderMismatch ? (
                <span
                  className="inline-flex h-9 w-9 items-center justify-center text-[#a16207] dark:text-[color:var(--warning)]"
                  title={t("case_board.gender_mismatch_warning")}
                >
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </span>
              ) : null}
              {item.centre ? (
                <Button
                  size="lg"
                  variant="solid"
                  color="blue"
                  disabled={applyDisabled || flagConcern.isPending}
                  className={genderMismatch ? "opacity-50" : undefined}
                  title={
                    screeningLocked
                      ? t("case_board.screening_confirm_required")
                      : genderMismatch
                        ? t("case_board.gender_mismatch_warning")
                        : undefined
                  }
                  onClick={() => {
                    if (applyDisabled) {
                      toast.error(t("case_board.screening_confirm_required"));
                      return;
                    }
                    window.open(applyUrl, "_blank", "noreferrer");
                  }}
                >
                  <WhatsAppIcon aria-hidden="true" />
                  {t("case_board.apply_now")}
                </Button>
              ) : (
                <Button
                  asChild
                  size="lg"
                  variant="solid"
                  color="blue"
                  className={genderMismatch ? "opacity-50" : undefined}
                >
                  <a
                    href={applyUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={genderMismatch ? t("case_board.gender_mismatch_warning") : undefined}
                  >
                    <WhatsAppIcon aria-hidden="true" />
                    {t("case_board.apply_now")}
                  </a>
                </Button>
              )}
            </div>
          </div>

          <Separator className="my-8" />

          <div className="flex flex-col gap-8 text-[15px] leading-relaxed text-foreground/80">
            {/* Issue #423: an empty note HIDES the quote block entirely —
                never a "parent didn't add notes" placeholder. */}
            {item.description?.trim() ? (
              <div className="flex flex-col gap-3">
                <SectionHeading>{t("case_board.notes_title")}</SectionHeading>
                <p>{item.description}</p>
              </div>
            ) : null}

            <div className="flex flex-col gap-3">
              <SectionHeading>{t("case_board.detail_lessons_title")}</SectionHeading>
              <ul className="flex flex-col gap-2.5">
                {lessons.map((lesson) => (
                  <CheckItem key={lesson}>{lesson}</CheckItem>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <SectionHeading>{t("case_board.detail_preferences_title")}</SectionHeading>
              <ul className="flex flex-col gap-2.5">
                {preferences.map((preference) => (
                  <CheckItem key={preference}>{preference}</CheckItem>
                ))}
              </ul>
            </div>

            {/* Issue #412 E / #423 B2B: centre identity + Cap.57 chip +
                the read-only screening summary with the confirm/clarify
                gate. Parent cases never render this block. */}
            {item.centre ? (
              <div className="flex flex-col gap-3">
                <SectionHeading>{t("case_board.centre_summary_title")}</SectionHeading>
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Building2
                      className="h-4 w-4 text-[color:var(--brand-link)]"
                      aria-hidden="true"
                    />
                    <span className="font-semibold text-[color:var(--ink)]">
                      {item.centre.name}
                    </span>
                    {item.centre.verified ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-[color:var(--brand-link)]/40 text-[color:var(--brand-link)]"
                      >
                        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                        {t("case_board.centre_verified")}
                      </Badge>
                    ) : null}
                    <Badge
                      variant="outline"
                      className="border-purple-500/40 text-purple-700 dark:text-purple-400"
                    >
                      {t("case_board.cap57_chip")}
                    </Badge>
                  </div>
                  {item.centre.verified && item.centre.slug ? (
                    <Link
                      to="/business/$slug"
                      params={{ slug: item.centre.slug }}
                      className="text-xs font-semibold text-[color:var(--brand-link)] hover:underline"
                    >
                      {t("case_board.centre_view_profile")}
                    </Link>
                  ) : null}
                  {item.screening ? (
                    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                      {(
                        [
                          [
                            "case_board.screening_contracting",
                            caseScreeningLabel(
                              item.screening.contractingEntity,
                              zh ? "zh-HK" : "en",
                            ),
                          ],
                          [
                            "case_board.screening_fee",
                            [
                              caseScreeningLabel(item.screening.feeStructure, zh ? "zh-HK" : "en"),
                              item.screening.feeAmount,
                              item.screening.feeOpenToCounter
                                ? t("case_board.screening_open_to_counter")
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · "),
                          ],
                          [
                            "case_board.screening_premises",
                            caseScreeningLabel(
                              item.screening.premisesProvider,
                              zh ? "zh-HK" : "en",
                            ),
                          ],
                          ["case_board.screening_scope", item.screening.scopeDescription],
                          [
                            "case_board.screening_zero_admin",
                            item.screening.adminDutiesVerified
                              ? t("case_board.screening_confirmed_no")
                              : null,
                          ],
                          [
                            "case_board.screening_methodology",
                            caseScreeningLabel(
                              item.screening.methodologyOwner,
                              zh ? "zh-HK" : "en",
                            ),
                          ],
                          [
                            "case_board.screening_other_clients",
                            caseScreeningLabel(
                              item.screening.otherClientsAllowed,
                              zh ? "zh-HK" : "en",
                            ),
                          ],
                          [
                            "case_board.screening_substitution",
                            caseScreeningLabel(
                              item.screening.substitutionAllowed,
                              zh ? "zh-HK" : "en",
                            ),
                          ],
                        ] as const
                      )
                        .filter(([, value]) => Boolean(value))
                        .map(([labelKey, value]) => (
                          <div key={labelKey} className="min-w-0">
                            <dt className="text-[11px] font-medium text-muted-foreground">
                              {t(labelKey)}
                            </dt>
                            <dd className="text-sm font-medium text-[color:var(--ink)]">{value}</dd>
                          </div>
                        ))}
                    </dl>
                  ) : null}
                  {/* Confirm / clarify gate before Apply. */}
                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="text-xs font-semibold text-[color:var(--ink)]">
                      {t("case_board.screening_confirm_title")}
                    </p>
                    {(
                      [
                        ["confirm", "case_board.screening_confirm_option"],
                        ["clarify", "case_board.screening_clarify_option"],
                      ] as const
                    ).map(([value, key]) => (
                      <label
                        key={value}
                        className="flex cursor-pointer items-start gap-2.5 text-sm text-muted-foreground"
                      >
                        <input
                          type="radio"
                          name="centre-screening"
                          className="mt-1 accent-[color:var(--brand-link)]"
                          checked={screeningChoice === value}
                          onChange={() => setScreeningChoice(value)}
                        />
                        <span>{t(key)}</span>
                      </label>
                    ))}
                    {screeningChoice === "clarify" ? (
                      <div className="space-y-2">
                        <Textarea
                          rows={3}
                          maxLength={500}
                          placeholder={t("case_board.screening_clarify_placeholder")}
                          value={clarifyNote}
                          onChange={(e) => setClarifyNote(e.target.value)}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={clarifyNote.trim().length < 10 || flagConcern.isPending}
                          onClick={() => flagConcern.mutate(clarifyNote.trim())}
                        >
                          {flagConcern.isPending
                            ? t("case_board.screening_clarify_sending")
                            : t("case_board.screening_clarify_submit")}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {payout ? (
              <div className="flex flex-col gap-3">
                <SectionHeading>{t("case_board.payout_title")}</SectionHeading>
                <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-4 text-sm">
                  <CaseFeePill packageType={item.packageType} className="w-fit" />
                  <ul className="flex flex-col gap-1.5">
                    {payout.map((line) => (
                      <CheckItem key={line}>{line}</CheckItem>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>

          <Separator className="my-8" />

          <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-bold text-[color:var(--ink)]">
                {t("case_board.ready_title")}
              </p>
              <p className="text-sm text-muted-foreground">{t("case_board.ready_body")}</p>
            </div>
            <Button
              asChild
              variant="solid"
              color="blue"
              className={`shrink-0 ${genderMismatch ? "opacity-50" : undefined}`}
            >
              <a
                href={applyUrl}
                target="_blank"
                rel="noreferrer"
                title={genderMismatch ? t("case_board.gender_mismatch_warning") : undefined}
              >
                {genderMismatch ? <AlertTriangle aria-hidden="true" /> : null}
                <WhatsAppIcon aria-hidden="true" />
                {t("case_board.apply_now")}
              </a>
            </Button>
          </div>
        </article>
      </section>
    </PublicPage>
  );
}
