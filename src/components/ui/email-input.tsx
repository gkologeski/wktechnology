import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isEmail } from "@/lib/validators";

export type EmailInputProps = Omit<React.ComponentProps<typeof Input>, "type" | "onChange" | "value"> & {
  value: string;
  onChange: (v: string) => void;
  /** Show validation message after first blur. Defaults to true. */
  showError?: boolean;
  /** Required for empty-state error. */
  required?: boolean;
};

export const EmailInput = React.forwardRef<HTMLInputElement, EmailInputProps>(
  ({ value, onChange, className, onBlur, showError = true, required, ...rest }, ref) => {
    const [touched, setTouched] = React.useState(false);
    const trimmed = (value ?? "").trim();
    const empty = trimmed.length === 0;
    const invalid = !empty && !isEmail(trimmed);
    const emptyInvalid = required && empty;
    const err = touched && showError && (invalid || emptyInvalid);
    return (
      <div className="space-y-1">
        <Input
          ref={ref}
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value.replace(/\s+/g, ""))}
          onBlur={(e) => { setTouched(true); onBlur?.(e); }}
          aria-invalid={err || undefined}
          className={cn(err && "border-destructive focus-visible:ring-destructive", className)}
          {...rest}
        />
        {err && (
          <p className="text-xs text-destructive">
            {emptyInvalid ? "Email obrigatório" : "Digite um email válido"}
          </p>
        )}
      </div>
    );
  },
);
EmailInput.displayName = "EmailInput";
