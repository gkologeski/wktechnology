import { Archive, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import type { ServiceAccount } from "@/lib/prospecting/sdr/channel-accounts.functions";

/** Lista somente leitura dos números desconectados, mantidos apenas como histórico. */
export function ArchivedAccounts({
  accounts,
  conversationCounts,
}: {
  accounts: ServiceAccount[];
  conversationCounts: Record<string, number | null>;
}) {
  if (!accounts.length) return null;
  return (
    <Collapsible className="rounded-lg border">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="group w-full justify-between px-4 py-6">
          <span className="flex items-center gap-2 font-medium">
            <Archive className="h-4 w-4 text-muted-foreground" aria-hidden />
            Arquivados ({accounts.length})
          </span>
          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="px-4 pb-2 text-sm text-muted-foreground">
          Números desconectados. Ficam só para consulta do histórico: não enviam nem recebem mensagens.
        </p>
        <ul className="divide-y border-t">
          {accounts.map((a) => {
            const count = conversationCounts[a.id];
            return (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{a.display_name || a.label}</p>
                  {a.display_name && a.display_name !== a.label && (
                    <p className="text-muted-foreground">{a.label}</p>
                  )}
                </div>
                <div className="text-right text-muted-foreground">
                  <p>
                    Arquivado em{" "}
                    {a.archived_at ? new Date(a.archived_at).toLocaleDateString("pt-BR") : "—"}
                  </p>
                  {count != null && (
                    <p>
                      {count} {count === 1 ? "conversa" : "conversas"} no histórico
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
