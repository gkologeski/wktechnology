import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          // Inside a dialog: premium "Sophisticated Canvas" look
          "[[data-dialog-content]_&]:h-11 [[data-dialog-content]_&]:rounded-xl [[data-dialog-content]_&]:bg-muted/60 [[data-dialog-content]_&]:border-border/70 [[data-dialog-content]_&]:px-4 [[data-dialog-content]_&]:text-sm [[data-dialog-content]_&]:shadow-none [[data-dialog-content]_&]:focus-visible:bg-card [[data-dialog-content]_&]:focus-visible:ring-4 [[data-dialog-content]_&]:focus-visible:ring-primary/15 [[data-dialog-content]_&]:focus-visible:border-primary",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
