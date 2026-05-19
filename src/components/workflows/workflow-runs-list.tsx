// Lista compacta de execuções recentes de workflows com expand para ver o log.
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Run = {
  id: string;
  workflow_id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  log: unknown;
  created_at: string;
};

export function WorkflowRunsList({ runs, namesById }: { runs: Run[]; namesById?: Record<string, string> }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (runs.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma execução ainda.</p>;
  }

  return (
    <div className="divide-y rounded-md border">
      {runs.map((r) => {
        const isOpen = expanded === r.id;
        const Icon = r.status === "success" ? CheckCircle2 : r.status === "error" ? XCircle : Clock;
        const variant: "default" | "destructive" | "secondary" =
          r.status === "success" ? "default" : r.status === "error" ? "destructive" : "secondary";
        return (
          <div key={r.id}>
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : r.id)}
              className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-muted/50"
            >
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Icon className="h-4 w-4" />
              <span className="flex-1 truncate">
                {namesById?.[r.workflow_id] ?? r.workflow_id.slice(0, 8)}
              </span>
              <Badge variant={variant}>{r.status}</Badge>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}
              </span>
            </button>
            {isOpen && (
              <div className="bg-muted/30 px-3 py-2 text-xs">
                {r.error && <p className="text-destructive mb-2">Erro: {r.error}</p>}
                <pre className="overflow-auto max-h-64 whitespace-pre-wrap">
                  {JSON.stringify(r.log, null, 2)}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function WorkflowRunsListWithRefresh({ runs, namesById, onRefresh }: {
  runs: Run[]; namesById?: Record<string, string>; onRefresh?: () => void;
}) {
  return (
    <div className="space-y-2">
      {onRefresh && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onRefresh}>Atualizar</Button>
        </div>
      )}
      <WorkflowRunsList runs={runs} namesById={namesById} />
    </div>
  );
}
