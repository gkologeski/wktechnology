import { usePermissions } from "@/lib/access-control/use-permissions";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  getSequenceOperations,
  runSequenceOperation,
} from "@/lib/prospecting/sequences/operations.functions";
import type { operationInput } from "@/lib/prospecting/sequences/draft";
import type { z } from "zod";
const states: Record<string, string> = {
  active: "Em execução",
  paused: "Pausada",
  cancelled: "Cancelada",
  completed: "Concluída",
  human: "Atendimento humano",
  agent: "Com agente",
  blocked: "Bloqueada",
  uncertain: "Resultado a conferir",
  waiting_task: "Aguardando atividade",
};
type Action = z.infer<typeof operationInput>["action"];
export function SequenceOperations({
  workspaceId,
  versionId,
  cohortId,
  held,
  disabled,
}: {
  workspaceId: string;
  versionId: string;
  cohortId?: string;
  held: number;
  disabled: boolean;
}) {
  const permissions = usePermissions();
  const unavailable =
    disabled ||
    permissions.isLoading ||
    permissions.isError ||
    permissions.workspaceId !== workspaceId;
  const [page, setPage] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmStart, setConfirmStart] = useState(false);
  const load = useServerFn(getSequenceOperations),
    operate = useServerFn(runSequenceOperation),
    cache = useQueryClient();
  const query = useQuery({
    queryKey: ["sequence-operations", workspaceId, versionId, page],
    enabled: !unavailable,
    queryFn: () => load({ data: { workspaceId, versionId, page } }),
    refetchInterval: 30000,
  });
  const act = async (id: string, action: Action) => {
    if (busy || unavailable) return;
    setBusy(true);
    setError("");
    try {
      await operate({ data: { workspaceId, versionId, id, action } });
      setConfirmStart(false);
      await cache.invalidateQueries({ queryKey: ["sequence-operations", workspaceId, versionId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível concluir a operação.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-3 rounded-lg border p-4" aria-label="Operação da sequência">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-sm">Execução e acompanhamento</h3>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || query.isFetching || disabled}
          onClick={() => void query.refetch()}
        >
          Atualizar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Execuções visíveis nesta versão. Chamadas geram atividades para o responsável; o fluxo
        aguarda a conclusão. Uma confirmação de envio exige retorno do provedor.
      </p>
      {query.isPending && !disabled && <p role="status">Carregando execuções…</p>}
      {query.isError && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar as execuções. Atualize para tentar novamente.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {query.data && (
        <>
          <p className="text-xs">
            {query.data.total} execuções visíveis · página {page + 1}
          </p>
          {cohortId && held > 0 && query.data.canStart && (
            <div className="space-y-2">
              {confirmStart ? (
                <>
                  <p className="text-sm">
                    Iniciar os contatos elegíveis desta inscrição? As mensagens poderão ser enviadas
                    conforme os horários, limites e etapas da versão salva.
                  </p>
                  <Button disabled={busy} onClick={() => void act(cohortId, "start")}>
                    Confirmar início
                  </Button>
                  <Button variant="ghost" disabled={busy} onClick={() => setConfirmStart(false)}>
                    Voltar
                  </Button>
                </>
              ) : (
                <Button disabled={busy || disabled} onClick={() => setConfirmStart(true)}>
                  Iniciar inscrição selecionada
                </Button>
              )}
            </div>
          )}
          {query.data.readOnly && (
            <p className="text-xs">
              Sessão apenas para leitura. Nenhuma execução pode ser iniciada ou alterada.
            </p>
          )}
          <div className="space-y-2">
            {query.data.rows.map((r) => (
              <article key={r.id} className="rounded-md border p-3 space-y-2">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span>
                    {states[r.state] || r.state} · etapa {r.cursor + 1}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(r.next_run_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Execução {r.id.slice(0, 8)}
                  {r.reason ? ` · ${r.reason}` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {r.canManage && ["active", "waiting_task"].includes(r.state) && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void act(r.id, "pause")}
                    >
                      Pausar
                    </Button>
                  )}
                  {r.canResume && r.state === "paused" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void act(r.id, "resume")}
                    >
                      Retomar
                    </Button>
                  )}
                  {r.canResume && r.state === "blocked" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void act(r.id, "retry")}
                    >
                      Revalidar e tentar novamente
                    </Button>
                  )}
                  {r.canResume && r.state === "uncertain" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void act(r.id, "reconcile")}
                    >
                      Conferir recibo existente
                    </Button>
                  )}
                  {r.canManage && !["completed", "cancelled"].includes(r.state) && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void act(r.id, "cancel")}
                    >
                      Cancelar sequência
                    </Button>
                  )}
                  {r.canCompleteCall && r.activityKind === "call" && r.state === "waiting_task" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void act(r.id, "answered")}
                      >
                        Chamada atendida
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void act(r.id, "no_answer")}
                      >
                        Sem resposta na chamada
                      </Button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0 || busy}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={(page + 1) * 50 >= query.data.total || busy}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
