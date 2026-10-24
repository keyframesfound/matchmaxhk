import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

/*
 * The active-tab fill slides between triggers (Arc tabs / bottom-nav
 * pattern) via a shared layoutId pill. The root wrapper mirrors Radix's
 * value — controlled or internal — so triggers know which pill to host.
 */
type TabsState = { active: string | undefined; layoutId: string };

const TabsStateContext = React.createContext<TabsState | null>(null);

const Tabs = ({
  value,
  defaultValue,
  onValueChange,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) => {
  const layoutId = React.useId();
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const active = value ?? internalValue;

  const handleValueChange = (next: string) => {
    onValueChange?.(next);
    setInternalValue(next);
  };

  return (
    <TabsStateContext.Provider value={{ active, layoutId }}>
      <TabsPrimitive.Root
        onValueChange={handleValueChange}
        value={value}
        defaultValue={defaultValue}
        {...props}
      />
    </TabsStateContext.Provider>
  );
};

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, value, children, ...props }, ref) => {
  const state = React.useContext(TabsStateContext);
  const shouldReduceMotion = useReducedMotion();
  const isActive = state?.active === value;

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      value={value}
      className={cn(
        "relative isolate inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed data-[state=active]:text-foreground",
        className,
      )}
      {...props}
    >
      {isActive && state ? (
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 -z-10 rounded-md border border-[color:var(--ink)]/10 bg-[color:var(--surface)]"
          initial={false}
          layoutId={state.layoutId}
          transition={
            shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 }
          }
        />
      ) : null}
      {children}
    </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
