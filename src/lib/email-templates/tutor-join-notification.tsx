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

interface TutorJoinNotificationEmailProps {
  applicantName: string;
  applicationPath: string;
  email: string;
  phone: string;
  attachmentCount: number;
  reviewUrl: string;
}

export const TutorJoinNotificationEmail = ({
  applicantName,
  applicationPath,
  email,
  phone,
  attachmentCount,
  reviewUrl,
}: TutorJoinNotificationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New tutor join request — {applicantName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New tutor join request</Heading>
        <Text style={intro}>
          A new tutor has joined via the MatchMax tutor application page (/join). The full
          application is waiting in the admin console — this email is only a notification.
        </Text>
        <Hr style={hr} />
        <Info label="Applicant" value={applicantName} />
        <Info label="Application path" value={applicationPath} />
        <Info label="Email" value={email} />
        <Info label="Phone" value={phone} />
        <Info label="Attachments stored" value={String(attachmentCount)} />
        <Hr style={hr} />
        <Button href={reviewUrl} style={button}>
          Review application
        </Button>
        <Text style={footer}>
          Reply directly to the applicant at {email} if you need more information.
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

export default TutorJoinNotificationEmail;

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
