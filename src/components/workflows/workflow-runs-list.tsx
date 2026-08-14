// Lista compacta de execuções recentes de workflows com expand para ver o log.
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
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

type RunLogStep = {
  at?: string;
  ok?: boolean;
  action?: string;
  action_label?: string;
  step_path?: string;
  error?: string;
  detail?: unknown;
};

const STATUS_LABELS: Record<string, string> = {
  success: "Concluída",
  error: "Erro",
  running: "Executando",
  skipped: "Ignorada",
  waiting_approval: "Aguardando aprovação",
};

export function WorkflowRunsList({
  runs,
  namesById,
}: {
  runs: Run[];
  namesById?: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (runs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma execução ainda.</p>
    );
  }

  return (
    <div className="divide-y rounded-md border">
      {runs.map((r) => {
        const isOpen = expanded === r.id;
        const Icon = r.status === "success" ? CheckCircle2 : r.status === "error" ? XCircle : Clock;
        const variant: "default" | "destructive" | "secondary" =
          r.status === "success" ? "default" : r.status === "error" ? "destructive" : "secondary";
        const steps = Array.isArray(r.log) ? (r.log as RunLogStep[]) : [];
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
              <Badge variant={variant}>{STATUS_LABELS[r.status] ?? r.status}</Badge>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}
              </span>
            </button>
            {isOpen && (
              <div className="bg-muted/30 px-3 py-3 text-xs space-y-2">
                {r.error && (
                  <p className="flex items-start gap-2 text-destructive font-medium" role="alert">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {r.error}
                  </p>
                )}
                {steps.length > 0 ? (
                  <ol className="space-y-2">
                    {steps.map((step, index) => (
                      <li key={`${step.at ?? "step"}-${index}`} className="rounded-md border bg-background p-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={step.ok === false ? "destructive" : "outline"}>
                            {step.step_path ? `Passo ${step.step_path}` : `Passo ${index + 1}`}
                          </Badge>
                          <span className="font-medium">{step.action_label ?? step.action ?? "Ação"}</span>
                          {step.at && (
                            <span className="text-muted-foreground">
                              {new Date(step.at).toLocaleTimeString("pt-BR")}
                            </span>
                          )}
                        </div>
                        {step.error && <p className="mt-1 text-destructive">{step.error}</p>}
                        {step.detail !== undefined && (
                          <details className="mt-1 text-muted-foreground">
                            <summary className="cursor-pointer">Detalhes técnicos</summary>
                            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap">
                              {JSON.stringify(step.detail, null, 2)}
                            </pre>
                          </details>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-muted-foreground">Esta execução não registrou passos.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function WorkflowRunsListWithRefresh({
  runs,
  namesById,
  onRefresh,
}: {
  runs: Run[];
  namesById?: Record<string, string>;
  onRefresh?: () => void;
}) {
  return (
    <div className="space-y-2">
      {onRefresh && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            Atualizar
          </Button>
        </div>
      )}
      <WorkflowRunsList runs={runs} namesById={namesById} />
    </div>
  );
}
