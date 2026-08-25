import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { MessageToken } from "@/lib/message-tokens-catalog";

interface TokenPillsProps {
  tokens: MessageToken[];
  onInsert: (token: string) => void;
  label?: string;
  className?: string;
}

/**
 * Renderiza variáveis de personalização como pills clicáveis abaixo de um campo
 * de texto. Ao clicar, insere o token literal (ex.: `{{first_name}}`) no callback
 * fornecido — que deve inseri-lo na posição atual do cursor.
 */
export function TokenPills({ tokens, onInsert, label = "Variáveis", className }: TokenPillsProps) {
  const groups = useMemo(() => {
    const map = new Map<string, MessageToken[]>();
    for (const t of tokens) {
      const g = t.group ?? "";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(t);
    }
    return Array.from(map.entries());
  }, [tokens]);

  if (!tokens.length) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <span className="block text-[11px] font-medium text-muted-foreground">{label}:</span>
      {groups.map(([group, items], gi) => (
        <div
          key={group || gi}
          className={cn("space-y-1", gi < groups.length - 1 && "border-b border-border pb-2")}
        >
          {group && (
            <span className="block text-[11px] font-medium text-muted-foreground">{group}</span>
          )}
          <div className="flex flex-wrap items-center gap-1">
            {items.map((t) => (
              <button
                key={t.token}
                type="button"
                onClick={() => onInsert(t.token)}
                title={t.token}
                aria-label={`Inserir ${t.label}`}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground whitespace-nowrap transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
