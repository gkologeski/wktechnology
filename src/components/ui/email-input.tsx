import * as React from "react";
import { Input } from "@/components/ui/input";

export type EmailInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "onChange" | "value"
> & {
  value: string;
  onChange: (value: string) => void;
  showError?: boolean;
};

/** API por string, mesmo contrato internacional do Input type=email. */
export const EmailInput = React.forwardRef<HTMLInputElement, EmailInputProps>(
  ({ value, onChange, showError = true, ...props }, ref) => (
    <Input
      {...props}
      ref={ref}
      type="email"
      value={value ?? ""}
      emailShowError={showError}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
);
EmailInput.displayName = "EmailInput";
