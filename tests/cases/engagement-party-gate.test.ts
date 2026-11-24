import { describe, expect, it } from "vitest";

import { resolveEngagementPartyRole } from "../../src/features/cases/engagement.functions";
import { canFlagComplianceConcern } from "../../src/features/cases/centre-case.functions";

/**
 * Party gates for the two service-role compliance writes. The DB harness is
 * not available in vitest, so the resolution each handler runs is extracted
 * into the pure tables below; the handler behaviour is exactly "null/false is
 * rejected with Forbidden, a resolved role is allowed".
 */
describe("resolveEngagementPartyRole (#412 F reportEngagementChange)", () => {
  const stranger = {
    isStaff: false,
    isParent: false,
    isMatchedTutor: false,
    isActiveOrgMember: false,
  };

  it("rejects a signed-in user who is no party to the engagement", () => {
    expect(resolveEngagementPartyRole(stranger)).toBeNull();
  });

  it("resolves the parent as the customer", () => {
    expect(resolveEngagementPartyRole({ ...stranger, isParent: true })).toBe("customer");
  });

  it("resolves the matched tutor as the educator", () => {
    expect(resolveEngagementPartyRole({ ...stranger, isMatchedTutor: true })).toBe("tutor");
  });

  it("resolves an active centre member as the customer side", () => {
    expect(resolveEngagementPartyRole({ ...stranger, isActiveOrgMember: true })).toBe("customer");
  });

  it("resolves staff on the desk", () => {
    expect(resolveEngagementPartyRole({ ...stranger, isStaff: true })).toBe("staff");
  });

  it("derives the reported role, so a forged payload role cannot win", () => {
    // The handler writes this value into reported_by_role, never data.role.
    const role = resolveEngagementPartyRole({ ...stranger, isMatchedTutor: true });
    expect(role).toBe("tutor");
    expect(["customer", "staff"]).not.toContain(role);
  });

  it("keeps the parent as customer when they are also an org member", () => {
    expect(
      resolveEngagementPartyRole({ ...stranger, isParent: true, isActiveOrgMember: true }),
    ).toBe("customer");
  });
});

describe("canFlagComplianceConcern (#412 E flagCaseComplianceConcern)", () => {
  const tutor = {
    hasTutorCard: true,
    isCaseParent: false,
    isActiveOrgMember: false,
  };

  it("allows an unrelated tutor with a real tutors row", () => {
    expect(canFlagComplianceConcern(tutor)).toBe(true);
  });

  it("rejects a signed-in account with no tutors row", () => {
    expect(canFlagComplianceConcern({ ...tutor, hasTutorCard: false })).toBe(false);
  });

  it("rejects the case's own parent", () => {
    expect(canFlagComplianceConcern({ ...tutor, isCaseParent: true })).toBe(false);
  });

  it("rejects an active member of the owning organisation", () => {
    expect(canFlagComplianceConcern({ ...tutor, isActiveOrgMember: true })).toBe(false);
  });

  it("rejects a non-tutor non-party account", () => {
    expect(
      canFlagComplianceConcern({
        hasTutorCard: false,
        isCaseParent: false,
        isActiveOrgMember: false,
      }),
    ).toBe(false);
  });
});
