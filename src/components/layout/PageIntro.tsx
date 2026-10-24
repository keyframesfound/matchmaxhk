import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { PageContainer } from "./PageContainer";

type PageIntroProps = {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  align?: "left" | "center";
  width?: "narrow" | "default" | "wide";
  /** Tighter vertical padding for form-first pages like /join. */
  dense?: boolean;
};

export function PageIntro({
  title,
  description,
  meta,
  align = "left",
  width = "narrow",
  dense = false,
}: PageIntroProps) {
  const centered = align === "center";

  return (
    <section className={cn("border-b border-border", dense ? "py-6 sm:py-8" : "py-14 sm:py-20")}>
      <PageContainer width={width} className={cn(centered && "text-center")}>
        <h1 className="text-balance text-4xl font-medium text-foreground sm:text-5xl">{title}</h1>
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
        {meta ? (
          <div className={cn("mt-5 text-sm text-muted-foreground", centered && "mx-auto")}>
            {meta}
          </div>
        ) : null}
      </PageContainer>
    </section>
  );
}
