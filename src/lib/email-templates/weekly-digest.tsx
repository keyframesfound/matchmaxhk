import * as React from "react";

import { Body, Container, Head, Hr, Html, Link, Preview, Text } from "@react-email/components";

/**
 * One case in the weekly digest. The task that emits the digest builds both
 * language arrays and the case URL, so this template owns no case copy.
 */
export interface DigestSection {
  caseCode: string;
  url: string;
  en: string[];
  zh: string[];
}

interface WeeklyDigestEmailProps {
  sections?: DigestSection[];
  /** Injected by sendTemplateEmail for automated_marketing templates. */
  unsubscribeUrl?: string;
}

/**
 * #796 §2.6 (AC-742-4): the weekly learning digest. One block per active case
 * with the week's verified lesson lines in English then 繁體, and a link back
 * to the case. No streaks, score lifts, averages or grade promises: the
 * digest reports what was recorded, nothing more.
 */
export const WeeklyDigestEmail = ({ sections = [], unsubscribeUrl }: WeeklyDigestEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Weekly Learning Digest / 每週學習進度週報</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={wordmark}>MatchMax</Text>
        <Text style={title}>Weekly Learning Digest / 每週學習進度週報</Text>
        {sections.map((section, index) => (
          <React.Fragment key={`${section.caseCode}-${index}`}>
            {index > 0 ? <Hr style={hr} /> : null}
            <Text style={caseLine}>Case {section.caseCode}</Text>
            <ul style={list}>
              {section.en.map((line, i) => (
                <li key={`en-${i}`} style={listItem}>
                  {line}
                </li>
              ))}
            </ul>
            <ul style={list} lang="zh-Hant">
              {section.zh.map((line, i) => (
                <li key={`zh-${i}`} style={listItem}>
                  {line}
                </li>
              ))}
            </ul>
            <Text style={viewLine}>
              <Link href={section.url} style={viewLink}>
                View the case
              </Link>
            </Text>
          </React.Fragment>
        ))}
        <Hr style={hr} />
        {/* #783 AC-717-3: the footer carries both languages, like the body. */}
        <Text style={footer}>
          Issued via MatchMax (matchmax.hk) based on verified lesson records and independent tutor
          assessments.
        </Text>
        <Text style={footer}>
          由 MatchMax（matchmax.hk）根據已核實的課堂記錄及獨立導師評估發出。
        </Text>
        {unsubscribeUrl ? (
          <Text style={footer}>
            <Link href={unsubscribeUrl} style={unsubscribeLink}>
              Unsubscribe from weekly digests
            </Link>
          </Text>
        ) : null}
        {unsubscribeUrl ? (
          <Text style={footer}>
            <Link href={unsubscribeUrl} style={unsubscribeLink}>
              取消訂閱每週摘要
            </Link>
          </Text>
        ) : null}
      </Container>
    </Body>
  </Html>
);

export default WeeklyDigestEmail;

const fontFamily =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const main = { backgroundColor: "#ffffff", fontFamily };
const container = { maxWidth: "600px", padding: "20px 25px" };
const wordmark = {
  color: "#0f1419",
  fontSize: "18px",
  fontWeight: 700,
  lineHeight: "24px",
  margin: "0 0 4px",
};
const title = { color: "#3c4148", fontSize: "14px", lineHeight: "20px", margin: "0 0 20px" };
const caseLine = {
  color: "#0f1419",
  fontSize: "15px",
  fontWeight: 600,
  lineHeight: "22px",
  margin: "0 0 8px",
};
const list = {
  color: "#3c4148",
  fontSize: "14px",
  lineHeight: "21px",
  margin: "0 0 8px",
  paddingLeft: "18px",
};
const listItem = { margin: "0 0 4px" };
const viewLine = { fontSize: "14px", lineHeight: "21px", margin: "0 0 16px" };
const viewLink = { color: "#1a5fb4", textDecoration: "underline" };
const hr = { borderColor: "#e3ecf6", margin: "16px 0" };
const footer = { color: "#8a94a0", fontSize: "12px", lineHeight: "18px", margin: "0 0 8px" };
const unsubscribeLink = { color: "#8a94a0", textDecoration: "underline" };
