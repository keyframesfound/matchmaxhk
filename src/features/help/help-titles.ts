import type { SeoLocale } from "@/features/i18n/seo";

/**
 * #824: Help Centre category names and article titles are authored in English
 * in the content registry (frontmatter + HELP_CATEGORY_LIST). The registry is
 * the source of truth for slugs and English copy; this module carries the
 * zh-HK / zh-CN renditions so /zh and /cn never render English chrome, and so
 * /cn never falls back to the Traditional title.
 *
 * Article bodies remain English-only (see content.ts) — only the title and
 * category label are translated here.
 */

/** The two non-English renditions every entry must provide. */
export type HelpLocaleNames = { "zh-HK": string; "zh-CN": string };

/** Category slug → Chinese category label. All 14 registry categories. */
export const HELP_CATEGORY_NAMES: Record<string, HelpLocaleNames> = {
  "account-roles": {
    "zh-HK": "帳戶、角色與檔案",
    "zh-CN": "账户、角色与档案",
  },
  "centre-partners": {
    "zh-HK": "中心與 B2B 合作夥伴",
    "zh-CN": "中心与 B2B 合作伙伴",
  },
  "disputes-community": {
    "zh-HK": "爭議、退款與社群守則",
    "zh-CN": "争议、退款与社区规则",
  },
  "parent-getting-started": {
    "zh-HK": "開始使用",
    "zh-CN": "开始使用",
  },
  "parent-scheduling": {
    "zh-HK": "時間安排與課堂",
    "zh-CN": "时间安排与课程",
  },
  "parent-payments": {
    "zh-HK": "付款與費用",
    "zh-CN": "付款与费用",
  },
  "parent-verification": {
    "zh-HK": "導師認證",
    "zh-CN": "导师认证",
  },
  "parent-safety": {
    "zh-HK": "安全與保護",
    "zh-CN": "安全与保护",
  },
  "parent-support": {
    "zh-HK": "陪伴孩子學習",
    "zh-CN": "陪伴孩子学习",
  },
  "tutor-guide": {
    "zh-HK": "導師手冊",
    "zh-CN": "导师手册",
  },
  "parent-communication": {
    "zh-HK": "家長溝通",
    "zh-CN": "家长沟通",
  },
  "scheduling-logistics": {
    "zh-HK": "時間安排與後勤",
    "zh-CN": "时间安排与后勤",
  },
  "pedagogy-excellence": {
    "zh-HK": "教學方法",
    "zh-CN": "教学方法",
  },
  "payments-policies": {
    "zh-HK": "費用、政策與安全",
    "zh-CN": "费用、政策与安全",
  },
};

/** Article slug → Chinese title. All 31 published articles. */
export const HELP_ARTICLE_TITLES: Record<string, HelpLocaleNames> = {
  "same-account-learning-and-teaching": {
    "zh-HK": "同一個帳戶可以同時做學生／家長和導師嗎？",
    "zh-CN": "同一个账户可以同时作为学生／家长和导师吗？",
  },
  "pause-tutor-listing-keep-account": {
    "zh-HK": "可以暫停導師檔案，同時保留學生／家長帳戶嗎？",
    "zh-CN": "可以暂停导师档案，同时保留学生／家长账户吗？",
  },
  "why-do-i-see-child-profile-options": {
    "zh-HK": "我是自己預約的學生，為甚麼會看到小朋友的選項？",
    "zh-CN": "我是自己预约的学生，为什么会看到孩子的选项？",
  },
  "disputes-refunds-community-rules": {
    "zh-HK": "筆記爭議、退款與社群守則",
    "zh-CN": "笔记争议、退款与社区规则",
  },
  "centre-vs-tutor-accounts": {
    "zh-HK": "中心帳戶與獨立導師帳戶有何分別？",
    "zh-CN": "中心账户与独立导师账户有什么区别？",
  },
  "how-centres-apply": {
    "zh-HK": "我的中心如何申請？",
    "zh-CN": "我的中心如何申请？",
  },
  "partner-centre-fees": {
    "zh-HK": "合作中心的費用如何計算？",
    "zh-CN": "合作中心的费用如何计算？",
  },
  "how-matchmax-matching-works": {
    "zh-HK": "MatchMax 配對流程一覽",
    "zh-CN": "MatchMax 配对流程一览",
  },
  "request-a-tutor-and-get-matched": {
    "zh-HK": "提交導師要求，開始配對",
    "zh-CN": "提交导师需求，开始配对",
  },
  "choose-the-right-tutor-for-your-child": {
    "zh-HK": "為孩子挑選合適的導師",
    "zh-CN": "为孩子挑选合适的导师",
  },
  "prepare-for-your-first-lesson": {
    "zh-HK": "第一堂課前的準備",
    "zh-CN": "第一节课前的准备",
  },
  "reschedule-or-cancel-a-lesson": {
    "zh-HK": "改期或取消課堂",
    "zh-CN": "改期或取消课程",
  },
  "pay-your-tutor-directly-and-billing-cycles": {
    "zh-HK": "直接付款給導師與收費週期",
    "zh-CN": "直接付款给导师与收费周期",
  },
  "understand-zero-parent-commission-and-tutor-admin-fees": {
    "zh-HK": "了解家長零佣金與導師行政費",
    "zh-CN": "了解家长零佣金与导师行政费",
  },
  "how-matchmax-verifies-tutors": {
    "zh-HK": "MatchMax 如何認證導師",
    "zh-CN": "MatchMax 如何认证导师",
  },
  "lesson-safety-and-supervision-guidelines": {
    "zh-HK": "課堂安全與監督指引",
    "zh-CN": "课程安全与监督指引",
  },
  "track-your-childs-progress-lesson-by-lesson": {
    "zh-HK": "逐堂跟進孩子的學習進度",
    "zh-CN": "逐节课跟进孩子的学习进度",
  },
  "compare-ib-dse-igcse-and-a-level-curricula": {
    "zh-HK": "IB、DSE、IGCSE 與 A-Level 課程比較",
    "zh-CN": "IB、DSE、IGCSE 与 A-Level 课程比较",
  },
  "delivery-standards": {
    "zh-HK": "做足準備：授課標準、實務安排與行政",
    "zh-CN": "做足准备：授课标准、实务安排与行政",
  },
  "introduce-yourself-whatsapp": {
    "zh-HK": "第一次 WhatsApp 打招呼與課堂規則",
    "zh-CN": "第一次 WhatsApp 打招呼与课程规则",
  },
  "post-lesson-feedback": {
    "zh-HK": "課後回饋：三點回饋法",
    "zh-CN": "课后反馈：三点反馈法",
  },
  "client-mastery": {
    "zh-HK": "贏得家長信任：建立長期合作關係",
    "zh-CN": "赢得家长信任：建立长期合作关系",
  },
  "coordinate-lesson-dates": {
    "zh-HK": "確認上課日期、改期與導師病假安排",
    "zh-CN": "确认上课日期、改期与导师病假安排",
  },
  "travel-and-online-setups": {
    "zh-HK": "上門、Zoom 與交通安排",
    "zh-CN": "上门、Zoom 与交通安排",
  },
  "first-trial-lesson-diagnostic": {
    "zh-HK": "第一堂是診斷，不是講課",
    "zh-CN": "第一节课是诊断，不是讲课",
  },
  "pacing-exam-prep": {
    "zh-HK": "公開試備考：IB、DSE、A-Level 的課堂節奏",
    "zh-CN": "重要考试备考：IB、DSE、A-Level 的课程节奏",
  },
  "decoding-students": {
    "zh-HK": "讀懂學生：動機、介入與特殊教育需要",
    "zh-CN": "读懂学生：动机、干预与特殊教育需求",
  },
  "lesson-blueprints": {
    "zh-HK": "教學策略、課堂藍本與資源庫",
    "zh-CN": "教学策略、课堂蓝本与资源库",
  },
  "admin-fee-structure": {
    "zh-HK": "1.5 堂行政費與解鎖家長聯絡",
    "zh-CN": "1.5 节课行政费与解锁家长联系",
  },
  "after-lesson-one-fee-and-drop-protection": {
    "zh-HK": "第一堂之後：續課、行政費與 Drop-Protection",
    "zh-CN": "第一节课之后：续课、行政费与 Drop-Protection",
  },
  "safeguarding-and-integrity": {
    "zh-HK": "保護自己與學生：安全、界線與誠信",
    "zh-CN": "保护自己与学生：安全、边界与诚信",
  },
};

function pick(
  names: Record<string, HelpLocaleNames>,
  slug: string,
  fallback: string,
  locale: SeoLocale,
): string {
  if (locale === "en") return fallback;
  const entry = names[slug];
  // Unknown slug (e.g. a draft article added later) keeps the English label
  // rather than rendering a blank heading.
  return entry ? entry[locale] : fallback;
}

/** Localized category label, falling back to the English `name` for en / unknown slugs. */
export function localizedHelpCategoryName(name: string, slug: string, locale: SeoLocale): string {
  return pick(HELP_CATEGORY_NAMES, slug, name, locale);
}

/** Localized article title, falling back to the English `title` for en / unknown slugs. */
export function localizedHelpArticleTitle(title: string, slug: string, locale: SeoLocale): string {
  return pick(HELP_ARTICLE_TITLES, slug, title, locale);
}
