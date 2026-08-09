import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

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
  const lines = [
    "  <url>",
    `    <loc>${escapeXml(`${BASE_URL}${entry.path}`)}</loc>`,
    entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : null,
    entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : null,
    entry.priority ? `    <priority>${entry.priority}</priority>` : null,
    "  </url>",
  ];
  return lines.filter(Boolean).join("\n");
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
          { path: "/become-a-tutor", lastmod: today, changefreq: "monthly", priority: "0.7" },
        ];

        try {
          const tutorEntries = await fetchPublishedTutorEntries();
          entries.push(...tutorEntries);
        } catch {
          // ignore — sitemap still serves core public routes
        }

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
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
