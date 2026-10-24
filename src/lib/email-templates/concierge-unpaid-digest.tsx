import * as React from "react";

import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components";

interface ConciergeUnpaidDigestEmailProps {
  count: number;
  totalHkd: string;
  lines: string[];
}

/**
 * Issue #205, concierge daily digest of admin fees invoiced more than 3 days
 * ago. Mirrors the in-app unpaid queue (#201): parent, tutor, amount, and the
 * admin-only WhatsApp link. Sent at most once per 24h by the lazy drain.
 */
export const ConciergeUnpaidDigestEmail = ({
  count,
  totalHkd,
  lines,
}: ConciergeUnpaidDigestEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Unpaid admin fees (${count}) past due`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Unpaid admin fees</Heading>
        <Text style={text}>
          {count} fee(s) past due, totalling {totalHkd}. Oldest first:
        </Text>
        {lines.map((line, i) => (
          <Text key={i} style={listLine}>
            • {line}
          </Text>
        ))}
        <Hr style={hr} />
        <Text style={footer}>This digest runs at most once a day, when the desk is opened.</Text>
      </Container>
    </Body>
  </Html>
);

export default ConciergeUnpaidDigestEmail;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "20px 25px" };
const h1 = {
  fontSize: "22px",
  fontWeight: "bold" as const,
  color: "#000000",
  margin: "0 0 20px",
};
const text = {
  fontSize: "14px",
  color: "#55575d",
  lineHeight: "1.5",
  margin: "0 0 10px",
};
const listLine = {
  fontSize: "13px",
  color: "#55575d",
  lineHeight: "1.5",
  margin: "0 0 4px",
};
const hr = { borderColor: "#e5e7eb", margin: "25px 0" };
const footer = { fontSize: "12px", color: "#999999", margin: "0" };
