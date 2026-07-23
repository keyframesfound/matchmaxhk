import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readOnly?: boolean;
  className?: string;
};

export function StarRating({ value, onChange, size = 20, readOnly = false, className }: Props) {
  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const Btn = readOnly ? "span" : "button";
        return (
          <Btn
            key={n}
            type={readOnly ? undefined : "button"}
            onClick={readOnly ? undefined : () => onChange?.(n)}
            aria-label={readOnly ? undefined : `${n} star${n === 1 ? "" : "s"}`}
            className={cn(
              "transition-transform",
              !readOnly && "hover:scale-110 cursor-pointer",
            )}
          >
            <Star
              style={{ width: size, height: size }}
              className={cn(
                filled
                  ? "fill-[color:var(--brand-teal)] text-[color:var(--brand-teal)]"
                  : "text-muted-foreground/40",
              )}
            />
          </Btn>
        );
      })}
    </div>
  );
}
