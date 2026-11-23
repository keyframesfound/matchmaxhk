import * as React from "react";

import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components";

interface OrderDeliveredEmailProps {
  title: string;
  /** "buyer" or "tutor", the buyer never sees money split lines. */
  variant: "buyer" | "tutor";
  grossHkd?: string;
  netHkd?: string;
}

/**
 * Issue #205, note_order.delivered email. Buyer variant: title + delivery
 * confirmation only. Tutor variant: title, gross, net, and NEVER any buyer
 * name or contact (#205 acceptance: "Note-sold notification has no buyer
 * contact").
 */
export const OrderDeliveredEmail = ({
  title,
  variant,
  grossHkd,
  netHkd,
}: OrderDeliveredEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {variant === "tutor" ? "Material sold, funds in the 72-hour hold" : "Your order is delivered"}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{variant === "tutor" ? "Material sold" : "Order delivered"}</Heading>
        <Text style={text}>
          {variant === "tutor"
            ? `Your material "${title}" sold. Funds are in the 72-hour MatchMax protection hold.`
            : `Your order "${title}" has been delivered. Enjoy!`}
        </Text>
        {variant === "tutor" && grossHkd != null && (
          <Text style={text}>Sale price: {grossHkd}</Text>
        )}
        {/* #784: never name a rate here. The seller keeps 2% under Option A and
            the 20% cashier before it, and the template does not know which. */}
        {variant === "tutor" && netHkd != null && (
          <Text style={text}>Your net after the MatchMax platform fee: {netHkd}</Text>
        )}
        <Hr style={hr} />
        <Text style={footer}>Questions? Contact the MatchMax team, we're happy to help.</Text>
      </Container>
    </Body>
  </Html>
);

export default OrderDeliveredEmail;

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
