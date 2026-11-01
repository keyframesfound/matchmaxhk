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

interface ActionRequiredEmailProps {
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  /** "Reminder" resend marker, shown above the heading. */
  reminderOf?: boolean;
}

/**
 * #542 V1 triggers + #561 Action Required: one flexible template for every
 * action-class email (leads, introductions, verification, moderation,
 * admin-appointed tasks and their reminders). The copy module
 * (features/cases/action-email.server.ts) owns the exact bilingual strings;
 * this template only lays them out.
 */
export const ActionRequiredEmail = ({
  heading,
  body,
  ctaLabel,
  ctaUrl,
  reminderOf = false,
}: ActionRequiredEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{heading}</Preview>
    <Body style={main}>
      <Container style={container}>
        {reminderOf ? <Text style={reminder}>Reminder · 提醒</Text> : null}
        <Heading style={h1}>{heading}</Heading>
        <Text style={text}>{body}</Text>
        {ctaUrl ? (
          <Button style={button} href={ctaUrl}>
            {ctaLabel}
          </Button>
        ) : null}
        <Hr style={hr} />
        <Text style={footer}>
          MatchMax · Independent Tutors (獨立導師) · The 1.5-lesson administrative fee applies to
          platform-matched cases.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default ActionRequiredEmail;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "20px 25px" };
const reminder = { color: "#8a94a0", fontSize: "12px", fontWeight: 700, margin: "0 0 6px" };
const h1 = {
  color: "#0f1419",
  fontSize: "22px",
  fontWeight: 700,
  margin: "0 0 12px",
};
const text = { color: "#3c4148", fontSize: "15px", lineHeight: "22px", margin: "0 0 18px" };
const button = {
  backgroundColor: "#1d9bf0",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 700,
  padding: "10px 18px",
  textDecoration: "none",
};
const hr = { borderColor: "#e3ecf6", margin: "18px 0" };
const footer = { color: "#8a94a0", fontSize: "12px", lineHeight: "18px", margin: "0" };
