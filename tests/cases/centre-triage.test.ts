import { describe, expect, it } from "vitest";

import { centreTriageStatus } from "../../src/features/cases/centre-case.functions";
import { parentTriageStatus } from "../../src/lib/cases.functions";

/**
 * Issue #412 E — the triage routing tables. Employment never becomes a case
 * (hard block in the handler); everything flagged lands on compliance_hold;
 * clean independent-services requests flow to the normal `new` desk queue.
 */
describe("centreTriageStatus", () => {
  const base = {
    engagementCategory: "independent_services" as const,
    contractingEntity: "organisation_self" as const,
    adminDutiesRequired: "no" as const,
    replacesVacancy: "no" as const,
  };

  it("routes a clean independent-services request to the desk", () => {
    expect(centreTriageStatus(base)).toBe("new");
  });

  it("holds third-party or unsure engagement categories", () => {
    expect(centreTriageStatus({ ...base, engagementCategory: "third_party" })).toBe(
      "compliance_hold",
    );
    expect(centreTriageStatus({ ...base, engagementCategory: "unsure" })).toBe("compliance_hold");
    expect(centreTriageStatus({ ...base, engagementCategory: "employment" })).toBe(
      "compliance_hold",
    );
  });

  it("holds third-party contracting entities", () => {
    expect(centreTriageStatus({ ...base, contractingEntity: "third_party" })).toBe(
      "compliance_hold",
    );
  });

  it("holds admin/reception duties (yes or unsure)", () => {
    expect(centreTriageStatus({ ...base, adminDutiesRequired: "yes" })).toBe("compliance_hold");
    expect(centreTriageStatus({ ...base, adminDutiesRequired: "unsure" })).toBe("compliance_hold");
  });

  it("holds vacancy replacement", () => {
    expect(centreTriageStatus({ ...base, replacesVacancy: "yes" })).toBe("compliance_hold");
  });
});

describe("parentTriageStatus", () => {
  it("routes a parent engaging for their own child to the desk", () => {
    expect(parentTriageStatus({ engager: "myself_child", nonTutoringDuties: "no" })).toBe("new");
  });

  it("holds third-party engagers", () => {
    expect(parentTriageStatus({ engager: "organisation_third_party", nonTutoringDuties: "no" })).toBe(
      "compliance_hold",
    );
  });

  it("holds non-tutoring household/staff duties", () => {
    expect(parentTriageStatus({ engager: "myself_child", nonTutoringDuties: "yes" })).toBe(
      "compliance_hold",
    );
  });
});
