import {
  BookOpen,
  CalendarClock,
  Compass,
  FileText,
  GraduationCap,
  Handshake,
  LifeBuoy,
  MessageCircle,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Help Centre content registry (issue #115).
 *
 * Articles live as Markdown files with a small frontmatter header in
 * `src/features/help/content/*.md`. Vite inlines them at build time via
 * `import.meta.glob(...?raw)`, so editing/publishing an article is a pure
 * content change with no database involved. Article bodies are written in
 * English (mirroring the Tutor Playbook precedent); UI chrome is i18n'd via
 * the `help.*` locale subtree.
 *
 * Frontmatter fields: title, slug, category, audience (tutor | parent | all),
 * summary, icon, tags, featured, order, status (published | draft), external.
 * - `status: draft` renders the "Guide coming soon" placeholder state.
 * - `external` points the card/listing at an existing page instead of the
 *   article route (e.g. /tutor-playbook, /how-it-works).
 */

export type HelpAudience = "tutor" | "parent" | "all";

export type HelpArticleStatus = "published" | "draft";

/** Existing pages an article listing can point at instead of the article route. */
const HELP_EXTERNAL_ROUTES = [
  "/tutor-playbook",
  "/how-it-works",
  "/tutor-requests",
  "/tutors",
  "/pricing",
] as const;

export type HelpExternalRoute = (typeof HELP_EXTERNAL_ROUTES)[number];

export type HelpArticle = {
  slug: string;
  category: string;
  title: string;
  summary: string;
  audience: HelpAudience;
  icon: string;
  tags: string[];
  featured: boolean;
  order: number;
  status: HelpArticleStatus;
  /** When set, listings link straight to this path instead of the article route. */
  external?: HelpExternalRoute;
  body: string;
};

export type HelpCategory = {
  slug: string;
  name: string;
  blurb: string;
  icon: string;
  audience: Exclude<HelpAudience, "all">;
  order: number;
};

/** Icon names referenced by article/category frontmatter, resolved to lucide components. */
const HELP_ICONS: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  "calendar-clock": CalendarClock,
  compass: Compass,
  "file-text": FileText,
  "graduation-cap": GraduationCap,
  handshake: Handshake,
  "life-buoy": LifeBuoy,
  "message-circle": MessageCircle,
  "shield-check": ShieldCheck,
  wallet: Wallet,
};

export function getHelpIcon(name: string | undefined): LucideIcon {
  return (name && HELP_ICONS[name]) || FileText;
}

/**
 * Minimal frontmatter reader for the flat `key: value` headers used by help
 * articles (strings, numbers, booleans, and inline `[a, b]` string arrays).
 */
function parseFrontmatter(raw: string): {
  data: Record<string, string | string[] | number | boolean>;
  body: string;
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return { data: {}, body: raw };

  const data: Record<string, string | string[] | number | boolean> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!key || !value) continue;

    const arrayMatch = /^\[(.*)\]$/.exec(value);
    if (arrayMatch) {
      data[key] = arrayMatch[1]
        .split(",")
        .map((item) => item.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else if (value === "true" || value === "false") {
      data[key] = value === "true";
    } else if (/^-?\d+$/.test(value)) {
      data[key] = Number.parseInt(value, 10);
    } else {
      data[key] = value.replace(/^["']|["']$/g, "");
    }
  }

  return { data, body: raw.slice(match[0].length) };
}

const contentModules = import.meta.glob("./content/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function toHelpArticle(fileName: string, raw: string): HelpArticle {
  const { data, body } = parseFrontmatter(raw);
  const slug = typeof data.slug === "string" && data.slug ? data.slug : "";
  if (!slug) {
    throw new Error(`Help article ${fileName} is missing a slug in its frontmatter.`);
  }
  return {
    slug,
    category: typeof data.category === "string" ? data.category : "",
    title: typeof data.title === "string" ? data.title : slug,
    summary: typeof data.summary === "string" ? data.summary : "",
    audience: data.audience === "tutor" || data.audience === "all" ? data.audience : "parent",
    icon: typeof data.icon === "string" ? data.icon : "",
    tags: Array.isArray(data.tags) ? data.tags : [],
    featured: data.featured === true,
    order: typeof data.order === "number" ? data.order : 100,
    status: data.status === "published" ? "published" : "draft",
    external: HELP_EXTERNAL_ROUTES.includes(data.external as HelpExternalRoute)
      ? (data.external as HelpExternalRoute)
      : undefined,
    body,
  };
}

export const HELP_ARTICLES: HelpArticle[] = Object.entries(contentModules)
  .map(([fileName, raw]) => toHelpArticle(fileName, raw))
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

const HELP_CATEGORY_LIST: HelpCategory[] = [
  {
    slug: "tutor-guide",
    name: "MatchMax Tutor Handbook",
    blurb: "The must-read guide to communication, scheduling, and teaching excellence.",
    icon: "book-open",
    audience: "tutor",
    order: 1,
  },
  {
    slug: "parent-communication",
    name: "Parent Communication & Etiquette",
    blurb: "Professional first impressions, expectations, and feedback loops.",
    icon: "message-circle",
    audience: "tutor",
    order: 2,
  },
  {
    slug: "scheduling-logistics",
    name: "Scheduling & Lesson Logistics",
    blurb: "Coordinating dates, reschedules, travel, and online setups.",
    icon: "calendar-clock",
    audience: "tutor",
    order: 3,
  },
  {
    slug: "pedagogy-excellence",
    name: "Pedagogy & Classroom Excellence",
    blurb: "Diagnostic trial lessons and pacing for high-stakes exams.",
    icon: "graduation-cap",
    audience: "tutor",
    order: 4,
  },
  {
    slug: "payments-policies",
    name: "Payments, Fees & Policies",
    blurb: "The administrative fee, cancellations, and lesson safety.",
    icon: "wallet",
    audience: "tutor",
    order: 5,
  },
  {
    slug: "parent-getting-started",
    name: "Getting Started",
    blurb: "How matching works, trials, and finding the right tutor.",
    icon: "compass",
    audience: "parent",
    order: 1,
  },
  {
    slug: "parent-payments",
    name: "Payments & Fees",
    blurb: "Payment methods, billing, and the administrative fee.",
    icon: "wallet",
    audience: "parent",
    order: 2,
  },
  {
    slug: "parent-policies",
    name: "Policies & Safety",
    blurb: "Cancellations, tutor verification, and lesson safety.",
    icon: "shield-check",
    audience: "parent",
    order: 3,
  },
  {
    slug: "parent-supporting-learning",
    name: "Supporting Your Child",
    blurb: "Curricula explained and tracking progress over time.",
    icon: "graduation-cap",
    audience: "parent",
    order: 4,
  },
];

export const HELP_CATEGORIES: HelpCategory[] = [...HELP_CATEGORY_LIST].sort(
  (a, b) => a.order - b.order,
);

export function getHelpCategory(slug: string): HelpCategory | undefined {
  return HELP_CATEGORIES.find((category) => category.slug === slug);
}

export function getHelpArticle(category: string, slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.category === category && article.slug === slug);
}

function matchesAudience(article: HelpAudience, selected: HelpAudience): boolean {
  if (selected === "all") return true;
  return article === "all" || article === selected;
}

/** Featured cards for one tab, sorted by article order. */
export function getFeaturedHelpArticles(audience: Exclude<HelpAudience, "all">): HelpArticle[] {
  return HELP_ARTICLES.filter(
    (article) => article.featured && matchesAudience(article.audience, audience),
  );
}

/** Categories (with their articles) for one tab, in display order. */
export function getHelpTopics(audience: Exclude<HelpAudience, "all">): {
  category: HelpCategory;
  articles: HelpArticle[];
}[] {
  return HELP_CATEGORIES.filter((category) => category.audience === audience).map((category) => ({
    category,
    articles: HELP_ARTICLES.filter((article) => article.category === category.slug),
  }));
}

/** Live keyword search across titles, summaries, tags, and category names. */
export function searchHelpArticles(
  query: string,
  audience: Exclude<HelpAudience, "all">,
): HelpArticle[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const categoryNames = new Map(HELP_CATEGORIES.map((c) => [c.slug, c.name.toLowerCase()]));
  return HELP_ARTICLES.filter((article) => {
    if (!matchesAudience(article.audience, audience)) return false;
    const haystack = [
      article.title,
      article.summary,
      article.tags.join(" "),
      categoryNames.get(article.category) ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return needle.split(/\s+/).every((token) => haystack.includes(token));
  });
}
