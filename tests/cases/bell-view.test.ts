import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  bellGroup,
  bellIcon,
  bellLabel,
  bellLabelKey,
  type BellTranslate,
} from "../../src/features/cases/bell-view";
import { BELL_EVENT_TYPES } from "../../src/features/cases/bus";

const here = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(here, "../../src/features/i18n/locales");
const en = JSON.parse(readFileSync(path.join(LOCALES_DIR, "en.json"), "utf8")) as Record<
  string,
  Record<string, unknown>
>;
const zh = JSON.parse(readFileSync(path.join(LOCALES_DIR, "zh-HK.json"), "utf8")) as Record<
  string,
  Record<string, unknown>
>;

/** t() backed by the REAL locale files, so tests pin the shipped copy. */
function makeT(locale: Record<string, Record<string, unknown>>): BellTranslate {
  return (key, vars) => {
    const [section, leaf] = key.split(".");
    let s = locale[section]?.[leaf] as string | undefined;
    if (typeof s !== "string") return key;
    for (const [k, v] of Object.entries(vars ?? {})) {
      s = s.replaceAll(`{{${k}}}`, String(v));
    }
    return s;
  };
}

const ten = makeT(en);
const tzh = makeT(zh);

function localeHasKey(locale: Record<string, Record<string, unknown>>, key: string): boolean {
  const [section, leaf] = key.split(".");
  return typeof locale[section]?.[leaf] === "string";
}

describe("#671 bell-view family groups", () => {
  it("routes every family per the issue (Cases · Schedule · Ratings · Account)", () => {
    expect(bellGroup("lesson.scheduled_by_tutor")).toBe("schedule");
    expect(bellGroup("lesson.cancelled_by_parent")).toBe("schedule");
    expect(bellGroup("billing.notice_by_tutor")).toBe("schedule");
    expect(bellGroup("lesson.review_prompt")).toBe("ratings");
    expect(bellGroup("review.published")).toBe("ratings");
    expect(bellGroup("action.onboarding")).toBe("account");
    // request/case + moderation + materials stay under Cases.
    expect(bellGroup("case.match_alert")).toBe("cases");
    expect(bellGroup("verification.approved")).toBe("cases");
    expect(bellGroup("note_order.delivered")).toBe("cases");
    expect(bellGroup("admin_fee.unpaid")).toBe("cases");
  });

  it("gives every bell-visible event a label key that exists in EN and 繁中", () => {
    for (const eventType of BELL_EVENT_TYPES) {
      const key = bellLabelKey({ event_type: eventType, role_hint: "tutor" });
      expect(localeHasKey(en, key), `en missing ${key} (${eventType})`).toBe(true);
      expect(localeHasKey(zh, key), `zh-HK missing ${key} (${eventType})`).toBe(true);
      const parentKey = bellLabelKey({ event_type: eventType, role_hint: "parent" });
      expect(localeHasKey(en, parentKey), `en missing ${parentKey}`).toBe(true);
      expect(localeHasKey(zh, parentKey), `zh-HK missing ${parentKey}`).toBe(true);
    }
  });

  it("gives every bell-visible event an icon", () => {
    for (const eventType of BELL_EVENT_TYPES) {
      // lucide exports are memo-wrapped under vitest (typeof "object").
      expect(bellIcon(eventType), `no icon for ${eventType}`).toBeTruthy();
    }
  });
});

describe("#671 copy samples (EN + 繁中 templates)", () => {
  it("Schedule Updated renders 'Schedule updated on {CaseTitle}' when the payload names the case", () => {
    const item = { event_type: "lesson.scheduled_by_tutor", payload: { case_code: "C-1024" } };
    expect(bellLabel(item, ten)).toBe("Schedule updated on C-1024");
    expect(bellLabel(item, tzh)).toBe("「C-1024」時間表已更新");
  });

  it("falls back to the actor-split static label when no case code is present", () => {
    const item = { event_type: "lesson.scheduled_by_parent", payload: {} };
    expect(bellLabel(item, ten)).toBe("A lesson slot was requested by the parent");
  });

  it("Rating prompt renders 'Rate your lesson with {Tutor}' once the producer supplies a name", () => {
    const item = { event_type: "lesson.review_prompt", payload: { tutor_name: "Ms Chan" } };
    expect(bellLabel(item, ten)).toBe("Rate your lesson with Ms Chan");
    expect(bellLabel(item, tzh)).toBe("為同 Ms Chan 嘅課堂評分");
    // today's producer carries tutor_id only → standing static label.
    const today = { event_type: "lesson.review_prompt", payload: { tutor_id: "t1" } };
    expect(bellLabel(today, ten)).toBe(en.sor.bell_review_prompt);
  });

  it("Statement paid renders '{Name} marked tuition paid for {Month}' when the producer supplies payer + month", () => {
    const item = {
      event_type: "billing.notice_by_tutor",
      payload: { payer_name: "Mr Lam", month: "October 2026" },
    };
    expect(bellLabel(item, ten)).toBe("Mr Lam marked tuition paid for October 2026");
    expect(bellLabel(item, tzh)).toBe("Mr Lam 已將 October 2026 學費標記為已付");
    // current #654 payloads carry heading/body only → standing static label.
    const today = { event_type: "billing.notice_by_tutor", payload: { case_code: "C-1" } };
    expect(bellLabel(today, ten)).toBe(en.sor.bell_billing_notice);
  });

  it("the request-accepted template ships in both locales (renders when the producer fires)", () => {
    expect(en.sor.nf_sample_request_accepted).toBe("{{tutor}} accepted your request");
    expect(zh.sor.nf_sample_request_accepted).toBe("{{tutor}} 已接受你的申請");
  });

  it("unknown/unspecialised events keep their static label", () => {
    const item = { event_type: "case.match_alert", payload: {} };
    expect(bellLabel(item, ten)).toBe(en.sor.bell_case_match);
  });
});
