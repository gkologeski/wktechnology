import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "[[data-dialog-content]_&]:rounded-xl [[data-dialog-content]_&]:bg-muted/60 [[data-dialog-content]_&]:border-border/70 [[data-dialog-content]_&]:p-4 [[data-dialog-content]_&]:text-sm [[data-dialog-content]_&]:shadow-none [[data-dialog-content]_&]:resize-none [[data-dialog-content]_&]:focus-visible:bg-card [[data-dialog-content]_&]:focus-visible:ring-4 [[data-dialog-content]_&]:focus-visible:ring-primary/15 [[data-dialog-content]_&]:focus-visible:border-primary",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
