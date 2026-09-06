import { cloneElement, isValidElement, type ReactNode } from "react";

import { Input } from "@/components/base/input/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  label: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function FormField({ label, required, error, hint, className, children }: FormFieldProps) {
  const isInput = isValidElement(children) && children.type === Input;
  const control = isInput
    ? cloneElement(children as React.ReactElement<{ hint?: ReactNode; isInvalid?: boolean }>, {
        hint: error && error !== "Required" ? error : undefined,
        isInvalid: Boolean(error),
      })
    : children;

  return (
    <div className={cn("grid gap-2", className)}>
      <Label className="font-semibold text-foreground">
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
        {error === "Required" ? (
          <span className="ml-2 align-middle text-xs font-medium text-destructive">Required</span>
        ) : null}
      </Label>
      {control}
      {hint ? <p className="text-xs italic leading-relaxed text-muted-foreground">{hint}</p> : null}
      {error && error !== "Required" && !isInput ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
