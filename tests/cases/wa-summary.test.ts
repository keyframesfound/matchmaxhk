import { describe, expect, it } from "vitest";

import {
  buildWaSummary,
  waSummaryTimestamp,
  WA_SUMMARY_MAX_LINES,
} from "../../src/features/cases/wa-summary";

const line = (n: number) => ({ en: `Event ${n}`, zh: `事件 ${n}` });

describe("#671 WhatsApp summary (V1, paste-ready)", () => {
  it("builds a bilingual numbered digest with an HKT header and footer", () => {
    const text = buildWaSummary({
      generatedEn: "7 Nov 2026, 14:30 HKT",
      generatedZh: "2026年11月7日 14:30（香港時間）",
      lines: [
        { en: "Lesson scheduled · 6 Nov, 16:00", zh: "已編排課堂 · 6/11, 16:00" },
        { en: "Rate your lesson with Ms Chan", zh: "為同 Ms Chan 嘅課堂評分" },
      ],
      emptyEn: "No notifications yet",
      emptyZh: "暫無通知",
    });
    expect(text).toContain("📋 MatchMax update — 7 Nov 2026, 14:30 HKT");
    expect(text).toContain("📋 MatchMax 更新 — 2026年11月7日 14:30（香港時間）");
    expect(text).toContain("01. Lesson scheduled · 6 Nov, 16:00\n    已編排課堂 · 6/11, 16:00");
    expect(text).toContain("02. Rate your lesson with Ms Chan\n    為同 Ms Chan 嘅課堂評分");
    expect(text).toContain("MatchMax.hk · V1 desk summary / V1 桌面摘要");
  });

  it("caps the digest and reports the overflow in both languages", () => {
    const lines = Array.from({ length: 14 }, (_, i) => line(i + 1));
    const text = buildWaSummary({
      generatedEn: "x",
      generatedZh: "y",
      lines,
      emptyEn: "",
      emptyZh: "",
    });
    expect(lines.length).toBeGreaterThan(WA_SUMMARY_MAX_LINES);
    expect(text).toContain("10. Event 10");
    expect(text).not.toContain("11. Event 11");
    expect(text).toContain("(+4 more / 另有 4 項)");
  });

  it("renders the empty state in both languages when the inbox is clear", () => {
    const text = buildWaSummary({
      generatedEn: "x",
      generatedZh: "y",
      lines: [],
      emptyEn: "No notifications yet",
      emptyZh: "暫無通知",
    });
    expect(text).toContain("No notifications yet");
    expect(text).toContain("暫無通知");
  });

  it("stamps HKT explicitly (en 'HKT', zh 香港時間) — HKT is UTC+8 with no DST", () => {
    const { en: enStamp, zh: zhStamp } = waSummaryTimestamp(new Date("2026-11-07T06:30:00Z"));
    expect(enStamp).toBe("7 Nov 2026, 14:30 HKT");
    expect(zhStamp).toContain("2026年11月7日");
    expect(zhStamp).toContain("14:30");
    expect(zhStamp).toContain("香港時間");
  });
});
