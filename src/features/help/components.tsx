import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, ClipboardCopy, ImageIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "react-i18next";
import { useState, type ReactNode } from "react";

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

/** Label shown above a copy box (parsed from the first line of the fenced block). */
function HelpCopyBox({ label, text }: { label?: string; text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API can be unavailable (permissions/insecure context); still
      // fall back to the legacy path so the button keeps working.
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
      } finally {
        textarea.remove();
      }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="rounded-xl border border-[color:var(--brand-link)]/30 bg-[color:var(--brand-link)]/[0.04]">
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--brand-link)]/20 px-4 py-2">
        <span className="min-w-0 truncate text-[11px] font-bold uppercase tracking-widest text-[color:var(--brand-link)]">
          {label || t("help.copy_box_label")}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--brand-link)]/40 bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-[color:var(--brand-link)]/10"
          aria-label={t("help.copy_button")}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-[color:var(--brand-link)]" aria-hidden="true" />
              {t("help.copied")}
            </>
          ) : (
            <>
              <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />
              {t("help.copy_button")}
            </>
          )}
        </button>
      </div>
      <div className="cursor-pointer px-4 py-3" onClick={copy}>
        <HighlightPlaceholders text={text} />
      </div>
    </div>
  );
}

/** Renders message text with [Placeholder] tokens highlighted in cyan. */
function HighlightPlaceholders({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]\n]+\])/g);
  return (
    <p className="whitespace-pre-wrap text-sm leading-7 text-foreground sm:text-[15px]">
      {parts.map((part, index) =>
        /^\[[^\]\n]+\]$/.test(part) ? (
          <span key={index} className="font-semibold text-[color:var(--brand-link)]">
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </p>
  );
}

/**
 * Styled stand-in for a design-team diagram (issue #150). Authors write a
 * fenced block with info string `diagram`; the first line is the title and
 * the rest describes the requested artwork.
 */
function HelpDiagramPlaceholder({ title, body }: { title: string; body: string }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/50">
      <div className="flex items-center gap-2 border-b border-dashed border-border px-4 py-2.5">
        <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 truncate text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {title || t("help.diagram_label")}
        </span>
      </div>
      <div className="px-4 py-3">
        <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

/** Article-body markdown renderer with help-centre typography and heading anchors. */
export function HelpMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({ children: tableChildren }) => (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              {tableChildren}
            </table>
          </div>
        ),
        thead: ({ children: headChildren }) => (
          <thead className="border-b border-border">{headChildren}</thead>
        ),
        th: ({ children: thChildren }) => (
          <th className="whitespace-nowrap px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {thChildren}
          </th>
        ),
        td: ({ children: tdChildren }) => (
          <td className="border-t border-border px-3 py-2.5 align-top leading-6 text-muted-foreground">
            {tdChildren}
          </td>
        ),
        pre: ({ children: preChildren }) => {
          // Fenced blocks with a `copy` / `diagram` info string render as
          // interactive help-centre widgets; anything else stays a code block.
          const child = Array.isArray(preChildren) ? preChildren[0] : preChildren;
          const raw =
            typeof child === "object" && child && "props" in child
              ? String((child.props as { children?: unknown }).children ?? "")
              : "";
          const className =
            typeof child === "object" && child && "props" in child
              ? String((child.props as { className?: unknown }).className ?? "")
              : "";
          const language = /language-([\w-]+)/.exec(className)?.[1] ?? "";
          const lines = raw.replace(/\n$/, "").split("\n");
          if (language === "copy") {
            const label = lines[0].startsWith("# ") ? lines[0].slice(2).trim() : undefined;
            const text = (label ? lines.slice(1) : lines).join("\n").trim();
            return <HelpCopyBox label={label} text={text} />;
          }
          if (language === "diagram") {
            const title = lines[0].replace(/^#\s*/, "").trim() || "Diagram";
            return <HelpDiagramPlaceholder title={title} body={lines.slice(1).join("\n").trim()} />;
          }
          return (
            <pre className="overflow-x-auto rounded-xl border border-border bg-muted/60 p-4 text-sm leading-6 text-foreground">
              {preChildren}
            </pre>
          );
        },
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
