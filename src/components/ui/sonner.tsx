import { Toaster as Sonner } from "sonner";
import { CircleAlert, CircleCheck, CircleX, Info } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      closeButton
      expand={false}
      gap={12}
      icons={{
        error: <CircleX className="h-5 w-5 text-red-600" />,
        info: <Info className="h-5 w-5 text-blue-600" />,
        success: <CircleCheck className="h-5 w-5 text-emerald-600" />,
        warning: <CircleAlert className="h-5 w-5 text-amber-600" />,
      }}
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-lg group-[.toaster]:border-border group-[.toaster]:bg-card group-[.toaster]:px-4 group-[.toaster]:py-3.5 group-[.toaster]:text-popover-foreground group-[.toaster]:shadow-[0_16px_40px_-18px_rgba(4,19,68,0.35)]",
          title:
            "group-[.toast]:text-sm group-[.toast]:font-semibold group-[.toast]:text-[color:var(--ink)]",
          description:
            "group-[.toast]:mt-0.5 group-[.toast]:text-sm group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:h-8 group-[.toast]:rounded-md group-[.toast]:bg-[color:var(--surface-invert)] group-[.toast]:px-3 group-[.toast]:text-xs group-[.toast]:font-semibold group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:h-8 group-[.toast]:rounded-md group-[.toast]:border group-[.toast]:border-border group-[.toast]:bg-card group-[.toast]:px-3 group-[.toast]:text-xs group-[.toast]:font-semibold group-[.toast]:text-[color:var(--ink)]",
          closeButton:
            "group-[.toast]:border-none group-[.toast]:bg-transparent group-[.toast]:text-muted-foreground group-[.toast]:shadow-none hover:group-[.toast]:bg-muted hover:group-[.toast]:text-[color:var(--ink)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
