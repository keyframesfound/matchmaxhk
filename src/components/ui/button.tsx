import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-semibold outline-none transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-[color:var(--brand-teal)]/40 focus-visible:ring-offset-2 active:scale-[0.97] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      color: {
        accent: "[--btn:#1FA8B6] [--btn-fg:#fff] [--btn-hover:#168590]",
        amber: "[--btn:#B45309] [--btn-fg:#fff] [--btn-hover:#92400E]",
        blue: "[--btn:#0A245F] [--btn-fg:#fff] [--btn-hover:#041344]",
        destructive:
          "[--btn:var(--destructive)] [--btn-fg:var(--destructive-foreground)] [--btn-hover:color-mix(in_oklab,var(--destructive)_85%,black)]",
        green: "[--btn:#15803D] [--btn-fg:#fff] [--btn-hover:#166534]",
        neutral:
          "[--btn:var(--foreground)] [--btn-fg:var(--background)] [--btn-hover:color-mix(in_oklab,var(--foreground)_85%,black)]",
      },
      shape: {
        default: "",
        pill: "rounded-full!",
        square: "rounded-none!",
      },
      size: {
        xs: "h-7 gap-1.5 rounded-sm px-2.5 text-xs [&_svg]:size-3.5",
        sm: "h-8 gap-1.5 rounded-md px-3 text-xs [&_svg]:size-4",
        default: "h-9 gap-2 rounded-md px-4 py-2 text-sm [&_svg]:size-4",
        lg: "h-10 gap-2 rounded-md px-8 text-[0.95rem] [&_svg]:size-5",
        icon: "h-9 w-9 rounded-md [&_svg]:size-4",
        "icon-sm": "h-8 w-8 rounded-md [&_svg]:size-4",
        "icon-lg": "h-10 w-10 rounded-md [&_svg]:size-5",
      },
      variant: {
        candy:
          "border border-white/25 bg-gradient-to-b from-[var(--btn,var(--brand-teal))] to-[var(--btn-hover,#168590)] text-[var(--btn-fg,#fff)] shadow-md shadow-black/20 ring-1 ring-[color-mix(in_oklab,var(--foreground)_15%,var(--btn,var(--brand-teal)))] hover:from-[var(--btn-hover,#168590)] hover:to-[var(--btn-hover,#168590)] [&_svg]:drop-shadow-sm",
        default:
          "bg-[color:var(--brand-royal)] text-white shadow-sm hover:bg-[color:var(--brand-navy)]",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        ghost:
          "text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-teal)]/10 hover:text-[color:var(--brand-teal)]",
        link: "text-[color:var(--brand-teal)] underline-offset-4 hover:underline",
        outline:
          "border border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)] shadow-sm hover:border-[color:var(--brand-teal)]/40 hover:bg-[color:var(--brand-teal)]/8",
        secondary:
          "bg-[color:var(--brand-teal)]/10 text-[color:var(--brand-navy)] shadow-sm hover:bg-[color:var(--brand-teal)]/20",
        soft: "bg-[color-mix(in_oklab,var(--btn,var(--foreground))_12%,transparent)] text-[var(--btn,var(--foreground))] hover:bg-[color-mix(in_oklab,var(--btn,var(--foreground))_18%,transparent)]",
        solid:
          "bg-[var(--btn,var(--foreground))] text-[var(--btn-fg,var(--background))] shadow-sm hover:bg-[var(--btn-hover,var(--brand-navy))]",
      },
    },
    defaultVariants: {
      shape: "default",
      size: "default",
      variant: "default",
    },
  },
);

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Adds an accessible spinner while preserving the button label and width. */
    loading?: boolean;
    /** Optional content placed before the label. */
    prefix?: ReactNode;
    /** Optional content placed after the label. */
    suffix?: ReactNode;
    /** Enables a deeper press scale for Safari force clicks. */
    forcePress?: boolean;
    ref?: Ref<HTMLButtonElement>;
  };

function Spinner() {
  return (
    <svg aria-hidden="true" className="size-[1em] animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function Button({
  className,
  variant,
  color,
  size,
  shape,
  asChild = false,
  loading = false,
  forcePress = false,
  prefix,
  suffix,
  disabled,
  children,
  ref,
  ...props
}: ButtonProps) {
  const shouldReduceMotion = useReducedMotion();
  const localRef = useRef<HTMLButtonElement>(null);
  const classes = cn(buttonVariants({ className, color, shape, size, variant }));

  useEffect(() => {
    const node = localRef.current;
    if (!(forcePress && node) || shouldReduceMotion) return;

    const forceThreshold = 2;
    const onForce = (event: Event) => {
      const force = (event as Event & { webkitForce?: number }).webkitForce ?? 0;
      node.style.transform = force >= forceThreshold ? "scale(0.94)" : "";
    };
    const reset = () => {
      node.style.transform = "";
    };

    node.addEventListener("webkitmouseforcechanged", onForce);
    node.addEventListener("mouseup", reset);
    node.addEventListener("mouseleave", reset);
    return () => {
      node.removeEventListener("webkitmouseforcechanged", onForce);
      node.removeEventListener("mouseup", reset);
      node.removeEventListener("mouseleave", reset);
    };
  }, [forcePress, shouldReduceMotion]);

  if (asChild) {
    return (
      <Slot className={classes} ref={ref} {...props}>
        {children}
      </Slot>
    );
  }

  const setRefs = (node: HTMLButtonElement | null) => {
    localRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref) {
      (ref as { current: HTMLButtonElement | null }).current = node;
    }
  };

  return (
    <button
      aria-busy={loading || undefined}
      className={classes}
      disabled={disabled || loading}
      ref={setRefs}
      type={props.type ?? "button"}
      {...props}
    >
      <AnimatePresence initial={false}>
        {loading ? (
          <motion.span
            animate={{ marginRight: "0.5rem", opacity: 1, width: "1em" }}
            className="inline-flex shrink-0 items-center justify-center overflow-hidden"
            exit={{ marginRight: 0, opacity: 0, width: 0 }}
            initial={
              shouldReduceMotion
                ? { marginRight: "0.5rem", opacity: 1, width: "1em" }
                : { marginRight: 0, opacity: 0, width: 0 }
            }
            key="spinner"
            transition={
              shouldReduceMotion ? { duration: 0 } : { bounce: 0.1, duration: 0.25, type: "spring" }
            }
          >
            <Spinner />
          </motion.span>
        ) : null}
      </AnimatePresence>
      {prefix}
      {children}
      {suffix}
    </button>
  );
}

export { Button, buttonVariants };
