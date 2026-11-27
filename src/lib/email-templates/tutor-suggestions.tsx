import * as React from "react";

import { Body, Container, Head, Hr, Html, Link, Preview, Text } from "@react-email/components";

/** One suggested tutor, built by the sweep from live capacity. */
export interface SuggestedTutor {
  name: string;
  verified: boolean;
  credential: string | null;
  subjects: string[];
  area: string;
  remainingSlots: number;
  rateHkd: number | null;
  reason: string;
  url: string;
}

interface TutorSuggestionsEmailProps {
  parentName?: string;
  subjectLabel?: string;
  tutors?: SuggestedTutor[];
  locale?: "en" | "zh-HK";
  /** Injected by sendTemplateEmail for automated_marketing templates. */
  unsubscribeUrl?: string;
  preferencesUrl?: string;
}

const fee = (rate: number | null, zh: boolean) =>
  rate ? (zh ? ` · 學費：HK$${rate}/小時` : ` · Fee: HK$${rate}/hr`) : "";

/**
 * #717 / #783 §2.3: "3 tutors with open slots". Copy is the #717 locked EN +
 * 繁中 template. Tutors are independent; parents pay a $0 matching fee; the
 * unsubscribe link turns marketing email off in one click.
 */
export const TutorSuggestionsEmail = ({
  parentName = "",
  subjectLabel = "",
  tutors = [],
  locale = "en",
  unsubscribeUrl,
  preferencesUrl = "https://matchmax.hk/settings",
}: TutorSuggestionsEmailProps) => {
  const zh = locale === "zh-HK";
  return (
    <Html lang={zh ? "zh-Hant" : "en"} dir="ltr">
      <Head />
      <Preview>
        {zh
          ? "根據您的搜尋及子女課程篩選 — 家長配對費用全免。"
          : "Handpicked based on your profile — $0 matching fee for parents."}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={wordmark}>MatchMax</Text>
          <Text style={body}>{zh ? `${parentName} 您好：` : `Hi ${parentName},`}</Text>
          <Text style={body}>
            {zh
              ? `根據您對 ${subjectLabel} 的搜尋及個人檔案設定，以下 3 位在 MatchMax 登記的獨立導師目前尚有可預約名額：`
              : `Based on your interest in ${subjectLabel}, we found 3 independent tutors on MatchMax who currently have open student slots:`}
          </Text>
          {tutors.map((tutor, index) => (
            <React.Fragment key={`${tutor.url}-${index}`}>
              <Hr style={hr} />
              <Text style={name}>
                {tutor.name}
                {tutor.verified ? " ✓" : ""}
                {tutor.credential ? ` — ${tutor.credential}` : ""}
              </Text>
              <Text style={line}>
                {zh ? "可補習科目：" : "Tutor for: "}
                {tutor.subjects.join(", ")} · {tutor.area}
              </Text>
              <Text style={line}>
                {zh
                  ? `招生狀態：可預約（尚餘 ${tutor.remainingSlots} 個名額）`
                  : `Status: Available (${tutor.remainingSlots} slot(s) open)`}
                {fee(tutor.rateHkd, zh)}
              </Text>
              <Text style={line}>
                {zh ? "推薦原因：" : "Why suggested: "}
                {tutor.reason}
              </Text>
              <Text style={line}>
                <Link href={tutor.url} style={button}>
                  {zh ? `查看 ${tutor.name} 的個人檔案` : `View ${tutor.name}'s Profile`}
                </Link>
              </Text>
            </React.Fragment>
          ))}
          <Hr style={hr} />
          <Text style={footer}>
            {zh
              ? "我們只會推薦目前確定尚有名額的獨立導師，且絕不會針對您已在補習中的科目發送重複推薦。MatchMax 對家長完全免收任何配對費用（$0 中介費）。"
              : "We only include independent tutors with confirmed current availability, and we never send suggestions for subjects you already have an active match in. As always, Parents pay $0 matching fee on MatchMax."}
          </Text>
          {unsubscribeUrl ? (
            <Text style={footer}>
              {zh ? "不想收到推薦電郵？" : "Prefer fewer emails? "}
              <Link href={unsubscribeUrl} style={muted}>
                {zh ? "按此一鍵取消訂閱導師推薦" : "Unsubscribe from tutor suggestions in 1 click"}
              </Link>
              {zh ? " 或 " : " or "}
              <Link href={preferencesUrl} style={muted}>
                {zh ? "更新您的科目偏好設定" : "update your subject preferences"}
              </Link>
              {zh ? "。" : "."}
            </Text>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
};

export default TutorSuggestionsEmail;

const fontFamily =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const main = { backgroundColor: "#ffffff", fontFamily };
const container = { maxWidth: "600px", padding: "20px 25px" };
const wordmark = { color: "#0f1419", fontSize: "18px", fontWeight: 700, margin: "0 0 12px" };
const body = { color: "#3c4148", fontSize: "14px", lineHeight: "21px", margin: "0 0 12px" };
const name = { color: "#0f1419", fontSize: "15px", fontWeight: 600, margin: "0 0 6px" };
const line = { color: "#3c4148", fontSize: "14px", lineHeight: "21px", margin: "0 0 4px" };
const button = { color: "#1a5fb4", fontWeight: 600, textDecoration: "underline" };
const hr = { borderColor: "#e3ecf6", margin: "16px 0" };
const footer = { color: "#8a94a0", fontSize: "12px", lineHeight: "18px", margin: "0 0 8px" };
const muted = { color: "#8a94a0", textDecoration: "underline" };
