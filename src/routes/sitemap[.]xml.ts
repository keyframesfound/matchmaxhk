import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { HELP_ARTICLES } from "@/features/help/content";

const BASE_URL = "https://matchmax.hk";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

function toLastmod(value?: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return `\u0026amp;`;
      case "<":
        return `\u0026lt;`;
      case ">":
        return `\u0026gt;`;
      case '"':
        return `\u0026quot;`;
      case "'":
        return `\u0026apos;`;
      default:
        return char;
    }
  });
}

function renderUrl(entry: SitemapEntry): string {
  // Locale-prefix structure (2026-10-25): every route exists at /en and /zh,
  // each self-canonical <url> carries hreflang alternates for both plus
  // x-default → English.
  const locales = ["en", "zh", "cn"] as const;
  return locales
    .map((segment) => {
      const alternates = [
        { hreflang: "en", href: `${BASE_URL}/en${entry.path === "/" ? "" : entry.path}` },
        { hreflang: "zh-HK", href: `${BASE_URL}/zh${entry.path === "/" ? "" : entry.path}` },
        { hreflang: "zh-CN", href: `${BASE_URL}/cn${entry.path === "/" ? "" : entry.path}` },
        { hreflang: "x-default", href: `${BASE_URL}/en${entry.path === "/" ? "" : entry.path}` },
      ]
        .map(
          (alt) =>
            `    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${escapeXml(alt.href)}"/>`,
        )
        .join("\n");
      const lines = [
        "  <url>",
        `    <loc>${escapeXml(`${BASE_URL}/${segment}${entry.path === "/" ? "" : entry.path}`)}</loc>`,
        alternates,
        entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : null,
        entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : null,
        entry.priority ? `    <priority>${entry.priority}</priority>` : null,
        "  </url>",
      ];
      return lines.filter(Boolean).join("\n");
    })
    .join("\n");
}

/**
 * Minimal structural type for `digital_materials`, which the generated
 * Supabase types do not cover yet — cast through `unknown` for the same
 * reason as src/features/materials/queries.ts.
 */
type PublishedNoteRow = { slug?: unknown; updated_at?: unknown };

type PublishedNotesQuery = {
  eq: (column: string, value: string) => PublishedNotesQuery;
  not: (column: string, op: string, value: string | null) => PublishedNotesQuery;
  order: (column: string, opts: { ascending: boolean }) => PublishedNotesQuery;
  range: (
    from: number,
    to: number,
  ) => Promise<{
    data: PublishedNoteRow[] | null;
    error?: { message?: string } | null;
  }>;
};

type PublishedNotesTable = {
  from: (table: "digital_materials") => {
    select: (columns: string) => PublishedNotesQuery;
  };
};

async function fetchPublishedTutorEntries(): Promise<SitemapEntry[]> {
  const pageSize = 1000;
  let from = 0;
  const entries: SitemapEntry[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("tutors")
      .select("tutor_code, updated_at")
      .eq("is_published", true)
      .order("tutor_code", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;

    const rows = data ?? [];
    for (const tutor of rows) {
      if (!tutor.tutor_code) continue;
      entries.push({
        path: `/tutors/${tutor.tutor_code}`,
        lastmod: toLastmod(tutor.updated_at),
        changefreq: "weekly",
        priority: "0.6",
      });
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return entries;
}

/**
 * Published notes marketplace: every `digital_materials` row with
 * `status = 'published'` and a slug has a real /notes/{slug} page. RLS on the
 * anon client already limits rows to published materials of visible sellers.
 */
async function fetchPublishedNoteEntries(): Promise<SitemapEntry[]> {
  const pageSize = 1000;
  let from = 0;
  const entries: SitemapEntry[] = [];

  while (true) {
    const { data, error } = await (supabase as unknown as PublishedNotesTable)
      .from("digital_materials")
      .select("slug, updated_at")
      .eq("status", "published")
      .not("slug", "is", null)
      .order("slug", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);

    const rows = data ?? [];
    for (const note of rows) {
      if (typeof note.slug !== "string" || !note.slug) continue;
      entries.push({
        path: `/notes/${note.slug}`,
        lastmod: toLastmod(typeof note.updated_at === "string" ? note.updated_at : null),
        changefreq: "monthly",
        priority: "0.5",
      });
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return entries;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        // `lastmod` is emitted ONLY where a real updated timestamp exists
        // (Help frontmatter, tutors.updated_at, digital_materials.updated_at).
        // Stamping today's date on route entries every request trained Google
        // to ignore the field, so core routes carry no lastmod at all.
        //
        // /tutor-requests is deliberately absent: it sits behind
        // `_authenticated` with `ssr: false`, so a crawler only ever gets a
        // skeleton or a sign-in redirect — 404/soft-404 fuel.
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/tutors", changefreq: "daily", priority: "0.9" },
          { path: "/group-classes", changefreq: "weekly", priority: "0.7" },
          { path: "/guide", changefreq: "monthly", priority: "0.7" },
          { path: "/guide/parents", changefreq: "monthly", priority: "0.6" },
          { path: "/guide/tutors", changefreq: "monthly", priority: "0.6" },
          { path: "/guide/notes", changefreq: "monthly", priority: "0.6" },
          { path: "/guide/refer", changefreq: "monthly", priority: "0.5" },
          { path: "/guide/verification", changefreq: "monthly", priority: "0.5" },
          { path: "/legal/notes-terms", changefreq: "yearly", priority: "0.4" },
          { path: "/tos", changefreq: "yearly", priority: "0.4" },
          { path: "/privacy-policy", changefreq: "yearly", priority: "0.4" },
          { path: "/copyright", changefreq: "yearly", priority: "0.4" },
          { path: "/help", changefreq: "weekly", priority: "0.7" },
          { path: "/join", changefreq: "monthly", priority: "0.7" },
          { path: "/become-a-tutor", changefreq: "monthly", priority: "0.7" },
        ];

        // Issue #500: every published Help article is a real indexable URL.
        // The old /tutor-playbook entry is gone (it 301s to /help now), and
        // draft or external-stub articles stay out of the sitemap.
        for (const article of HELP_ARTICLES) {
          if (article.status !== "published" || article.external) continue;
          entries.push({
            path: `/help/${article.category}/${article.slug}`,
            lastmod: toLastmod(article.updated),
            changefreq: "monthly",
            priority: "0.5",
          });
        }

        try {
          const tutorEntries = await fetchPublishedTutorEntries();
          entries.push(...tutorEntries);
        } catch {
          // ignore, sitemap still serves core public routes
        }

        try {
          const noteEntries = await fetchPublishedNoteEntries();
          entries.push(...noteEntries);
        } catch {
          // ignore, sitemap still serves core public routes
        }

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`,
          ...entries.map(renderUrl),
          `</urlset>`,
          "",
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
