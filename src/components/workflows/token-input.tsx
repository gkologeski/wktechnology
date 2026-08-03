// Wrappers de <Input> e <Textarea> que renderizam TokenPills sempre visíveis
// abaixo do campo. Clicar em um pill insere o token na posição do cursor.
//
// As pills padrão vêm do contexto do construtor de workflows
// (`WorkflowTokensProvider`), que deriva as variáveis da entidade do gatilho.
// `WORKFLOW_TOKENS` é apenas o fallback quando não há contexto/catálogo.
import { createContext, forwardRef, useContext, useImperativeHandle, useRef } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TokenPills } from "@/components/ui/token-pills";
import { WORKFLOW_TOKENS, type MessageToken } from "@/lib/message-tokens-catalog";
import { insertAtCursor } from "@/lib/token-insert";
import { cn } from "@/lib/utils";

type TokenSets = {
  text: MessageToken[];
  id: MessageToken[];
  /** Opções pré-carregadas de ID por tipo de referência (gatilho + passos). */
  refs?: Record<string, MessageToken[]>;
};

const WorkflowTokensContext = createContext<TokenSets | null>(null);

export function WorkflowTokensProvider({
  value,
  children,
}: {
  value: TokenSets;
  children: React.ReactNode;
}) {
  return <WorkflowTokensContext.Provider value={value}>{children}</WorkflowTokensContext.Provider>;
}

/** Tokens disponíveis no contexto atual; `kind: "id"` para campos de referência. */
export function useWorkflowTokens(kind: "text" | "id" = "text"): MessageToken[] {
  const ctx = useContext(WorkflowTokensContext);
  if (!ctx) return WORKFLOW_TOKENS;
  const list = kind === "id" ? ctx.id : ctx.text;
  return list.length > 0 ? list : WORKFLOW_TOKENS;
}

/**
 * Opções de ID compatíveis com um campo de referência (empresa, negócio…),
 * derivadas do registro do gatilho e dos passos anteriores.
 */
export function useWorkflowRefOptions(kind: string): MessageToken[] {
  const ctx = useContext(WorkflowTokensContext);
  return ctx?.refs?.[kind] ?? [];
}

type BaseInputProps = React.InputHTMLAttributes<HTMLInputElement>;
type BaseTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

interface TokenFieldExtras {
  value: string;
  onValueChange: (v: string) => void;
  tokens?: MessageToken[];
  /** Usa o conjunto de tokens de ID (campos de referência). */
  tokenKind?: "text" | "id";
  pickerLabel?: string;
  hidePills?: boolean;
}

export const TokenInput = forwardRef<
  HTMLInputElement,
  Omit<BaseInputProps, "value" | "onChange"> & TokenFieldExtras
>(function TokenInput(
  {
    value,
    onValueChange,
    tokens,
    tokenKind = "text",
    pickerLabel = "Variáveis",
    hidePills,
    className,
    ...rest
  },
  ref,
) {
  const inner = useRef<HTMLInputElement | null>(null);
  useImperativeHandle(ref, () => inner.current as HTMLInputElement);
  const ctxTokens = useWorkflowTokens(tokenKind);
  const list = tokens ?? ctxTokens;

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
          tokens={list}
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
  {
    value,
    onValueChange,
    tokens,
    tokenKind = "text",
    pickerLabel = "Variáveis",
    hidePills,
    className,
    ...rest
  },
  ref,
) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement);
  const ctxTokens = useWorkflowTokens(tokenKind);
  const list = tokens ?? ctxTokens;

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
          tokens={list}
          label={pickerLabel}
          onInsert={(t) => insertAtCursor(inner.current, value ?? "", t, onValueChange)}
        />
      )}
    </div>
  );
});
