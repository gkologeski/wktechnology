import * as React from "react";
import PhoneInputBase, { type Value } from "react-phone-number-input/max";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";
import {
  E164_SHAPE,
  asCountry,
  formatPhoneDisplay,
  isValidE164,
  normalizePhone,
  phoneErrorMessage,
} from "@/lib/phone/e164";
import { useDefaultPhoneCountry } from "@/lib/phone/phone-country-context";

export type PhoneInputProps = {
  value: string | null | undefined;
  /** Recebe o valor canônico E.164 (ou "" quando vazio). */
  onChange: (v: string) => void;
  /** País para números digitados sem +DDI. Padrão: país do workspace. */
  defaultCountry?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  className?: string;
  /** Mostra a mensagem de validação depois do primeiro blur. */
  showError?: boolean;
  /** Erro vindo do servidor/formulário (tem prioridade). */
  error?: string | null;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  onBlur?: () => void;
  /** Ramal opcional, guardado fora do E.164. */
  extension?: string | null;
  onExtensionChange?: (v: string) => void;
};

/**
 * Campo de telefone único do sistema: seletor de país visível, grava E.164,
 * normaliza colagem ("+55 (11) 9...", "(11) 9...") com o país explícito e
 * nunca reescreve um valor antigo fora do padrão sem o usuário digitar.
 */
export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      value,
      onChange,
      defaultCountry,
      required,
      showError = true,
      className,
      id,
      name,
      placeholder,
      disabled,
      error,
      onBlur,
      extension,
      onExtensionChange,
      ...rest
    },
    ref,
  ) => {
    const ctxCountry = useDefaultPhoneCountry();
    const country = asCountry(defaultCountry) ?? asCountry(ctxCountry) ?? "BR";
    const [touched, setTouched] = React.useState(false);
    const [pasteError, setPasteError] = React.useState<string | null>(null);
    const [selectedCountry, setSelectedCountry] = React.useState<string>(country);
    const autoId = React.useId();
    const inputId = id ?? `phone-${autoId}`;
    const errId = `${inputId}-error`;
    const legacyId = `${inputId}-legacy`;

    const raw = value ?? "";
    // Valor gravado fora do padrão (dado antigo): não é passado ao campo para
    // não ser reinterpretado; o usuário decide redigitar.
    const legacy = raw && !E164_SHAPE.test(raw) ? raw : null;
    const v = legacy ? "" : raw;
    // Sugestão explícita (o usuário confirma) usando o país selecionado.
    const legacyParsed = legacy ? normalizePhone(legacy, { defaultCountry: country }) : null;
    const legacySuggestion = legacyParsed?.status === "valid" ? legacyParsed : null;
    const empty = v.length === 0;
    const invalid = !empty && !isValidE164(v);
    const emptyInvalid = !!required && empty && !legacy;
    const localErr =
      pasteError ??
      (invalid
        ? v.replace(/\D/g, "").length < 8
          ? phoneErrorMessage("too_short")
          : phoneErrorMessage("invalid")
        : emptyInvalid
          ? "Telefone obrigatório."
          : null);
    const shownErr = error || (touched && showError ? localErr : null);

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData("text");
      if (!text) return;
      const r = normalizePhone(text, { defaultCountry: selectedCountry });
      e.preventDefault();
      setTouched(true);
      if (r.status === "valid") {
        setPasteError(null);
        if (r.country) setSelectedCountry(r.country);
        onChange(r.e164);
        if (r.extension && onExtensionChange) onExtensionChange(r.extension);
      } else if (r.status === "invalid") {
        setPasteError(phoneErrorMessage(r.reason));
      }
    };

    const describedBy = [
      rest["aria-describedby"],
      shownErr ? errId : null,
      legacy ? legacyId : null,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="space-y-1">
        <div className="flex items-stretch gap-2">
          <div
            className={cn(
              "phone-input-wrapper flex h-9 min-w-0 flex-1 items-center rounded-md border border-input bg-transparent px-2 text-base shadow-sm focus-within:outline-none focus-within:ring-1 focus-within:ring-ring md:text-sm",
              shownErr && "border-destructive focus-within:ring-destructive",
              disabled && "opacity-50",
              className,
            )}
          >
            <PhoneInputBase
              id={inputId}
              name={name}
              defaultCountry={country as never}
              onCountryChange={(c) => c && setSelectedCountry(c)}
              international
              countryCallingCodeEditable={false}
              countrySelectProps={{ "aria-label": "País do telefone" }}
              value={(v || undefined) as Value}
              onChange={(val) => {
                setPasteError(null);
                onChange((val as string | undefined) ?? "");
              }}
              onBlur={() => {
                setTouched(true);
                onBlur?.();
              }}
              disabled={disabled}
              placeholder={legacy ? "Digite novamente com o país" : placeholder}
              numberInputProps={{
                ref,
                inputMode: "tel",
                autoComplete: "tel",
                onPaste: handlePaste,
                "aria-invalid": shownErr || rest["aria-invalid"] ? true : undefined,
                "aria-describedby": describedBy || undefined,
                "aria-required": required || undefined,
                "aria-label": rest["aria-label"],
                className:
                  "flex-1 min-w-0 bg-transparent outline-none px-2 placeholder:text-muted-foreground disabled:cursor-not-allowed",
              }}
            />
          </div>
          {onExtensionChange && (
            <input
              aria-label="Ramal"
              inputMode="numeric"
              placeholder="Ramal"
              maxLength={7}
              disabled={disabled}
              value={extension ?? ""}
              onChange={(e) => onExtensionChange(e.target.value.replace(/\D/g, "").slice(0, 7))}
              className="h-9 w-20 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          )}
        </div>
        {legacy && (
          <p id={legacyId} className="text-xs text-muted-foreground">
            Valor atual fora do padrão: <span className="font-mono">{legacy}</span>. Ele só muda se
            você digitar um novo número
            {legacySuggestion ? (
              <>
                {" "}
                ou{" "}
                <button
                  type="button"
                  disabled={disabled}
                  className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                  onClick={() => onChange(legacySuggestion.e164)}
                >
                  usar {formatPhoneDisplay(legacySuggestion.e164)}
                </button>
              </>
            ) : null}
            .
          </p>
        )}
        {shownErr && (
          <p id={errId} role="alert" className="text-xs text-destructive">
            {shownErr}
          </p>
        )}
      </div>
    );
  },
);
PhoneInput.displayName = "PhoneInput";

/**
 * Validação de submit para um valor vindo do `PhoneInput`: "" → null;
 * E.164 válido → ele mesmo; parcial/inválido → mensagem PT-BR.
 */
export function validatePhoneValue(
  value: string | null | undefined,
  opts: { required?: boolean; label?: string; unchangedFrom?: string | null } = {},
): { ok: true; value: string | null } | { ok: false; message: string } {
  const v = (value ?? "").trim();
  const label = opts.label ? `${opts.label}: ` : "";
  // Valor antigo não editado continua como está (não bloqueia salvar outros campos).
  if (opts.unchangedFrom != null && v === opts.unchangedFrom.trim() && v)
    return { ok: true, value: opts.unchangedFrom };
  if (!v) {
    return opts.required
      ? { ok: false, message: `${label}telefone obrigatório.` }
      : { ok: true, value: null };
  }
  if (isValidE164(v)) return { ok: true, value: v };
  const r = normalizePhone(v, { defaultCountry: null });
  if (r.status === "valid") return { ok: true, value: r.e164 };
  return {
    ok: false,
    message: `${label}${r.status === "invalid" ? phoneErrorMessage(r.reason) : phoneErrorMessage("invalid")}`,
  };
}
