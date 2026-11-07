import { describe, expect, it } from "vitest";

import {
  activationMissing,
  activationSchema,
  buildActivationApplication,
  phoneIsValid,
  type ActivationInput,
  type ActivationValues,
} from "../../src/features/tutor-application/activation";
import { buildTutorCardInsert, mappedCardContactError } from "../../src/lib/tutor-card-mapping";

const complete: ActivationValues = {
  statusCode: "full_time",
  institution: "HKU",
  headline: "IBDP 42/45 · HL Economics",
  curricula: ["IB"],
  subjects: ["Economics HL"],
  format: "Both",
  stations: ["Central"],
  onlineRate: 300,
  inpersonRate: 400,
  languages: ["English"],
  gender: "female",
  phone: "",
  capAck: true,
  feeAck: true,
  legalAgreed: true,
};
const input = (over: Partial<ActivationInput> = {}): ActivationInput =>
  ({
    ...complete,
    turnstileToken: "t",
    referralCode: "",
    ...over,
  }) as ActivationInput;
const identity = { email: "a@b.com", displayName: "Ann", phone: "91234567" };

describe("activationMissing: the publish gate", () => {
  it("passes a complete sheet", () => {
    expect(activationMissing(complete, { needsPhone: false })).toEqual([]);
  });

  it("blocks no subjects, a zero rate, and no status", () => {
    const missing = activationMissing(
      { ...complete, subjects: [], onlineRate: 0, statusCode: null },
      { needsPhone: false },
    );
    expect(missing).toEqual(expect.arrayContaining(["subjects", "onlineRate", "status"]));
  });

  it("requires a rate for every selected mode, and stations in person", () => {
    expect(
      activationMissing({ ...complete, inpersonRate: null, stations: [] }, { needsPhone: false }),
    ).toEqual(["inpersonRate", "stations"]);
    expect(
      activationMissing(
        { ...complete, format: "Online", inpersonRate: null, stations: [] },
        { needsPhone: false },
      ),
    ).toEqual([]);
  });

  it("requires languages, gender, both acks, and a phone only when none is on file", () => {
    const missing = activationMissing(
      { ...complete, languages: [], gender: null, capAck: false },
      { needsPhone: true },
    );
    expect(missing).toEqual(["languages", "gender", "phone", "acks"]);
  });
});

describe("activationSchema: the server gate", () => {
  it("accepts a complete sheet", () => {
    expect(activationSchema.safeParse(input()).success).toBe(true);
  });

  it.each([
    ["no subjects", { subjects: [] }],
    ["rate below the floor", { onlineRate: 0 }],
    ["missing mode rate", { inpersonRate: null }],
    ["no stations in person", { stations: [] }],
    ["unticked fee", { feeAck: false }],
    ["unknown status", { statusCode: "full_part_time_tutor" }],
    ["contact details in the headline", { headline: "WhatsApp 91234567" }],
  ])("rejects %s", (_name, over) => {
    expect(activationSchema.safeParse(input(over as Partial<ActivationInput>)).success).toBe(false);
  });
});

describe("buildActivationApplication", () => {
  const card = (over: Partial<ActivationInput> = {}) =>
    buildTutorCardInsert(buildActivationApplication(input(over), identity), "MM-T000");

  it("produces a non-empty public card through the shared mapper", () => {
    const result = card();
    expect(result.subjects).toEqual(["Economics HL"]);
    expect(result.hourly_rate).toBe(300);
    expect(result.tutor_status).toBe("full_time");
    expect(result.languages).toEqual(["English"]);
    expect(result.academic_headline).toBe(complete.headline);
    expect(result.secondary_school).toBeNull();
    expect(mappedCardContactError(result)).toBeNull();
  });

  it("keeps Full-Time and Part-Time as separate codes", () => {
    expect(card({ statusCode: "part_time" }).tutor_status).toBe("part_time");
  });

  it("drops the rate and stations a mode does not use", () => {
    const online = card({ format: "Online", inpersonRate: 400, stations: ["Central"] });
    expect(online.inperson_rate).toBeNull();
    expect(online.stations).toEqual([]);
    expect(online.lesson_mode).toBe("online");
  });

  it("derives teaching levels from the curricula", () => {
    expect(card({ curricula: ["Primary School"] }).target_students).toEqual(["Primary"]);
    expect(card({ curricula: ["Primary School", "DSE"] }).target_students).toEqual([
      "Primary",
      "Secondary",
    ]);
  });
});

describe("phoneIsValid", () => {
  it("counts digits, ignoring formatting", () => {
    expect(phoneIsValid("+852 9123 4567")).toBe(true);
    expect(phoneIsValid("123")).toBe(false);
  });
});
