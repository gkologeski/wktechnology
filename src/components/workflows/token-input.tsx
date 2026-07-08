// Wrappers de <Input> e <Textarea> que renderizam TokenPills sempre visíveis
// abaixo do campo. Clicar em um pill insere o token na posição do cursor.
import { forwardRef, useImperativeHandle, useRef } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TokenPills } from "@/components/ui/token-pills";
import { WORKFLOW_TOKENS, type MessageToken } from "@/lib/message-tokens-catalog";
import { insertAtCursor } from "@/lib/token-insert";
import { cn } from "@/lib/utils";

type BaseInputProps = React.InputHTMLAttributes<HTMLInputElement>;
type BaseTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

interface TokenFieldExtras {
  value: string;
  onValueChange: (v: string) => void;
  tokens?: MessageToken[];
  pickerLabel?: string;
  hidePills?: boolean;
}

export const TokenInput = forwardRef<
  HTMLInputElement,
  Omit<BaseInputProps, "value" | "onChange"> & TokenFieldExtras
>(function TokenInput(
  { value, onValueChange, tokens = WORKFLOW_TOKENS, pickerLabel = "Variáveis", hidePills, className, ...rest },
  ref,
) {
  const inner = useRef<HTMLInputElement | null>(null);
  useImperativeHandle(ref, () => inner.current as HTMLInputElement);

  return (
    <div className="space-y-1.5">
      <Input
        ref={inner}
        value={value ?? ""}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn(className)}
        {...rest}
      />
      {!hidePills && (
        <TokenPills
          tokens={tokens}
          label={pickerLabel}
          onInsert={(t) => insertAtCursor(inner.current, value ?? "", t, onValueChange)}
        />
      )}
    </div>
  );
});

export const TokenTextarea = forwardRef<
  HTMLTextAreaElement,
  Omit<BaseTextareaProps, "value" | "onChange"> & TokenFieldExtras
>(function TokenTextarea(
  { value, onValueChange, tokens = WORKFLOW_TOKENS, pickerLabel = "Variáveis", hidePills, className, ...rest },
  ref,
) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement);

  return (
    <div className="space-y-1.5">
      <Textarea
        ref={inner}
        value={value ?? ""}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn(className)}
        {...rest}
      />
      {!hidePills && (
        <TokenPills
          tokens={tokens}
          label={pickerLabel}
          onInsert={(t) => insertAtCursor(inner.current, value ?? "", t, onValueChange)}
        />
      )}
    </div>
  );
});
