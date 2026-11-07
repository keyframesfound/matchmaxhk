import { describe, expect, it } from "vitest";

import {
  homeworkStatus,
  homeworkTextError,
  isAllowedHomeworkLink,
  splitHomework,
  summarizeHomework,
  type HomeworkItem,
} from "../../src/features/cases/homework";

/** Issue #652: homework tracker rules. Due times are instants; HKT is display only. */
const NOW = new Date("2026-11-07T04:00:00Z");
const DUE_LATER = "2026-11-10T10:00:00Z";
const DUE_PAST = "2026-11-05T10:00:00Z";

function item(over: Partial<HomeworkItem> = {}): HomeworkItem {
  return { dueAt: DUE_LATER, submittedAt: null, reviewedAt: null, ...over };
}

describe("homeworkStatus", () => {
  it("is assigned before the due time with no submission", () => {
    expect(homeworkStatus(item(), NOW)).toBe("assigned");
  });

  it("is overdue after the due time with no submission", () => {
    expect(homeworkStatus(item({ dueAt: DUE_PAST }), NOW)).toBe("overdue");
  });

  it("counts a submission exactly at the due time as on time", () => {
    expect(homeworkStatus(item({ submittedAt: DUE_LATER }), NOW)).toBe("submitted_on_time");
  });

  it("marks a submission after the due time as late", () => {
    expect(homeworkStatus(item({ dueAt: DUE_PAST, submittedAt: NOW.toISOString() }), NOW)).toBe(
      "submitted_late",
    );
  });

  it("shows reviewed over every other state", () => {
    expect(homeworkStatus(item({ dueAt: DUE_PAST, reviewedAt: NOW.toISOString() }), NOW)).toBe(
      "reviewed",
    );
  });
});

describe("summarizeHomework", () => {
  it("has no rate until something is submitted or overdue", () => {
    expect(summarizeHomework([], NOW).completionRate).toBeNull();
    expect(summarizeHomework([item()], NOW).completionRate).toBeNull();
  });

  it("rates submitted against submitted plus overdue, ignoring work not yet due", () => {
    const summary = summarizeHomework(
      [
        item(),
        item({ submittedAt: DUE_LATER }),
        item({ dueAt: DUE_PAST, submittedAt: NOW.toISOString() }),
        item({ dueAt: DUE_PAST }),
      ],
      NOW,
    );
    expect(summary).toEqual({
      total: 4,
      submitted: 2,
      onTime: 1,
      late: 1,
      overdue: 1,
      completionRate: 67,
    });
  });

  it("keeps on-time and late counts after review", () => {
    const summary = summarizeHomework(
      [
        item({ submittedAt: DUE_LATER, reviewedAt: DUE_LATER }),
        item({ dueAt: DUE_PAST, submittedAt: NOW.toISOString(), reviewedAt: NOW.toISOString() }),
      ],
      NOW,
    );
    expect(summary).toMatchObject({ onTime: 1, late: 1, overdue: 0, completionRate: 100 });
  });

  it("does not count reviewed work with no submission as submitted or overdue", () => {
    const summary = summarizeHomework([item({ dueAt: DUE_PAST, reviewedAt: DUE_PAST })], NOW);
    expect(summary).toMatchObject({ submitted: 0, overdue: 0, completionRate: null });
  });
});

describe("splitHomework", () => {
  it("puts reviewed work in completed and sorts active by due time", () => {
    const a = { ...item({ dueAt: DUE_LATER }), id: "a" };
    const b = { ...item({ dueAt: DUE_PAST }), id: "b" };
    const c = { ...item({ reviewedAt: DUE_PAST }), id: "c" };
    const { active, completed } = splitHomework([a, b, c], NOW);
    expect(active.map((i) => i.id)).toEqual(["b", "a"]);
    expect(completed.map((i) => i.id)).toEqual(["c"]);
  });
});

describe("isAllowedHomeworkLink", () => {
  it("accepts https links", () => {
    expect(isAllowedHomeworkLink("https://docs.google.com/document/d/abc")).toBe(true);
  });

  it("rejects other schemes and malformed values", () => {
    expect(isAllowedHomeworkLink("http://example.com")).toBe(false);
    expect(isAllowedHomeworkLink("javascript:alert(1)")).toBe(false);
    expect(isAllowedHomeworkLink("not a url")).toBe(false);
  });

  it("rejects direct-contact hosts", () => {
    expect(isAllowedHomeworkLink("https://wa.me/85291234567")).toBe(false);
    expect(isAllowedHomeworkLink("https://api.whatsapp.com/send?phone=1")).toBe(false);
    expect(isAllowedHomeworkLink("https://t.me/someone")).toBe(false);
    expect(isAllowedHomeworkLink("https://www.instagram.com/someone")).toBe(false);
  });
});

describe("homeworkTextError", () => {
  it("passes ordinary homework text", () => {
    expect(homeworkTextError("Past paper 2023 P1, questions 1 to 5")).toBeNull();
  });

  it("flags phone numbers and channels", () => {
    expect(homeworkTextError("whatsapp me on 91234567")).toBe("CONTACT_DETAILS");
  });

  it("does not mistake exam years or IGCSE-style names for contact details", () => {
    expect(homeworkTextError("HKDSE 2019-2023 past papers")).toBeNull();
    expect(homeworkTextError("2020 2022 papers")).toBeNull();
    expect(homeworkTextError("Edexcel IG Maths, 2023 P1")).toBeNull();
    expect(homeworkTextError("pp 120-135, Q1-5")).toBeNull();
  });

  it("still flags a real number, a bare IG handle, an email and a web address", () => {
    expect(homeworkTextError("call 9123 4567")).toBe("CONTACT_DETAILS");
    expect(homeworkTextError("add my IG")).toBe("CONTACT_DETAILS");
    expect(homeworkTextError("send to tutor@example.com")).toBe("CONTACT_DETAILS");
    expect(homeworkTextError("see example.com")).toBe("CONTACT_DETAILS");
  });

  it("ignores empty optional text", () => {
    expect(homeworkTextError(undefined)).toBeNull();
    expect(homeworkTextError("")).toBeNull();
  });
});
