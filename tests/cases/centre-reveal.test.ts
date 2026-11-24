import { describe, expect, it } from "vitest";

import { CAP57_CONFIRM_REQUIRED, assertCentreCap57 } from "../../src/features/cases/centre-reveal";

describe("#815 §2.9 Stage 2 Cap. 57 gate (AC-RV-2)", () => {
  it("blocks a Centre case application without the confirm", () => {
    expect(() => assertCentreCap57("org-1", undefined)).toThrow(CAP57_CONFIRM_REQUIRED);
    expect(() => assertCentreCap57("org-1", false)).toThrow(CAP57_CONFIRM_REQUIRED);
  });
  it("lets a confirmed Centre application and any private case through", () => {
    expect(() => assertCentreCap57("org-1", true)).not.toThrow();
    expect(() => assertCentreCap57(null, undefined)).not.toThrow();
  });
});
