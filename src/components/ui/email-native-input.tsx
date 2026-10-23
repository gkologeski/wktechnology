import * as React from "react";
import { parseEmailList, validateEmailAddress } from "@/lib/email-address";

export type EmailNativeInputProps = React.ComponentProps<"input"> & { emailShowError?: boolean };

/** type=text evita a validação ASCII do navegador. setCustomValidity preserva
 * a validação real do formulário, inclusive requestSubmit e required. */
export const EmailNativeInput = React.forwardRef<HTMLInputElement, EmailNativeInputProps>(
  ({ emailShowError = true, onChange, onBlur, onInvalid, onInput, ...props }, ref) => {
    const input = React.useRef<HTMLInputElement | null>(null);
    const generatedId = React.useId();
    const id = props.id ?? `email-${generatedId}`;
    const errorId = `${id}-error`;
    const [touched, setTouched] = React.useState(false);
    const [message, setMessage] = React.useState("");
    const sync = (el: HTMLInputElement) => {
      let msg = "";
      if (!el.disabled && !el.readOnly) {
        if (!el.value) msg = el.required ? "E-mail obrigatório." : "";
        else if (el.multiple) {
          try {
            parseEmailList(el.value);
          } catch {
            msg = "A lista contém um e-mail inválido.";
          }
        } else {
          const r = validateEmailAddress(el.value);
          if (!r.ok) msg = r.message;
        }
      }
      el.setCustomValidity(msg);
      setMessage(msg);
    };
    React.useEffect(() => {
      if (input.current) sync(input.current);
    }, [props.value, props.required, props.disabled, props.readOnly, props.multiple]);
    const show = emailShowError && touched && !!message;
    return (
      <>
        <input
          {...props}
          id={id}
          type="text"
          inputMode="email"
          autoComplete={props.autoComplete ?? "email"}
          autoCapitalize="none"
          spellCheck={false}
          pattern={undefined}
          data-email-input="international"
          ref={(el) => {
            input.current = el;
            if (typeof ref === "function") ref(el);
            else if (ref) ref.current = el;
            if (el) sync(el);
          }}
          aria-invalid={show || props["aria-invalid"] || undefined}
          aria-describedby={
            [props["aria-describedby"], show ? errorId : null].filter(Boolean).join(" ") ||
            undefined
          }
          onChange={(e) => {
            sync(e.currentTarget);
            onChange?.(e);
          }}
          onInput={(e) => {
            sync(e.currentTarget);
            onInput?.(e);
          }}
          onBlur={(e) => {
            setTouched(true);
            sync(e.currentTarget);
            onBlur?.(e);
          }}
          onInvalid={(e) => {
            setTouched(true);
            sync(e.currentTarget);
            onInvalid?.(e);
          }}
        />
        {show ? (
          <p id={errorId} role="status" className="text-xs text-destructive">
            {message}
          </p>
        ) : null}
      </>
    );
  },
);
EmailNativeInput.displayName = "EmailNativeInput";
