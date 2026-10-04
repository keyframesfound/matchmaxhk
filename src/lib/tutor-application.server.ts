import * as React from "react";
import { render } from "@react-email/render";
import { Resend } from "resend";

import type { Json } from "@/integrations/supabase/types";
import { TutorJoinNotificationEmail } from "./email-templates/tutor-join-notification";
import {
  ACCEPTED_FILE_TYPES,
  ACCEPTED_PORTFOLIO_IMAGE_TYPES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  getApplicationPath,
  type TutorApplication,
} from "./tutor-application.schema";
import {
  buildPublicUrl,
  buildR2ApiHeaders,
  buildR2ObjectApiPath,
  getR2Config,
  parseCloudflareError,
  sanitizeFileName,
} from "./r2";
import { getRuntimeEnv } from "./runtime-env";

const RECIPIENT = "matchmaxedu@gmail.com";
const FROM = "MatchMax <noreply@matchmax.hk>";
const ADMIN_REVIEW_URL = "https://matchmax.hk/admin/join-requests";
const APPLICATION_FILE_PREFIX = "tutor-application-files/";

export type StoredApplicationFile = {
  key: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
  source: "achievement" | "transcript" | "profile_photo" | "student_card" | "portfolio_image";
  label: string;
};

export type StoredTutorApplication = {
  id: string;
  status: "pending" | "accepted" | "rejected";
};

function validateAttachmentBytes(
  files: { filename: string; contentType: string; content: string; size: number }[],
): void {
  let total = 0;
  for (const file of files) {
    // Issue #97: Trophy Cabinet photos accept WebP in addition to the standard
    // application file types; everything else keeps the original allowlist.
    const allowed =
      ACCEPTED_FILE_TYPES.includes(file.contentType) ||
      ACCEPTED_PORTFOLIO_IMAGE_TYPES.includes(file.contentType);
    if (!allowed) {
      throw new Error(`Unsupported file type: ${file.filename}`);
    }
    const bytes = Buffer.from(file.content, "base64");
    if (bytes.length === 0 || bytes.length !== file.size) {
      throw new Error(`Invalid file data: ${file.filename}`);
    }
    if (bytes.length > MAX_FILE_BYTES) {
      throw new Error(`File too large: ${file.filename}`);
    }
    total += bytes.length;
  }
  if (total > MAX_TOTAL_BYTES) {
    throw new Error("Attachments exceed the 20 MB total limit.");
  }
}

async function uploadApplicationFile(
  config: ReturnType<typeof getR2Config>,
  file: { filename: string; contentType: string; content: string; size: number },
  meta: {
    source: "achievement" | "transcript" | "profile_photo" | "student_card" | "portfolio_image";
    label: string;
    applicationId: string;
    index: number;
  },
): Promise<StoredApplicationFile> {
  const bytes = Buffer.from(file.content, "base64");
  const safeName = sanitizeFileName(file.filename) || "document";
  const key = `${config.keyPrefix}${Date.now()}-${meta.applicationId}-${meta.index}-${safeName}`;

  const response = await fetch(buildR2ObjectApiPath(config, key), {
    method: "PUT",
    headers: buildR2ApiHeaders(config, file.contentType),
    body: new Blob([new Uint8Array(bytes) as unknown as BlobPart]),
  });
  if (!response.ok) throw new Error(await parseCloudflareError(response));

  return {
    key,
    url: buildPublicUrl(config.publicBaseUrl, key),
    filename: file.filename,
    contentType: file.contentType,
    size: bytes.byteLength,
    source: meta.source,
    label: meta.label,
  };
}

/**
 * Resolves a referral code captured at /join to the referring tutor's id.
 * Invalid or stale codes resolve to NULL — the application must still go
 * through, it just loses the attribution.
 */
async function resolveReferringTutor(
  supabaseAdmin: import("@supabase/supabase-js").SupabaseClient,
  referralCode: string | undefined,
): Promise<string | null> {
  const code = referralCode?.trim();
  if (!code) return null;
  const { data } = await supabaseAdmin
    .from("tutors")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * Persists a tutor application as the system of record:
 * 1. Insert the application row (status=pending) via the service-role client.
 * 2. Upload evidence attachments to R2 and link them on the row.
 * 3. Send a lightweight "new tutor join request" notification email (best
 *    effort — the database row is the record, so email failures must not
 *    fail the submission).
 */
export async function storeTutorApplication(
  data: Omit<TutorApplication, "turnstileToken">,
): Promise<{ id: string }> {
  const attachments = [
    ...data.achievements.flatMap((achievement) =>
      achievement.proof
        ? [{ file: achievement.proof, source: "achievement" as const, label: achievement.title }]
        : [],
    ),
    ...data.academicDocuments.flatMap((document) =>
      document.file
        ? [{ file: document.file, source: "transcript" as const, label: document.curriculum }]
        : [],
    ),
    ...(data.profilePhoto
      ? [{ file: data.profilePhoto, source: "profile_photo" as const, label: "Profile photo" }]
      : []),
    ...(data.studentCard
      ? [{ file: data.studentCard, source: "student_card" as const, label: "Student ID card" }]
      : []),
    // Issue #97: Trophy Cabinet photos go to R2 like the other evidence, tagged
    // portfolio_image so the admin review shows them as public portfolio files.
    ...data.portfolioImages.map((image) => ({
      file: image,
      source: "portfolio_image" as const,
      label: "Trophy cabinet",
    })),
  ];
  validateAttachmentBytes(attachments.map((entry) => entry.file));

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const referredBy = await resolveReferringTutor(supabaseAdmin, data.referralCode);
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("tutor_applications")
    .insert({
      status: "pending",
      data: data as unknown as Json,
      attachment_files: [],
      referred_by: referredBy,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    throw new Error(
      `Could not save your application: ${insertError?.message ?? "unexpected database error"}`,
    );
  }
  const applicationId = inserted.id as string;

  let storedFiles: StoredApplicationFile[] = [];
  if (attachments.length > 0) {
    try {
      const config = getR2Config(APPLICATION_FILE_PREFIX);
      storedFiles = await Promise.all(
        attachments.map((entry, index) =>
          uploadApplicationFile(config, entry.file, {
            source: entry.source,
            label: entry.label,
            applicationId,
            index,
          }),
        ),
      );
      const { error: updateError } = await supabaseAdmin
        .from("tutor_applications")
        .update({ attachment_files: storedFiles as unknown as never })
        .eq("id", applicationId);
      if (updateError) throw new Error(updateError.message);
    } catch (uploadError) {
      // The application data is safely stored; only the evidence files failed.
      // Keep the submission alive and let the team follow up on documents.
      console.error("[tutor-application] attachment upload failed:", uploadError);
    }
  }

  await sendTutorJoinNotification({ data, applicationId, storedFiles });
  return { id: applicationId };
}

async function sendTutorJoinNotification({
  data,
  applicationId,
  storedFiles,
}: {
  data: Omit<TutorApplication, "turnstileToken">;
  applicationId: string;
  storedFiles: StoredApplicationFile[];
}): Promise<void> {
  const apiKey = getRuntimeEnv("RESEND_API_KEY");
  if (!apiKey) {
    console.error("[tutor-application] RESEND_API_KEY missing; notification email skipped");
    return;
  }

  const element = React.createElement(TutorJoinNotificationEmail, {
    applicantName: data.name,
    applicationPath: getApplicationPath(data),
    email: data.email,
    phone: data.phone,
    attachmentCount: storedFiles.length,
    reviewUrl: `${ADMIN_REVIEW_URL}?application=${applicationId}`,
  });
  const html = await render(element);
  const text = [
    `New tutor join request — ${data.name}`,
    `Path: ${getApplicationPath(data)}`,
    `Email: ${data.email}`,
    `Phone: ${data.phone}`,
    `Attachments stored: ${storedFiles.length}`,
    `Review: ${ADMIN_REVIEW_URL}?application=${applicationId}`,
  ].join("\n");

  const { error } = await new Resend(apiKey).emails.send({
    from: FROM,
    to: RECIPIENT,
    subject: `New tutor join request — ${data.name}`,
    html,
    text,
  });

  if (error) {
    console.error("[tutor-application] notification email failed:", error.message);
  }
}
