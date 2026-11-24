import { useQuery } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { hktClock, hktDayLabel } from "@/features/cases/case-schedule";
import { getWeeklyDigest } from "@/features/cases/weekly-digest.functions";
import { buildDigestCopy, type DigestLabels } from "@/features/cases/weekly-digest-logic";
import i18n from "@/features/i18n/config";

/** HKT "Tue, 10 Nov" plus "18:30", in the lane the copy block is built for. */
const formatWhen = (iso: string, zone: string) => `${hktDayLabel(iso, zone)} ${hktClock(iso)}`;

/**
 * Copy text to the clipboard with a legacy path for browsers that predate the
 * async clipboard API (older Safari). Returns false when neither path works, so
 * the caller never claims success it cannot evidence.
 */
async function writeClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/**
 * Issue #796 §2.6 (was #742) Weekly Learning Digest, parent case page.
 *
 * Facts only: verified lessons, verified hours, recaps the tutor already wrote,
 * homework and mistakes the student closed, the next lesson, current mastery and
 * focus. No streaks, no score-lift, no averages, no grade promise (AC-742-1).
 *
 * The copy button hands the parent a paste-ready WhatsApp block. The whole body
 * comes from `buildDigestCopy`, which carries the matchmax.hk case link and no
 * database ids or phone numbers (AC-742-2) — nothing is appended here.
 *
 * The server returns null for a learner-only or quiet week, and the card
 * renders nothing rather than hinting at a case the caller cannot see.
 */
export function WeeklyDigestCard({
  caseId,
  caseTitle,
}: {
  caseId: string;
  /**
   * Optional case label. The dashboard stacks one card per case, so without it
   * two children's digests would be indistinguishable; the case page omits it.
   */
  caseTitle?: string;
}) {
  const { t } = useTranslation();
  const tZh = i18n.getFixedT("zh-HK");
  const headingId = useId();

  const { data } = useQuery({
    queryKey: ["case-weekly-digest", caseId],
    queryFn: () => getWeeklyDigest({ data: { caseId } }),
  });

  const digest = data?.digest;
  if (!digest) return null;
  const caseCode = data.caseCode;

  const lane = i18n.language?.startsWith("zh") ? "zh-HK" : "en";
  const start = hktDayLabel(digest.startIso, lane);
  const end = hktDayLabel(digest.endIso, lane);
  const next = digest.nextLesson;
  const nextWhen = next
    ? next.tag
      ? `${formatWhen(next.startsAt, lane)} · ${next.tag}`
      : formatWhen(next.startsAt, lane)
    : null;

  const { mastered, practicing, weak } = digest.mastery;
  const focus = digest.focus.filter((item) => item.trim().length > 0);
  const hasFacts =
    digest.lessonsThisWeek > 0 ||
    digest.hoursThisWeek > 0 ||
    digest.hoursTotal > 0 ||
    digest.recaps.length > 0 ||
    digest.homeworkCompleted > 0 ||
    digest.mistakesMastered > 0 ||
    mastered + practicing + weak > 0 ||
    focus.length > 0;

  const rows: string[] = [
    t("weekly_digest.lessons", { n: digest.lessonsThisWeek }),
    t("weekly_digest.hours_week", { h: digest.hoursThisWeek }),
    t("weekly_digest.hours_total", { h: digest.hoursTotal }),
  ];

  /**
   * The four-part recap (#742 / #796 §2.6): covered, progress, additional
   * practice, next steps. Each part renders only from a fact the case already
   * holds, so an absent part is absent, never invented. "Additional practice"
   * is the homework and mistake work the student actually completed; the
   * practice a tutor assigns is not recorded anywhere yet: no column holds a
   * set practice list, so that half of the part is honest about what exists.
   */
  const covered = digest.topicsCovered ?? [];
  const practiceRows: string[] = [];
  if (digest.homeworkCompleted > 0) {
    practiceRows.push(t("weekly_digest.homework", { n: digest.homeworkCompleted }));
  }
  if (digest.mistakesMastered > 0) {
    practiceRows.push(t("weekly_digest.mistakes", { n: digest.mistakesMastered }));
  }
  const hasMastery = mastered + practicing + weak > 0;
  const hasPractice = practiceRows.length > 0;
  const hasNext = nextWhen !== null || focus.length > 0;

  /**
   * Raw i18next templates, not interpolated strings: the copy builder fills
   * `{{n}}` / `{{h}}` itself so hours are rounded once (no raw floats) and the
   * case code and recaps are scrubbed of ids, emails and phones. Passing
   * pre-filled values here would bypass all three.
   */
  const labelsFor = (translate: typeof t): DigestLabels => ({
    header: translate("weekly_digest.copy_header"),
    case: translate("weekly_digest.copy_case"),
    lessons: translate("weekly_digest.lessons"),
    hoursWeek: translate("weekly_digest.hours_week"),
    hoursTotal: translate("weekly_digest.hours_total"),
    recap: translate("weekly_digest.recap_title"),
    homework: translate("weekly_digest.homework"),
    mistakes: translate("weekly_digest.mistakes"),
    next: translate("weekly_digest.next_lesson"),
    mastery: translate("weekly_digest.mastery"),
    focus: translate("weekly_digest.focus"),
  });

  const copy = async () => {
    const text = buildDigestCopy({
      digest,
      caseCode,
      link: `https://matchmax.hk/calendar?case=${caseCode}`,
      en: labelsFor(t),
      zh: labelsFor(tZh),
      formatWhen,
    });
    if (await writeClipboard(text)) toast.success(t("weekly_digest.copied"));
  };

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-[var(--radius-panel)] border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={headingId} className="text-sm font-semibold text-[color:var(--ink)]">
          {t("weekly_digest.title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("weekly_digest.period", { start, end })}</p>
      </div>

      {caseTitle ? (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{caseTitle}</p>
      ) : null}

      {hasFacts ? (
        <>
          <ul className="mt-3 space-y-1 text-sm text-[color:var(--ink)]">
            {rows.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>

          {/* Four parts in reading order: covered, progress, additional
              practice, next steps. A hairline separates them; a part with no
              fact behind it is absent rather than empty. */}
          <div className="mt-3 divide-y divide-border">
            {covered.length > 0 ? (
              <div className="py-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("weekly_digest.part_covered")}
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {covered.map((topic) => (
                    <li
                      key={topic}
                      className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-[color:var(--ink)]"
                    >
                      {topic}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {hasMastery ? (
              <div className="py-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("weekly_digest.part_progress")}
                </p>
                <p className="mt-1.5 text-sm text-[color:var(--ink)]">
                  {t("weekly_digest.mastery", { mastered, practicing, weak })}
                </p>
              </div>
            ) : null}

            {hasPractice ? (
              <div className="py-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("weekly_digest.part_practice")}
                </p>
                <ul className="mt-1.5 space-y-1 text-sm text-[color:var(--ink)]">
                  {practiceRows.map((row) => (
                    <li key={row}>{row}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {hasNext ? (
              <div className="space-y-1.5 py-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("weekly_digest.part_next")}
                </p>
                {nextWhen ? (
                  <p className="text-sm text-[color:var(--ink)]">
                    {t("weekly_digest.next_lesson", { when: nextWhen })}
                  </p>
                ) : null}
                {focus.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("weekly_digest.focus")}
                    </p>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {focus.map((item) => (
                        <li
                          key={item}
                          className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-[color:var(--ink)]"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {digest.recaps.length > 0 ? (
            <div className="mt-3 space-y-1">
              <h3 className="text-sm font-medium text-[color:var(--ink)]">
                {t("weekly_digest.recap_title")}
              </h3>
              {digest.recaps.map((recap, index) => (
                <p key={`${index}-${recap.slice(0, 24)}`} className="text-sm text-muted-foreground">
                  “{recap}”
                </p>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{t("weekly_digest.empty")}</p>
      )}

      <div className="mt-3">
        <Button type="button" variant="outline" size="sm" disabled={!hasFacts} onClick={copy}>
          <Copy className="h-4 w-4" aria-hidden="true" />
          {t("weekly_digest.copy")}
        </Button>
      </div>
    </section>
  );
}
