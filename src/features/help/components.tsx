import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import type { ReactNode } from "react";

import type { HelpArticle } from "@/features/help/content";
import { supabase } from "@/integrations/supabase/client";

/** Internal link that honours an article's external target, else its article route. */
export function HelpArticleLink({
  article,
  className,
  children,
}: {
  article: HelpArticle;
  className?: string;
  children: ReactNode;
}) {
  if (article.external) {
    return (
      <Link to={article.external} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <Link
      to="/help/$category/$slug"
      params={{ category: article.category, slug: article.slug }}
      className={className}
    >
      {children}
    </Link>
  );
}

/** Shared WhatsApp support line lookup (same source as the floating button). */
export function useSupportWhatsAppHref() {
  const { data: whatsappNumber = "" } = useQuery({
    queryKey: ["settings", "whatsapp_number"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "whatsapp_number")
        .maybeSingle();
      if (error) throw error;
      const value = data?.value;
      return typeof value === "string" ? value.trim() : "";
    },
    staleTime: 5 * 60 * 1000,
  });

  const digits = whatsappNumber.replace(/[^\d]/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent("Hi MatchMax, I need support.")}`;
}

export function slugifyHelpHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function extractTextNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractTextNode).join("");
  if (typeof node === "object" && node && "props" in node) {
    return extractTextNode((node.props as { children?: ReactNode }).children);
  }
  return "";
}

export type HelpTocEntry = { id: string; text: string; level: 2 | 3 };

/** Table-of-contents entries (h2/h3) parsed outside code fences. */
export function extractHelpToc(markdown: string): HelpTocEntry[] {
  const entries: HelpTocEntry[] = [];
  let inFence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (line.trimStart().startsWith("```")) inFence = !inFence;
    if (inFence) continue;
    const match = /^(#{2,3})\s+(.+?)\s*#*$/.exec(line);
    if (!match) continue;
    const text = match[2].replace(/`/g, "");
    entries.push({
      id: slugifyHelpHeading(text),
      text,
      level: match[1].length === 2 ? 2 : 3,
    });
  }
  return entries;
}

/** Article-body markdown renderer with help-centre typography and heading anchors. */
export function HelpMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      components={{
        h2: ({ children: headingChildren }) => (
          <h2
            id={slugifyHelpHeading(extractTextNode(headingChildren))}
            className="scroll-mt-28 pt-8 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl"
          >
            {headingChildren}
          </h2>
        ),
        h3: ({ children: headingChildren }) => (
          <h3
            id={slugifyHelpHeading(extractTextNode(headingChildren))}
            className="scroll-mt-28 pt-6 text-xl font-bold tracking-tight text-foreground"
          >
            {headingChildren}
          </h3>
        ),
        p: ({ children: pChildren }) => (
          <p className="text-base leading-7 text-muted-foreground sm:text-[17px]">{pChildren}</p>
        ),
        strong: ({ children: strongChildren }) => (
          <strong className="font-semibold text-foreground">{strongChildren}</strong>
        ),
        a: ({ children: aChildren, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[color:var(--brand-link)] underline underline-offset-4"
          >
            {aChildren}
          </a>
        ),
        ul: ({ children: ulChildren }) => (
          <ul className="list-disc space-y-3 pl-5 marker:text-[color:var(--brand-link)]">
            {ulChildren}
          </ul>
        ),
        ol: ({ children: olChildren }) => (
          <ol className="list-decimal space-y-3 pl-5 marker:text-[color:var(--brand-link)]">
            {olChildren}
          </ol>
        ),
        li: ({ children: liChildren }) => (
          <li className="pl-1 text-base leading-7 text-muted-foreground">{liChildren}</li>
        ),
        blockquote: ({ children: qChildren }) => (
          <blockquote className="border-l-2 border-border pl-4 text-sm italic leading-7 text-muted-foreground">
            {qChildren}
          </blockquote>
        ),
        hr: () => <hr className="border-border" />,
        img: ({ src, alt }) => (
          <img
            src={typeof src === "string" ? src : undefined}
            alt={alt ?? ""}
            className="overflow-hidden rounded-xl border border-border"
          />
        ),
        code: ({ children: codeChildren }) => (
          <code className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[0.85em] text-foreground">
            {codeChildren}
          </code>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
