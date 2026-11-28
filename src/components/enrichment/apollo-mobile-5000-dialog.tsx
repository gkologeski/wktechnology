import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  previewApolloMobileCampaign,
  runApolloMobileCampaign,
} from "@/lib/integrations/apollo-mobile-5000.functions";
import {
  MOBILE_CREDIT_LIMIT,
  MOBILE_CREDIT_PER_REQUEST,
} from "@/lib/integrations/apollo-mobile-5000";

export function ApolloMobileCampaignDialog() {
  const { canAny } = usePermissions();
  const permitted = canAny(
    ["own", "team", "workspace"].map((scope) => `techsales.prospecting_enrichment.manage.${scope}`),
  );
  const preview = useServerFn(previewApolloMobileCampaign);
  const execute = useServerFn(runApolloMobileCampaign);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [state, setState] = useState<Awaited<ReturnType<typeof preview>> | null>(null);
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState("");
  const [pilot, setPilot] = useState(true);
  const stop = useRef(false);
  if (!permitted) return null;
  const load = async () => {
    setRunning(true);
    setNotice("");
    setProgress("");
    setState(null);
    try {
      setState(await preview());
    } catch {
      setNotice("A prévia não está disponível neste workspace ou para esta sessão.");
    } finally {
      setRunning(false);
    }
  };
  const run = async (mode: "dispatch" | "reconcile") => {
    if (!state || running) return;
    const ids =
      mode === "dispatch"
        ? pilot
          ? state.candidateIds.slice(0, 10)
          : state.candidateIds
        : state.pendingIds;
    stop.current = false;
    setRunning(true);
    setNotice("");
    try {
      let done = 0;
      for (const id of ids) {
        if (stop.current) break;
        await execute({ data: { id, mode, confirm: true } });
        done++;
        setProgress(`${done} / ${ids.length} verificados`);
      }
      setNotice(
        stop.current ? "Pausado. A próxima prévia retoma o trabalho restante." : "Etapa concluída.",
      );
    } catch {
      setNotice("Etapa interrompida. Consultas já reservadas não são repetidas. Confira a prévia.");
    } finally {
      setState(null);
      try {
        setState(await preview());
      } catch {
        setNotice("Não foi possível atualizar a prévia. Não reinicie sem consultá-la.");
      }
      void qc.invalidateQueries({ queryKey: ["contacts"] });
      setRunning(false);
    }
  };
  const batchCount = state
    ? pilot
      ? Math.min(10, state.candidateIds.length)
      : state.candidateIds.length
    : 0;
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(true);
          void load();
        }}
      >
        Celulares via Apollo
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!running) setOpen(v);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preencher celulares com Apollo</DialogTitle>
            <DialogDescription>
              Gestores de TI em empresas com 100 ou mais funcionários. Só preenche o campo Celular
              quando vazio. Não cria contatos.
            </DialogDescription>
          </DialogHeader>
          {state && (
            <div className="space-y-1 text-sm">
              <p>Candidatos visíveis ainda sem consulta: {state.eligibleCount}</p>
              <p>
                {batchCount} no próximo lote. Até{" "}
                {(batchCount * MOBILE_CREDIT_PER_REQUEST).toLocaleString("pt-BR")} créditos
                adicionais.
              </p>
              <p>
                {state.reservedCredits.toLocaleString("pt-BR")} de até{" "}
                {MOBILE_CREDIT_LIMIT.toLocaleString("pt-BR")} créditos reservados (não é o gasto
                apurado).
              </p>
              <p>
                {state.pendingIds.length} aguardando resultado · {state.updated} atualizados ·{" "}
                {state.uncertain} sem confirmação
              </p>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pilot}
                  disabled={running}
                  onChange={(event) => setPilot(event.currentTarget.checked)}
                />
                Lote piloto: limitar a 10 contatos
              </label>
              {!state.enabled && (
                <p>
                  A consulta paga está desativada até a validação da conexão e do preço do Apollo.
                </p>
              )}
              {!!state.uncertain && (
                <p>Consultas sem confirmação não serão repetidas automaticamente.</p>
              )}
            </div>
          )}
          <p role="status" className="text-sm">
            {notice || progress || (running ? "Consultando prévia local…" : "")}
          </p>
          <DialogFooter>
            {running ? (
              <Button
                variant="outline"
                onClick={() => {
                  stop.current = true;
                }}
              >
                Pausar após esta consulta
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => void load()}>
                  Atualizar prévia
                </Button>
                <Button
                  variant="outline"
                  disabled={!state?.enabled || !state.pendingIds.length}
                  onClick={() => void run("reconcile")}
                >
                  Recuperar resultados (0 créditos)
                </Button>
                <Button
                  disabled={!state?.enabled || !state.candidateIds.length}
                  onClick={() => void run("dispatch")}
                >
                  Confirmar consulta paga
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
