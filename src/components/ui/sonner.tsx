import { Toaster as Sonner } from "sonner";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      closeButton
      expand={false}
      gap={12}
      position="top-center"
      style={{ "--width": "24rem" } as React.CSSProperties}
      icons={{
        success: <CircleCheck className="size-5 shrink-0 text-success" aria-hidden="true" />,
        info: <Info className="size-5 shrink-0 text-foreground" aria-hidden="true" />,
        warning: <TriangleAlert className="size-5 shrink-0 text-warning" aria-hidden="true" />,
        error: <CircleAlert className="size-5 shrink-0 text-destructive" aria-hidden="true" />,
        close: <X className="size-4" aria-hidden="true" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:items-start! group-[.toaster]:gap-3! group-[.toaster]:rounded-lg! group-[.toaster]:bg-background! group-[.toaster]:border-border! group-[.toaster]:p-4! group-[.toaster]:shadow-sm! group-[.toaster]:text-foreground!",
          icon: "group-[.toast]:ml-0! group-[.toast]:mr-0! group-[.toast]:mt-0.5! group-[.toast]:size-5! group-[.toast]:shrink-0!",
          title: "group-[.toast]:text-sm group-[.toast]:font-semibold!",
          description: "group-[.toast]:text-xs group-[.toast]:text-muted-foreground!",
          actionButton:
            "group-[.toast]:h-8 group-[.toast]:rounded-md group-[.toast]:bg-[color:var(--foreground)] group-[.toast]:px-3 group-[.toast]:text-xs group-[.toast]:font-semibold group-[.toast]:text-[color:var(--background)]",
          cancelButton:
            "group-[.toast]:h-8 group-[.toast]:rounded-md group-[.toast]:border group-[.toast]:border-border group-[.toast]:bg-card group-[.toast]:px-3 group-[.toast]:text-xs group-[.toast]:font-semibold group-[.toast]:text-[color:var(--ink)]",
          closeButton:
            "group-[.toast]:left-auto! group-[.toast]:right-3! group-[.toast]:top-3! group-[.toast]:transform-none! group-[.toast]:border-none! group-[.toast]:bg-transparent! group-[.toast]:p-0! group-[.toast]:shadow-none! group-[.toast]:text-muted-foreground! hover:group-[.toast]:bg-transparent! hover:group-[.toast]:text-foreground!",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
