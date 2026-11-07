/**
 * #542 / #561: server-side bilingual copy for action-class emails.
 *
 * In-app labels render client-side from i18n keys; email templates render
 * server-side, so the trigger copy lives here (EN + 繁中, keyed on the
 * recipient profile's locale) and feeds the `action-required` template.
 */

import { bellLinkFor } from "@/features/cases/bus";

type Copy = { heading: string; body: string; ctaLabel: string; ctaUrl: string };

type RoleHint = "tutor" | "parent" | "concierge" | "unknown";

/** Send one action-class email (#561 reminders use this directly). */
export async function sendActionRequiredEmail(
  _db: unknown,
  to: string,
  eventType: string,
  payload: Record<string, unknown>,
  idempotencyKey: string,
  locale = "en",
  opts: { reminder?: boolean } = {},
): Promise<void> {
  const copy = actionEmailCopy(eventType, payload, locale, opts);
  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  await sendTemplateEmail("action-required", to, {
    templateData: { ...copy, reminderOf: opts.reminder === true },
    idempotencyKey,
  });
}

function str(payload: Record<string, unknown>, key: string): string {
  const v = payload[key];
  return typeof v === "string" ? v : "";
}

function linkFor(eventType: string, payload: Record<string, unknown>, role: RoleHint): string {
  const raw = payload.link;
  if (typeof raw === "string" && raw.startsWith("/")) return raw;
  return bellLinkFor(eventType, payload, role === "unknown" ? null : role) ?? "";
}

const MISSING_LABELS: Record<string, { en: string; zh: string }> = {
  subjects: { en: "subjects", zh: "科目" },
  rate: { en: "hourly rate", zh: "時薪" },
  headline: { en: "headline", zh: "個人簡介" },
};

function missingList(payload: Record<string, unknown>, locale: "en" | "zh-HK"): string {
  const missing = Array.isArray(payload.missing) ? (payload.missing as string[]) : [];
  const parts = missing.map(
    (m) => (locale === "en" ? MISSING_LABELS[m]?.en : MISSING_LABELS[m]?.zh) ?? m,
  );
  return parts.join(locale === "en" ? ", " : "、");
}

/** Which side of the event the recipient is on — only affects deep links. */
export function roleHintForEmail(eventType: string): RoleHint {
  if (
    eventType === "case.lead_new" ||
    eventType === "intro.shared_tutor" ||
    eventType === "verification.approved" ||
    eventType === "verification.rejected" ||
    eventType === "material.rejected"
  )
    return "tutor";
  if (eventType.startsWith("intro.shared_parent") || eventType.startsWith("lesson."))
    return "parent";
  return "unknown";
}

/**
 * The exact email copy for one action-class event (#542 §4 copy table,
 * #561 §3F), in the recipient's locale. Falls back to EN for anything the
 * emitter did not supply.
 */
export function actionEmailCopy(
  eventType: string,
  payload: Record<string, unknown>,
  locale: string,
  opts: { reminder?: boolean } = {},
): Copy {
  const zh = locale === "zh-HK" || locale === "zh";
  const role = roleHintForEmail(eventType);
  const ctaUrl = linkFor(eventType, payload, role);
  const prefix = opts.reminder ? (zh ? "提醒：" : "Reminder: ") : "";

  switch (eventType) {
    // #657: no contact details here; the case page holds Apply.
    case "case.match_alert": {
      const subject = str(payload, "subject");
      const level = str(payload, "level");
      const area = str(payload, "area");
      const code = str(payload, "case_code");
      return zh
        ? {
            heading: `${prefix}有新個案配合您的資料`,
            body: `個案 ${code}：${level} ${subject}${area ? `，${area}` : ""}。如合適，請查看詳情並申請。`,
            ctaLabel: "查看個案",
            ctaUrl,
          }
        : {
            heading: `${prefix}A new case matches your profile`,
            body: `Case ${code}: ${level} ${subject}${area ? ` near ${area}` : ""}. Open it to see the details and apply if it fits.`,
            ctaLabel: "View case",
            ctaUrl,
          };
    }
    case "case.already_taken": {
      const code = str(payload, "case_code");
      return zh
        ? {
            heading: `${prefix}個案 ${code} 已配對`,
            body: "您申請的個案已由另一位導師接手。看看其他開放中的個案吧。",
            ctaLabel: "瀏覽其他個案",
            ctaUrl,
          }
        : {
            heading: `${prefix}Case ${code} has been taken`,
            body: "Another tutor was matched to the case you applied for. Have a look at the other open cases.",
            ctaLabel: "Browse open cases",
            ctaUrl,
          };
    }
    case "case.lead_new": {
      const badge = str(payload, "badge");
      const badgeZh = str(payload, "badge_zh");
      const subject = str(payload, "subject");
      return zh
        ? {
            heading: `${prefix}新補習個案配對（${badgeZh}）`,
            body: `一位${badgeZh}正在尋找${str(payload, "curriculum")} ${subject}導師，立即查看詳情。`,
            ctaLabel: "查看個案詳情",
            ctaUrl,
          }
        : {
            heading: `${prefix}New Case Lead (${badge})`,
            body: `A ${badge} requested ${subject} (${str(payload, "curriculum")}) near ${str(payload, "station")}. Tap to view and claim.`,
            ctaLabel: "View Case Lead",
            ctaUrl,
          };
    }
    case "intro.shared_parent": {
      const tutor = str(payload, "tutor_name");
      const target = str(payload, "target_name") || (zh ? "您的個案" : "your case");
      const subject = str(payload, "subject");
      return zh
        ? {
            heading: `${prefix}已為 ${target} 配對導師`,
            body: `獨立導師 ${tutor} 已與您的 ${subject} 個案完成配對，請查看聯絡資料以安排第一堂課。`,
            ctaLabel: "查看聯絡資料",
            ctaUrl,
          }
        : {
            heading: `${prefix}Tutor Introduced for ${target}`,
            body: `Independent tutor ${tutor} has been introduced for your ${subject} case. Check contact details to arrange Lesson 1.`,
            ctaLabel: "View Contact Details",
            ctaUrl,
          };
    }
    case "intro.shared_tutor": {
      const contact = str(payload, "contact_name");
      const badge = str(payload, "badge");
      const badgeZh = str(payload, "badge_zh");
      const subject = str(payload, "subject");
      return zh
        ? {
            heading: `${prefix}個案已成功配對（${badgeZh}）`,
            body: `您已與 ${contact}（${badgeZh}）就 ${subject} 個案完成配對，請盡快聯絡對方確認第一堂時間。`,
            ctaLabel: "打開個案",
            ctaUrl,
          }
        : {
            heading: `${prefix}Case Connected (${badge})`,
            body: `You are now connected with ${contact} (${badge}) for ${subject}. Reach out promptly to confirm Lesson 1.`,
            ctaLabel: "Open Case",
            ctaUrl,
          };
    }
    case "verification.approved":
      return zh
        ? {
            heading: `${prefix}成績認證藍剔已獲批核`,
            body: "您的學歷及成績證明已通過審核，個人導師檔案現已顯示認證徽章。",
            ctaLabel: "查看導師檔案",
            ctaUrl,
          }
        : {
            heading: `${prefix}Verified Score Badge Approved`,
            body: "Your academic transcripts have been verified. The Blue Tick badge is now live on your public tutor profile.",
            ctaLabel: "View Tutor Profile",
            ctaUrl,
          };
    case "verification.rejected": {
      const reason = str(payload, "reason");
      return zh
        ? {
            heading: `${prefix}成績認證需要更新`,
            body: `我們無法核實您的文件（原因：${reason || "未提供"}），請上傳更清晰的版本。`,
            ctaLabel: "重新上傳文件",
            ctaUrl,
          }
        : {
            heading: `${prefix}Verification Update Needed`,
            body: `We could not verify your document (${reason || "reason not given"}). Please upload a clearer copy.`,
            ctaLabel: "Re-upload Document",
            ctaUrl,
          };
    }
    case "material.rejected":
    case "content.rejected": {
      const reason = str(payload, "reason");
      const kind =
        str(payload, "content_type") ||
        (eventType === "material.rejected" ? "material listing" : "content");
      const kindZh =
        str(payload, "content_type_zh") || (eventType === "material.rejected" ? "教材" : "內容");
      return zh
        ? {
            heading: `${prefix}${kindZh}未能發佈`,
            body: `您提交的${kindZh}因包含不雅字眼或違反平台守則而未能發佈，請修改後重新提交。${reason ? `（原因：${reason}）` : ""}`,
            ctaLabel: "修改內容",
            ctaUrl,
          }
        : {
            heading: `${prefix}${kind} Not Published`,
            body: `Your submitted ${kind} was rejected because it contained vulgar language or violated community guidelines. Please edit and resubmit.${reason ? ` (Reason: ${reason})` : ""}`,
            ctaLabel: "Edit Content",
            ctaUrl,
          };
    }
    case "report.filed": {
      const kind = str(payload, "content_type") || "item";
      const kindZh = str(payload, "content_type_zh") || "內容";
      return zh
        ? {
            heading: `${prefix}通知：您的${kindZh}正接受審核`,
            body: "系統收到有關您內容的檢舉，團隊正根據平台守則進行審核。",
            ctaLabel: "查看項目",
            ctaUrl,
          }
        : {
            heading: `${prefix}Notice: Your ${kind} Under Review`,
            body: "A report was submitted regarding your item. Our team is reviewing it against MatchMax guidelines.",
            ctaLabel: "View Item",
            ctaUrl,
          };
    }
    case "action.profile_fields": {
      const missing = missingList(payload, zh ? "zh-HK" : "en");
      return zh
        ? {
            heading: `${prefix}需要您的操作`,
            body: `您的導師檔案仍缺少以下重要資料：${missing}。請補齊以保持檔案完整。`,
            ctaLabel: "更新導師檔案",
            ctaUrl,
          }
        : {
            heading: `${prefix}Action Needed`,
            body: `Your tutor profile is missing: ${missing}. Please complete it so your listing stays strong.`,
            ctaLabel: "Update Tutor Profile",
            ctaUrl,
          };
    }
    case "action.onboarding":
      return zh
        ? {
            heading: `${prefix}完成導師開戶清單`,
            body: "您的導師檔案尚未完成，補齊資料後即可上架接受配對。",
            ctaLabel: "繼續開戶",
            ctaUrl,
          }
        : {
            heading: `${prefix}Complete your tutor onboarding`,
            body: "Your tutor profile is still incomplete. Finish the checklist to go live and receive case leads.",
            ctaLabel: "Continue Onboarding",
            ctaUrl,
          };
    case "action.admin_task":
    default: {
      const title = str(payload, "admin_title") || (zh ? "需要您的操作" : "Action Needed");
      const titleZh = str(payload, "admin_title_zh");
      const bodyText = str(payload, "admin_body") || title;
      const label = zh ? str(payload, "cta_label_zh") : str(payload, "cta_label");
      return {
        heading: prefix + (zh ? titleZh || title : title),
        body: bodyText,
        ctaLabel: label || (zh ? "查看詳情" : "View Details"),
        ctaUrl,
      };
    }
  }
}
