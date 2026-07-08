// Wrappers de <Input> e <Textarea> que expõem um botão discreto "{ }"
// para inserir variáveis (tokens) na posição do cursor.
// Mantém API próxima dos primitives do shadcn.
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Braces } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
}

function TokenButton({
  onInsert,
  tokens,
  label,
  className,
}: {
  onInsert: (t: string) => void;
  tokens: MessageToken[];
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Inserir variável"
          title="Inserir variável"
          // onMouseDown para não perder o foco do input antes de inserir
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "h-6 w-6 rounded-md text-muted-foreground hover:text-foreground",
            className,
          )}
        >
          <Braces className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <p className="mb-2 text-[11px] font-medium text-muted-foreground">{label}</p>
        <TokenPills
          tokens={tokens}
          label=""
          onInsert={(t) => {
            onInsert(t);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export const TokenInput = forwardRef<
  HTMLInputElement,
  Omit<BaseInputProps, "value" | "onChange"> & TokenFieldExtras
>(function TokenInput(
  { value, onValueChange, tokens = WORKFLOW_TOKENS, pickerLabel = "Inserir variável", className, ...rest },
  ref,
) {
  const inner = useRef<HTMLInputElement | null>(null);
  useImperativeHandle(ref, () => inner.current as HTMLInputElement);

  return (
    <div className="relative">
      <Input
        ref={inner}
        value={value ?? ""}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn("pr-8", className)}
        {...rest}
      />
      <div className="absolute right-1 top-1/2 -translate-y-1/2">
        <TokenButton
          tokens={tokens}
          label={pickerLabel}
          onInsert={(t) => insertAtCursor(inner.current, value ?? "", t, onValueChange)}
        />
      </div>
    </div>
  );
});

export const TokenTextarea = forwardRef<
  HTMLTextAreaElement,
  Omit<BaseTextareaProps, "value" | "onChange"> & TokenFieldExtras
>(function TokenTextarea(
  { value, onValueChange, tokens = WORKFLOW_TOKENS, pickerLabel = "Inserir variável", className, ...rest },
  ref,
) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement);

  return (
    <div className="relative">
      <Textarea
        ref={inner}
        value={value ?? ""}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn("pr-8", className)}
        {...rest}
      />
      <div className="absolute right-1 top-1">
        <TokenButton
          tokens={tokens}
          label={pickerLabel}
          onInsert={(t) => insertAtCursor(inner.current, value ?? "", t, onValueChange)}
        />
      </div>
    </div>
  );
});
