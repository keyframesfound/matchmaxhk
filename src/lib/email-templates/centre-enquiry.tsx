import * as React from "react";

import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components";

interface CentreEnquiryEmailProps {
  orgName: string;
  courseTitle: string;
  enquirerName: string;
  phone: string;
  email?: string;
  message?: string;
  requestedTutor?: string;
  caseCode?: string;
}

/**
 * Issue #815 §2.5: a public course enquiry notifies the centre admins. This
 * is an enquiry, not a paid enrolment, so the copy never mentions payment,
 * tuition or Stripe.
 */
export const CentreEnquiryEmail = ({
  orgName,
  courseTitle,
  enquirerName,
  phone,
  email,
  message,
  requestedTutor,
  caseCode,
}: CentreEnquiryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`New enquiry: ${courseTitle}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New course enquiry</Heading>
        <Text style={text}>Hello {orgName}, a new enquiry arrived for your centre.</Text>
        <Text style={text}>Course: {courseTitle}</Text>
        <Text style={text}>Enquirer: {enquirerName}</Text>
        <Text style={text}>Phone: {phone}</Text>
        {email ? <Text style={text}>Email: {email}</Text> : null}
        {requestedTutor ? <Text style={text}>Requested tutor: {requestedTutor}</Text> : null}
        {message ? (
          <>
            <Hr style={hr} />
            <Text style={text}>{message}</Text>
          </>
        ) : null}
        {caseCode ? <Text style={text}>Case code: {caseCode}</Text> : null}
        <Hr style={hr} />
        <Text style={footer}>
          Reply from your MatchMax workspace. This is an enquiry, not a paid enrolment.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default CentreEnquiryEmail;

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
