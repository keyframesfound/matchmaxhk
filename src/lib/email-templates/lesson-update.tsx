import * as React from "react";

import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components";

interface LessonUpdateEmailProps {
  /** e.g. "Lesson cancelled" / "New lesson scheduled". */
  heading: string;
  /** One-sentence explanation naming the counterparty action. */
  body: string;
  /** Formatted lesson line, e.g. "Fri 6 Nov, 16:00 · 1 hour". */
  lessonLine: string;
  caseCode?: string;
}

/**
 * #461 addendum Triggers 8-9: the counterparty email for a lesson being
 * scheduled/rescheduled or cancelled by the other side. One template, four
 * event variants — the emitting server fn owns the exact copy in the
 * payload. English only; #542 owns any copy overhaul.
 */
export const LessonUpdateEmail = ({
  heading,
  body,
  lessonLine,
  caseCode,
}: LessonUpdateEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{heading}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{heading}</Heading>
        <Text style={text}>{body}</Text>
        <Text style={lesson}>
          {lessonLine}
          {caseCode ? <span style={code}> · {caseCode}</span> : null}
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          Open your MatchMax dashboard to see the full schedule. Questions? Contact the MatchMax
          team, we're happy to help.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default LessonUpdateEmail;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "20px 25px" };
const h1 = {
  color: "#0f1419",
  fontSize: "22px",
  fontWeight: 700,
  margin: "0 0 12px",
};
const text = { color: "#3c4148", fontSize: "15px", lineHeight: "22px", margin: "0 0 12px" };
const lesson = {
  color: "#0f1419",
  fontSize: "15px",
  fontWeight: 700,
  lineHeight: "22px",
  margin: "0 0 16px",
};
const code = { fontWeight: 400, color: "#5b6470" };
const hr = { borderColor: "#e3ecf6", margin: "16px 0" };
const footer = { color: "#8a94a0", fontSize: "12px", lineHeight: "18px", margin: "0" };
