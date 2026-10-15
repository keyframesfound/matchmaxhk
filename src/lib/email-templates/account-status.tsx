import * as React from "react";

import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components";

interface AccountStatusEmailProps {
  /**
   * One-line status copy built server-side (issue #308): the status change
   * plus the "See the community commitment." pointer. The reporter is never
   * named and the staff note is never included.
   */
  statusLine: string;
}

/**
 * Issue #308 — the single notification email sent when an account's status
 * changes (suspended / banned / restored). One email per change, no
 * reporter identity, no staff note.
 */
export const AccountStatusEmail = ({ statusLine }: AccountStatusEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your MatchMax account status changed</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Account status update</Heading>
        <Text style={text}>{statusLine}</Text>
        <Text style={text}>See the community commitment.</Text>
        <Hr style={hr} />
        <Text style={footer}>Questions? Contact the MatchMax team — we're happy to help.</Text>
      </Container>
    </Body>
  </Html>
);

export default AccountStatusEmail;

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
  margin: "0 0 25px",
};
const hr = { borderColor: "#e5e7eb", margin: "25px 0" };
const footer = { fontSize: "12px", color: "#999999", margin: "0" };
