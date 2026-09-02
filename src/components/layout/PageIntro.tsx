import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { PageContainer } from "./PageContainer";

type PageIntroProps = {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  align?: "left" | "center";
  width?: "narrow" | "default" | "wide";
};

export function PageIntro({
  title,
  description,
  eyebrow,
  meta,
  align = "left",
  width = "narrow",
}: PageIntroProps) {
  const centered = align === "center";

  return (
    <section className="border-b border-border py-14 sm:py-20">
      <PageContainer width={width} className={cn(centered && "text-center")}>
        {eyebrow ? <p className="text-sm font-semibold text-[color:var(--brand-link)]">{eyebrow}</p> : null}
        <h1 className={cn("mt-3 text-balance text-4xl font-bold text-foreground sm:text-5xl", !eyebrow && "mt-0")}>{title}</h1>
        {description ? (
          <p
            className={cn(
              "mt-4 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg",
              centered && "mx-auto",
            )}
          >
            {description}
          </p>
        ) : null}
        {meta ? <div className={cn("mt-5 text-sm text-muted-foreground", centered && "mx-auto")}>{meta}</div> : null}
      </PageContainer>
    </section>
  );
}
