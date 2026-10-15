import { describe, expect, it } from "vitest";

import {
  ACCOUNT_STATUSES,
  STATUS_CHANGE_REASONS,
  accountStatusBlocksParticipation,
  accountStatusBadgeClass,
  accountStatusLabel,
  canPerformStatusAction,
  statusChangeEmailLine,
} from "../../src/features/admin-users/account-status.shared";

describe("canPerformStatusAction (issue #308 role gates)", () => {
  it("lets staff suspend but never ban or restore", () => {
    expect(canPerformStatusAction(["staff"], "suspend")).toBe(true);
    expect(canPerformStatusAction(["staff"], "ban")).toBe(false);
    expect(canPerformStatusAction(["staff"], "restore")).toBe(false);
  });

  it("lets admins do everything", () => {
    for (const action of ["suspend", "ban", "restore"] as const) {
      expect(canPerformStatusAction(["admin"], action)).toBe(true);
      expect(canPerformStatusAction(["super_admin"], action)).toBe(true);
    }
  });

  it("refuses tutor and parent roles for every action", () => {
    for (const action of ["suspend", "ban", "restore"] as const) {
      expect(canPerformStatusAction(["tutor"], action)).toBe(false);
      expect(canPerformStatusAction(["parent"], action)).toBe(false);
      expect(canPerformStatusAction([], action)).toBe(false);
    }
  });
});

describe("accountStatusBlocksParticipation", () => {
  it("blocks suspended and banned, allows active and unknown", () => {
    expect(accountStatusBlocksParticipation("suspended")).toBe(true);
    expect(accountStatusBlocksParticipation("banned")).toBe(true);
    expect(accountStatusBlocksParticipation("active")).toBe(false);
    expect(accountStatusBlocksParticipation(null)).toBe(false);
    expect(accountStatusBlocksParticipation(undefined)).toBe(false);
  });
});

describe("status labels and badges", () => {
  it("labels the three statuses and defaults to Active", () => {
    expect(accountStatusLabel("active")).toBe("Active");
    expect(accountStatusLabel("suspended")).toBe("Suspended");
    expect(accountStatusLabel("banned")).toBe("Banned");
    expect(accountStatusLabel(null)).toBe("Active");
    expect(accountStatusLabel("garbage")).toBe("Active");
  });

  it("keeps the badge styling shadow-free (borders and backgrounds only)", () => {
    for (const status of ACCOUNT_STATUSES) {
      expect(accountStatusBadgeClass(status)).not.toMatch(/shadow|drop-shadow/);
    }
  });
});

describe("status change email line", () => {
  it("mentions the status and the community commitment, never a reporter", () => {
    expect(statusChangeEmailLine("suspend")).toContain("suspended");
    expect(statusChangeEmailLine("ban")).toContain("banned");
    expect(statusChangeEmailLine("restore")).toContain("restored");
    for (const action of ["suspend", "ban", "restore"] as const) {
      expect(statusChangeEmailLine(action)).toContain("See the community commitment.");
      expect(statusChangeEmailLine(action).toLowerCase()).not.toContain("report");
    }
  });
});

describe("reason list", () => {
  it("is the short list the issue settled on", () => {
    expect([...STATUS_CHANGE_REASONS]).toEqual([
      "contact_details",
      "inappropriate_photo",
      "spam",
      "fake_identity",
      "other",
    ]);
  });
});
