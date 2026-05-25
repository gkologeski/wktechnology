import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, checked, ...props }, ref) => {
  const isActive = checked === true || checked === "indeterminate";

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      checked={checked}
      style={
        isActive
          ? {
              backgroundColor: "var(--color-primary)",
              borderColor: "var(--color-primary)",
              color: "var(--color-primary-foreground)",
            }
          : {
              backgroundColor: "var(--color-card)",
              borderColor: "var(--color-input)",
              color: "transparent",
            }
      }
      className={cn(
        "grid place-content-center peer h-4 w-4 shrink-0 cursor-pointer rounded-sm border-2 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
        isActive
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-card text-transparent",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="grid place-content-center text-current">
        <Check className="h-4 w-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
