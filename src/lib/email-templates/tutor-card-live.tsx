import * as React from "react";

import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components";

interface TutorCardLiveEmailProps {
  tutorName: string;
  tutorCode: string;
  cardUrl: string;
}

/**
 * Issue #310 — "Your card is live" email sent when a /join submission
 * publishes the tutor card. One email per submission, no review language.
 */
export const TutorCardLiveEmail = ({ tutorName, tutorCode, cardUrl }: TutorCardLiveEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your MatchMax tutor card is live</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your card is live</Heading>
        <Text style={text}>
          Hi {tutorName}, your MatchMax tutor card is now published and visible to parents.
        </Text>
        <Text style={text}>
          Your tutor code is {tutorCode}. View your card here: {cardUrl}
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          Questions? Contact the MatchMax team — we're happy to help. Remember to activate your
          application on WhatsApp so we can reach you about matching cases.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default TutorCardLiveEmail;

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
