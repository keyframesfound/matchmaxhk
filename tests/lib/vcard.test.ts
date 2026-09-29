import { describe, expect, it } from "vitest";

import { SOCIAL_NETWORKS, type SocialUrls } from "@/components/business/social-links";
import { buildVCard } from "@/lib/vcard";

const baseOrg = {
  name: "MatchMax Tutoring",
  tagline: "Master your exams",
  description: "1-on-1 tutoring with exam experts",
  contact_email: "hello@matchmax.hk",
  contact_phone: "+852 3000 0000",
  whatsapp_number: "85230000000",
  website_url: "https://matchmax.hk",
};

const noSocials: SocialUrls = {};

function socials(...entries: Array<[string, string]>): SocialUrls {
  return Object.fromEntries(entries);
}

describe("buildVCard", () => {
  it("emits a valid 3.0 vCard frame with FN and ORG", () => {
    const card = buildVCard(baseOrg, noSocials, "https://matchmax.hk/tutors/abc");
    const lines = card.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCARD");
    expect(lines).toContain("VERSION:3.0");
    expect(lines).toContain("FN:MatchMax Tutoring");
    expect(lines).toContain("ORG:MatchMax Tutoring");
    expect(lines[lines.length - 1]).toBe("END:VCARD");
  });

  it("escapes commas, semicolons, backslashes and newlines in values", () => {
    const card = buildVCard(
      { ...baseOrg, name: "Lee, Hon; BSc\\MSc\nPhD" },
      noSocials,
      "https://x",
    );
    expect(card).toContain("FN:Lee\\, Hon\\; BSc\\\\MSc\\nPhD");
  });

  it("truncates the description NOTE to 300 characters", () => {
    const card = buildVCard({ ...baseOrg, description: "x".repeat(500) }, noSocials, "https://x");
    const note = card.split("\r\n").find((line) => line.startsWith("NOTE:"));
    expect(note).toBe(`NOTE:${"x".repeat(300)}`);
  });

  it("omits optional fields when absent", () => {
    const card = buildVCard(
      {
        name: "Solo Tutor",
        tagline: null,
        description: null,
        contact_email: null,
        contact_phone: null,
        whatsapp_number: null,
        website_url: null,
      },
      noSocials,
      "https://x",
    );
    expect(card).not.toContain("TITLE:");
    expect(card).not.toContain("NOTE:");
    expect(card).not.toContain("EMAIL");
    expect(card).not.toContain("TEL");
    expect(card).not.toContain("URL:");
  });

  it("maps contact, whatsapp, and website fields to typed properties", () => {
    const card = buildVCard(baseOrg, noSocials, "https://x");
    expect(card).toContain("EMAIL;TYPE=WORK:hello@matchmax.hk");
    expect(card).toContain("TEL;TYPE=WORK,VOICE:+852 3000 0000");
    expect(card).toContain("TEL;TYPE=CELL:85230000000");
    expect(card).toContain("URL:https://matchmax.hk");
  });

  it("adds X-SOCIALPROFILE lines for provided socials only", () => {
    const first = SOCIAL_NETWORKS[0].id;
    const card = buildVCard(
      baseOrg,
      socials([first, "https://social.example/one"]),
      "https://matchmax.hk/tutors/abc",
    );
    expect(card).toContain(`X-SOCIALPROFILE;TYPE=${first}:https://social.example/one`);
    for (const network of SOCIAL_NETWORKS.slice(1)) {
      expect(card).not.toContain(`X-SOCIALPROFILE;TYPE=${network.id}:`);
    }
    expect(card).toContain("X-SOCIALPROFILE;TYPE=matchmax:https://matchmax.hk/tutors/abc");
  });

  it("always includes the matchmax profile social line", () => {
    const card = buildVCard(baseOrg, noSocials, "https://matchmax.hk/tutors/xyz");
    expect(card).toContain("X-SOCIALPROFILE;TYPE=matchmax:https://matchmax.hk/tutors/xyz");
  });
});
