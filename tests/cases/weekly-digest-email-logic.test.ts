import { describe, expect, it } from "vitest";

import {
  buildDigestSection,
  selectDigestRecipients,
  type DigestCandidate,
} from "../../src/features/cases/weekly-digest-email-logic";
import {
  composeWeeklyDigest,
  type DigestLabels,
  type WeeklyDigest,
} from "../../src/features/cases/weekly-digest-logic";

/**
 * Issue #796 §2.6 (AC-742-4): the pure half of the Sunday digest email. No
 * network and no database here — only the grouping the send loop relies on and
 * the section payload the `weekly-digest` template renders.
 */
const WEEK_START = "2026-11-15T16:00:00.000Z";
const WEEK_END = "2026-11-22T11:59:59.999Z";

const EN: DigestLabels = {
  header: "MatchMax weekly update",
  case: "Case {{code}}",
  lessons: "Verified lessons: {{n}}",
  hoursWeek: "Hours this week: {{h}}",
  hoursTotal: "Total verified hours: {{h}}",
  recap: "From your tutor",
  homework: "Homework completed: {{n}}",
  mistakes: "Mistakes mastered: {{n}}",
  next: "Next lesson: {{when}}",
  mastery: "Mastered {{mastered}} · Practising {{practicing}} · Weak {{weak}}",
  focus: "Focus areas",
};

const ZH: DigestLabels = {
  header: "MatchMax 每週學習進度",
  case: "個案 {{code}}",
  lessons: "已核實課堂：{{n}} 堂",
  hoursWeek: "本週時數：{{h}} 小時",
  hoursTotal: "累計核實時數：{{h}} 小時",
  recap: "導師摘要",
  homework: "已完成功課：{{n}}",
  mistakes: "已掌握錯題：{{n}}",
  next: "下一堂：{{when}}",
  mastery: "已掌握 {{mastered}} · 操練中 {{practicing}} · 弱項 {{weak}}",
  focus: "重點課題",
};

function digest(over: Partial<WeeklyDigest> = {}): WeeklyDigest {
  return {
    startIso: WEEK_START,
    endIso: WEEK_END,
    lessonsThisWeek: 2,
    hoursThisWeek: 2,
    hoursTotal: 10,
    recaps: [],
    homeworkCompleted: 1,
    mistakesMastered: 0,
    nextLesson: null,
    mastery: { mastered: 3, practicing: 2, weak: 1 },
    focus: [],
    ...over,
  };
}

function candidate(over: Partial<DigestCandidate> = {}): DigestCandidate {
  return {
    caseId: "case-a",
    caseCode: "MX-1001",
    parentId: "parent-1",
    digest: digest(),
    ...over,
  };
}

describe("selectDigestRecipients", () => {
  it("drops a quiet week (null digest) instead of sending an empty digest", () => {
    // A case with no lessons, homework, mastered mistakes or recaps composes
    // to null — the same rule the card renders as "nothing this week".
    const quiet = composeWeeklyDigest({
      now: new Date(WEEK_END),
      lessons: [],
      logs: [],
      homework: [],
      mistakes: [],
    });
    expect(quiet).toBeNull();

    const grouped = selectDigestRecipients([candidate({ digest: quiet })]);
    expect(grouped.size).toBe(0);
  });

  it("groups two active cases of one parent into a single entry, sorted by case code", () => {
    const grouped = selectDigestRecipients([
      candidate({ caseId: "case-b", caseCode: "MX-2002" }),
      candidate({ caseId: "case-a", caseCode: "MX-1001" }),
      candidate({ caseId: "case-c", caseCode: "MX-3003", parentId: "parent-2" }),
    ]);

    expect([...grouped.keys()]).toEqual(["parent-1", "parent-2"]);
    expect(grouped.get("parent-1")?.map((entry) => entry.caseCode)).toEqual(["MX-1001", "MX-2002"]);
    expect(grouped.get("parent-1")?.[0]?.caseId).toBe("case-a");
    expect(grouped.get("parent-2")?.map((entry) => entry.caseCode)).toEqual(["MX-3003"]);
  });

  it("keeps only the active cases of a mixed parent (quiet week still sends the rest)", () => {
    const grouped = selectDigestRecipients([
      candidate({ caseId: "case-quiet", caseCode: "MX-1000", digest: null }),
      candidate({ caseId: "case-a", caseCode: "MX-1001" }),
    ]);

    expect(grouped.get("parent-1")?.map((entry) => entry.caseId)).toEqual(["case-a"]);
  });

  it("skips a case with no parent, since there is no address to send to", () => {
    const grouped = selectDigestRecipients([
      candidate({ caseId: "student-owned", parentId: null }),
      candidate({ caseId: "case-a" }),
    ]);

    expect([...grouped.keys()]).toEqual(["parent-1"]);
    expect(grouped.get("parent-1")?.map((entry) => entry.caseId)).toEqual(["case-a"]);
  });
});

describe("buildDigestSection", () => {
  it("carries both languages, the case code and the case link", () => {
    const section = buildDigestSection({
      digest: digest({ recaps: ["Steadier factorising"] }),
      caseCode: "MX-1042",
      labels: { en: EN, zh: ZH },
    });

    expect(section.caseCode).toBe("MX-1042");
    expect(section.url).toBe("https://matchmax.hk/calendar?case=MX-1042");
    // The email template prints its own "Case <code>" heading, so the section
    // must NOT repeat the WhatsApp block's case line.
    expect(section.en.join("\n")).not.toContain("Case MX-1042");
    expect(section.zh.join("\n")).not.toContain("個案 MX-1042");
    expect(section.en.join("\n")).toContain("Verified lessons: 2");
    expect(section.en.join("\n")).toContain("Steadier factorising");
    expect(section.zh.join("\n")).toContain("已核實課堂：2 堂");
    expect(section.en.at(-1)).toBe(section.url);
    expect(section.zh.at(-1)).toBe(section.url);
  });

  it("scrubs ids, emails and phone numbers out of free text", () => {
    const section = buildDigestSection({
      digest: digest({
        recaps: ["550e8400-e29b-41d4-a716-446655440000 parent@example.com 9123 4567"],
        focus: ["Contact 6123 4567"],
      }),
      caseCode: "MX-1042",
      labels: { en: EN, zh: ZH },
    });

    const lines = [...section.en, ...section.zh].join("\n");
    expect(lines).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i);
    expect(lines).not.toContain("@");
    expect(lines).not.toMatch(/[2-9]\d{3}[\s-]?\d{4}/);
  });
});
