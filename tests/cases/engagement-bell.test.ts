import { describe, expect, it } from "vitest";

import { bellLabel } from "../../src/features/cases/bell-view";
import { DELIVERY_PLAN, bellLinkFor } from "../../src/features/cases/bus";

const t = (key: string, vars?: Record<string, unknown>) =>
  vars ? `${key}:${JSON.stringify(vars)}` : key;

describe("#726 engagement.saved bell", () => {
  it("labels profile / note / case saves without any saver identity", () => {
    expect(
      bellLabel(
        { event_type: "engagement.saved", payload: { entity_type: "tutor", label: "MM-T003" } },
        t,
      ),
    ).toBe('sor.bell_saved_profile:{"label":"MM-T003"}');
    expect(
      bellLabel(
        {
          event_type: "engagement.saved",
          payload: { entity_type: "material", label: "IB Phys IA" },
        },
        t,
      ),
    ).toBe('sor.bell_saved_note:{"label":"IB Phys IA"}');
    expect(bellLabel({ event_type: "engagement.saved", payload: {} }, t)).toBe(
      "sor.bell_saved_generic",
    );
  });

  it("is in-app only to the listing owner and links to the item", () => {
    expect(DELIVERY_PLAN["engagement.saved"]).toEqual([{ channel: "in_app", role: "recipient" }]);
    expect(bellLinkFor("engagement.saved", { link: "/notes/ib-phys-ia" })).toBe(
      "/notes/ib-phys-ia",
    );
    expect(bellLinkFor("engagement.saved", { link: "https://evil.example" })).toBe("/account");
  });
});
