import * as React from "react";

import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components";

interface FeeReminderEmailProps {
  caseCode: string;
  amountHkd: string;
  dueDate: string;
}

/**
 * Issue #205 (#259: tutor-pays), payer reminder for an unpaid 1.5-lesson admin fee (day 3 and
 * day 7 after invoice). Sent by the lazy bus drain via the fee-reminder
 * template; the payment itself stays concierge-run FPS.
 */
export const FeeReminderEmail = ({ caseCode, amountHkd, dueDate }: FeeReminderEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Admin fee reminder for case {caseCode}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Admin fee reminder</Heading>
        <Text style={text}>
          Case {caseCode} has an outstanding admin fee of {amountHkd}, due {dueDate}.
        </Text>
        <Text style={text}>
          The FPS details and memo are on the case card in your MatchMax dashboard. You can attach a
          payment screenshot there; the case becomes active once the fee is marked paid.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>Questions? Contact the MatchMax team, we're happy to help.</Text>
      </Container>
    </Body>
  </Html>
);

export default FeeReminderEmail;

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
