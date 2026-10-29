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
  const locales = ["en", "zh"] as const;
  return locales
    .map((segment) => {
      const alternates = [
        { hreflang: "en", href: `${BASE_URL}/en${entry.path === "/" ? "" : entry.path}` },
        { hreflang: "zh-HK", href: `${BASE_URL}/zh${entry.path === "/" ? "" : entry.path}` },
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

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const today = new Date().toISOString().slice(0, 10);
        const entries: SitemapEntry[] = [
          { path: "/", lastmod: today, changefreq: "weekly", priority: "1.0" },
          { path: "/tutors", lastmod: today, changefreq: "daily", priority: "0.9" },
          { path: "/tutor-requests", lastmod: today, changefreq: "monthly", priority: "0.8" },
          { path: "/guide", lastmod: today, changefreq: "monthly", priority: "0.7" },
          { path: "/guide/parents", lastmod: today, changefreq: "monthly", priority: "0.6" },
          { path: "/guide/tutors", lastmod: today, changefreq: "monthly", priority: "0.6" },
          { path: "/guide/notes", lastmod: today, changefreq: "monthly", priority: "0.6" },
          { path: "/guide/refer", lastmod: today, changefreq: "monthly", priority: "0.5" },
          { path: "/guide/verification", lastmod: today, changefreq: "monthly", priority: "0.5" },
          { path: "/legal/notes-terms", lastmod: today, changefreq: "yearly", priority: "0.4" },
          { path: "/help", lastmod: today, changefreq: "weekly", priority: "0.7" },
          { path: "/join", lastmod: today, changefreq: "monthly", priority: "0.7" },
        ];

        // Issue #500: every published Help article is a real indexable URL.
        // The old /tutor-playbook entry is gone (it 301s to /help now), and
        // draft or external-stub articles stay out of the sitemap.
        for (const article of HELP_ARTICLES) {
          if (article.status !== "published" || article.external) continue;
          entries.push({
            path: `/help/${article.category}/${article.slug}`,
            lastmod: article.updated ?? today,
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
