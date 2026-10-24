import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";

import { getCurriculumPricingLabel, getSortedPricingTiers } from "@/features/tutors/tutor-display";

export type PricingTierRow = {
  curriculum: string;
  rate: number;
};

function formatTiers(tiers: PricingTierRow[]): string {
  const sorted = getSortedPricingTiers(tiers);
  if (sorted.length === 0) return "— (flat hourly rate only)";
  return sorted
    .map((tier) => `${getCurriculumPricingLabel(tier.curriculum)}: HK$${tier.rate}/hr`)
    .join("\n");
}

interface TutorPriceChangeEmailProps {
  displayName: string;
  tutorCode: string;
  previousHourlyRate: number;
  previousTiers: PricingTierRow[];
  newHourlyRate: number;
  newTiers: PricingTierRow[];
  adminUrl: string;
}

/**
 * Issue #110 — admin safety-guardrail notification sent after a tutor saves
 * new rates from their dashboard ("tutor_price_updated"). Mirrors the style
 * of the tutor-join-notification email.
 */
export const TutorPriceChangeEmail = ({
  displayName,
  tutorCode,
  previousHourlyRate,
  previousTiers,
  newHourlyRate,
  newTiers,
  adminUrl,
}: TutorPriceChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Tutor pricing updated — {displayName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Tutor pricing updated</Heading>
        <Text style={intro}>
          {displayName} ({tutorCode}) just saved new rates from their dashboard. This email is only
          a notification — the change is already live on their public profile.
        </Text>
        <Hr style={hr} />
        <Info label="Tutor" value={`${displayName} (${tutorCode})`} />
        <Info label="Previous flat rate" value={`HK$${previousHourlyRate}/hr`} />
        <Info label="Previous curriculum rates" value={formatTiers(previousTiers)} />
        <Info label="New flat rate" value={`HK$${newHourlyRate}/hr`} />
        <Info label="New curriculum rates" value={formatTiers(newTiers)} />
        <Hr style={hr} />
        <Button href={adminUrl} style={button}>
          Open tutor admin
        </Button>
        <Text style={footer}>
          Watch for unreasonable rate hikes — tutors can change prices freely, this email is the
          quality-control trail.
        </Text>
      </Container>
    </Body>
  </Html>
);

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoBlock}>
      <Text style={infoLabel}>{label}</Text>
      <Text style={infoValue}>{value}</Text>
    </div>
  );
}

export default TutorPriceChangeEmail;

const main = { backgroundColor: "#f6f8fb", fontFamily: "Arial, sans-serif" };
const container = { padding: "24px", backgroundColor: "#ffffff" };
const h1 = {
  fontSize: "20px",
  fontWeight: "bold" as const,
  color: "#0b1f3a",
  margin: "0 0 8px",
};
const intro = { fontSize: "13px", color: "#55575d", margin: "0 0 12px" };
const hr = { borderColor: "#e4e8ef", margin: "12px 0" };
const infoBlock = { marginBottom: "10px" };
const infoLabel = {
  fontSize: "11px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "#7a8194",
  margin: "0 0 2px",
};
const infoValue = {
  fontSize: "14px",
  color: "#0b1f3a",
  whiteSpace: "pre-wrap" as const,
  margin: "0",
};
const button = {
  backgroundColor: "#0b1f3a",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: "bold" as const,
  padding: "10px 20px",
  textDecoration: "none",
};
const footer = { fontSize: "12px", color: "#7a8194", margin: "12px 0 0" };
