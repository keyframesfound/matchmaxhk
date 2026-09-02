import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

type PageContainerProps = ComponentPropsWithoutRef<"div"> & {
  width?: "narrow" | "default" | "wide";
};

const widthClasses = {
  narrow: "max-w-3xl",
  default: "max-w-4xl",
  wide: "max-w-5xl",
};

export function PageContainer({ className, width = "default", ...props }: PageContainerProps) {
  return <div className={cn("mx-auto w-full min-w-0 px-4 sm:px-6", widthClasses[width], className)} {...props} />;
}
