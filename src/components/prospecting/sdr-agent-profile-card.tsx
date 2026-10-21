// Cartão "Perfil da Lia": cria o responsável sem login (espelha quem cria) e
// transfere o histórico do agente com prévia, cópia de segurança e desfazer.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bot, Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/techhire/ui";
import {
  createSdrAgentProfile,
  getSdrAgentProfile,
  sdrAgentHistory,
  undoSdrAgentHistory,
} from "@/lib/sdr-agent-identity.functions";

type Counts = { run_id?: string; activities: number; sdr_actions: number };
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Falha inesperada.");

export function SdrAgentProfileCard() {
  const qc = useQueryClient();
  const getFn = useServerFn(getSdrAgentProfile);
  const createFn = useServerFn(createSdrAgentProfile);
  const histFn = useServerFn(sdrAgentHistory);
  const undoFn = useServerFn(undoSdrAgentHistory);
  const [preview, setPreview] = useState<Counts | null>(null);
  const [lastRun, setLastRun] = useState<Counts | null>(null);

  const q = useQuery({ queryKey: ["sdr-agent-profile"], queryFn: () => getFn() });
  const create = useMutation({
    mutationFn: () => createFn(),
    onSuccess: () => {
      toast.success("Perfil da Lia criado.");
      qc.invalidateQueries({ queryKey: ["sdr-agent-profile"] });
      qc.invalidateQueries({ queryKey: ["workspace-members"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const hist = useMutation({
    mutationFn: (apply: boolean) => histFn({ data: { apply } }),
    onSuccess: (r, apply) => {
      if (apply) {
        setLastRun(r);
        setPreview(null);
        toast.success(`Transferidos: ${r.activities} atividades e ${r.sdr_actions} ações.`);
      } else setPreview(r);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const undo = useMutation({
    mutationFn: (runId: string) => undoFn({ data: { runId } }),
    onSuccess: () => {
      setLastRun(null);
      toast.success("Transferência desfeita.");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const identity = q.data?.identity ?? null;
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4" aria-live="polite">
      <SectionHeader
        title="Perfil da Lia"
        description="Responsável sem login pelas ações do agente. Espelha o papel, os cargos e os pacotes de quem cria. Repasses e reuniões continuam com a pessoa que assume."
      />
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : q.isError ? (
        <div className="flex items-center gap-2 text-sm text-destructive">
          Não foi possível carregar.{" "}
          <Button size="sm" variant="outline" onClick={() => q.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : !identity ? (
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Bot className="mr-2 h-4 w-4" />
          )}
          Criar perfil da Lia espelhando o meu
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Bot className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="font-medium">{identity.display_name}</span>
            <Badge variant="secondary">Ativo, sem login</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => hist.mutate(false)}
              disabled={hist.isPending}
            >
              Ver o que será transferido
            </Button>
            {preview && (
              <>
                <span className="text-sm text-muted-foreground">
                  {preview.activities} atividades e {preview.sdr_actions} ações do agente.
                </span>
                <Button
                  size="sm"
                  onClick={() => hist.mutate(true)}
                  disabled={hist.isPending || preview.activities + preview.sdr_actions === 0}
                >
                  Transferir histórico para a Lia
                </Button>
              </>
            )}
            {lastRun?.run_id && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => undo.mutate(lastRun.run_id!)}
                disabled={undo.isPending}
              >
                <Undo2 className="mr-2 h-4 w-4" /> Desfazer transferência
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
