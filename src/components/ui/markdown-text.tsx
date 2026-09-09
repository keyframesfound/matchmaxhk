import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { cn } from "@/lib/utils";

export function MarkdownText({
  children,
  className,
}: {
  children?: string | null;
  className?: string;
}) {
  if (!children || !children.trim()) return null;
  return (
    <div
      className={cn(
        "text-sm leading-relaxed text-muted-foreground [&_p]:my-2 [&_p]:first:mt-0 [&_p]:last:mb-0",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:first:mt-0 [&_ul]:last:mb-0 [&_li]:leading-relaxed",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkBreaks]}>{children}</ReactMarkdown>
    </div>
  );
}
