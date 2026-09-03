import { SOCIAL_NETWORKS, type SocialUrls } from "@/components/business/social-links";

type VCardOrg = {
  name: string;
  tagline: string | null;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  whatsapp_number: string | null;
  website_url: string | null;
};

function escapeVCardValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildVCard(org: VCardOrg, socials: SocialUrls, profileUrl: string): string {
  const lines: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVCardValue(org.name)}`,
    `ORG:${escapeVCardValue(org.name)}`,
  ];
  if (org.tagline) lines.push(`TITLE:${escapeVCardValue(org.tagline)}`);
  if (org.description) lines.push(`NOTE:${escapeVCardValue(org.description.slice(0, 300))}`);
  if (org.contact_email) lines.push(`EMAIL;TYPE=WORK:${org.contact_email}`);
  if (org.contact_phone) lines.push(`TEL;TYPE=WORK,VOICE:${org.contact_phone}`);
  if (org.whatsapp_number) lines.push(`TEL;TYPE=CELL:${org.whatsapp_number}`);
  if (org.website_url) lines.push(`URL:${org.website_url}`);
  for (const network of SOCIAL_NETWORKS) {
    const url = socials[network.id];
    if (url) lines.push(`X-SOCIALPROFILE;TYPE=${network.id}:${url}`);
  }
  lines.push(`X-SOCIALPROFILE;TYPE=matchmax:${profileUrl}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

export function downloadVCard(org: VCardOrg, socials: SocialUrls, profileUrl: string): void {
  const blob = new Blob([buildVCard(org, socials, profileUrl)], {
    type: "text/vcard;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${
    org.name
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "business"
  }.vcf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
