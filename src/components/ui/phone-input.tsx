import * as React from "react";
import PhoneInputBase, { type Value } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";
import { isPhone } from "@/lib/validators";

export type PhoneInputProps = {
  value: string | null | undefined;
  onChange: (v: string) => void;
  defaultCountry?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  /** Show validation message after first blur. */
  showError?: boolean;
};

/**
 * International phone input with country picker. Stores E.164 strings.
 * Styled to blend with the shadcn Input look.
 */
export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    { value, onChange, defaultCountry = "BR", required, showError = true, className, id, ...rest },
    _ref,
  ) => {
    const [touched, setTouched] = React.useState(false);
    const v = value ?? "";
    const empty = v.length === 0;
    const invalid = !empty && !isPhone(v);
    const emptyInvalid = required && empty;
    const err = touched && showError && (invalid || emptyInvalid);
    return (
      <div className="space-y-1">
        <div
          className={cn(
            "phone-input-wrapper flex h-9 w-full items-center rounded-md border border-input bg-transparent px-2 text-base shadow-sm focus-within:outline-none focus-within:ring-1 focus-within:ring-ring md:text-sm",
            err && "border-destructive focus-within:ring-destructive",
            className,
          )}
        >
          <PhoneInputBase
            id={id}
            defaultCountry={defaultCountry as never}
            international
            countryCallingCodeEditable={false}
            value={(v || undefined) as Value}
            onChange={(val) => onChange((val as string | undefined) ?? "")}
            onBlur={() => setTouched(true)}
            numberInputProps={{
              className:
                "flex-1 bg-transparent outline-none px-2 placeholder:text-muted-foreground disabled:cursor-not-allowed",
            }}
            {...rest}
          />
        </div>
        {err && (
          <p className="text-xs text-destructive">
            {emptyInvalid ? "Telefone obrigatório" : "Telefone inválido para o país selecionado"}
          </p>
        )}
      </div>
    );
  },
);
PhoneInput.displayName = "PhoneInput";
