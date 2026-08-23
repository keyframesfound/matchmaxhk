import * as React from "react";
import { render } from "@react-email/render";
import { Resend } from "resend";

import { TutorApplicationEmail } from "./email-templates/tutor-application";
import {
  ACCEPTED_FILE_TYPES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  buildAnswerRows,
  type TutorApplication,
} from "./tutor-application.schema";

const RECIPIENT = "matchmaxedu@gmail.com";
const FROM = "MatchMax <noreply@matchmax.hk>";

export async function sendTutorApplication(data: TutorApplication): Promise<void> {
  let total = 0;
  for (const file of data.attachments) {
    if (!ACCEPTED_FILE_TYPES.includes(file.contentType)) {
      throw new Error(`Unsupported file type: ${file.filename}`);
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`File too large: ${file.filename}`);
    }
    total += file.size;
  }
  if (total > MAX_TOTAL_BYTES) {
    throw new Error("Attachments exceed the 20 MB total limit.");
  }

  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) throw new Error("Email is not configured. Please try again later.");

  const rows = buildAnswerRows(data);
  const element = React.createElement(TutorApplicationEmail, {
    applicantName: data.name,
    rows,
  });
  const html = await render(element);
  const text = rows.map((row) => `${row.label}: ${row.value}`).join("\n\n");

  const { error } = await new Resend(apiKey).emails.send({
    from: FROM,
    to: RECIPIENT,
    subject: `New tutor application — ${data.name}`,
    html,
    text,
    replyTo: data.email,
    attachments: data.attachments.map((file) => ({
      filename: file.filename,
      content: file.content,
    })),
  });

  if (error) throw new Error(`Could not send your application: ${error.message}`);
}
