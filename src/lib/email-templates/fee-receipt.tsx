import * as React from "react";

import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components";

interface FeeReceiptEmailProps {
  caseCode: string;
  amountHkd: string;
  paidAt: string;
}

/**
 * Issue #259, receipt for a paid admin fee: case id, amount and paid time
 * only. No attachment, no phone number (contact details live on the case).
 */
export const FeeReceiptEmail = ({ caseCode, amountHkd, paidAt }: FeeReceiptEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Admin fee received for case {caseCode}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Payment received</Heading>
        <Text style={text}>Case: {caseCode}</Text>
        <Text style={text}>Amount: {amountHkd}</Text>
        <Text style={text}>Marked paid: {paidAt} (Hong Kong time)</Text>
        <Text style={text}>
          This is the MatchMax platform administrative fee for the case. Open the case on your
          dashboard for next steps.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>Questions? Contact the MatchMax team, we're happy to help.</Text>
      </Container>
    </Body>
  </Html>
);

export default FeeReceiptEmail;

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
  margin: "0 0 12px",
};
const hr = { borderColor: "#e5e7eb", margin: "25px 0" };
const footer = { fontSize: "12px", color: "#999999", margin: "0" };
