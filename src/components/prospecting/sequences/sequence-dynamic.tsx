import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { setProspectingSequenceSubscription } from "@/lib/prospecting/sequences/dynamic.functions";
import type { DynamicSubscriptionStatus } from "@/lib/prospecting/sequences/dynamic.server";
import { COHORT_REASONS } from "@/lib/prospecting/sequences/enrollment";
export function SequenceDynamic({
  workspaceId,
  versionId,
  status,
  canActivate,
  canPause,
}: {
  workspaceId: string;
  versionId: string;
  status: DynamicSubscriptionStatus | null;
  canActivate: boolean;
  canPause: boolean;
}) {
  const permissions = usePermissions(),
    cache = useQueryClient(),
    save = useServerFn(setProspectingSequenceSubscription);
  const [consent, setConsent] = useState(""),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const unavailable =
    permissions.isLoading || permissions.isError || permissions.workspaceId !== workspaceId;
  const change = async (enabled: boolean) => {
    if (unavailable || busy || (enabled ? !canActivate : !canPause)) return;
    setBusy(true);
    setError("");
    try {
      await save({
        data: { workspaceId, versionId, enabled, consentEvidence: enabled ? consent : "" },
      });
      setConfirm(false);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["sequence-operations", workspaceId, versionId] }),
        cache.invalidateQueries({ queryKey: ["sequence-cohorts", workspaceId, versionId] }),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível alterar a entrada automática.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="space-y-3 rounded-md border bg-muted/30 p-3"
      aria-label="Entrada dinâmica de público"
    >
      <h4 className="text-sm font-semibold">Entrada automática de novos registros</h4>
      <p className="text-xs text-muted-foreground">
        Esta versão reavalia os mesmos filtros a cada 15 minutos e inicia os novos destinatários
        elegíveis. Expediente, limites, descadastros e permissões são revalidados antes das ações.
        Limite por verificação: 5.000 registros; refine o público se necessário.
      </p>
      <p className="text-sm">
        {status
          ? status.enabled
            ? "Entrada automática ativa"
            : "Entrada automática pausada"
          : "Sem assinatura visível para esta versão"}
      </p>
      {status?.lastScanAt && (
        <p className="text-xs text-muted-foreground">
          Última verificação concluída: {new Date(status.lastScanAt).toLocaleString("pt-BR")}
          {status.enabled
            ? ` · próxima: ${new Date(status.nextScanAt).toLocaleString("pt-BR")}`
            : ""}
        </p>
      )}
      {status?.errorCode && (
        <p role="alert" className="text-xs text-destructive">
          {status.errorCode === "audience_limit"
            ? "O público ultrapassou 5.000 registros. Refine os filtros e crie uma nova versão para reativar uma entrada menor."
            : `A última verificação não foi concluída (${status.errorCode}). Confira as permissões e o histórico antes de reativar.`}
        </p>
      )}
      {status?.lastScanAt && status.matched !== null && (
        <div className="text-xs space-y-1">
          <p>
            Na última verificação deste responsável: {status.matched} correspondentes ·{" "}
            {status.started} novas inscrições.
          </p>
          {Object.entries(status.reasons || {}).map(([reason, count]) => (
            <p key={reason}>
              {COHORT_REASONS[reason as keyof typeof COHORT_REASONS] || reason}: {count}
            </p>
          ))}
        </div>
      )}
      {status && !status.lastScanAt && (
        <p className="text-xs text-muted-foreground">
          Nenhuma verificação concluída até o momento.
        </p>
      )}
      {status?.lastScanAt && status.matched === null && (
        <p className="text-xs text-muted-foreground">
          As contagens históricas desta verificação ficam visíveis ao responsável e aos
          administradores do workspace.
        </p>
      )}
      {!status?.enabled && canActivate && (
        <>
          <label className="block text-xs space-y-1">
            Origem e autorização para contatar também os registros futuros
            <Textarea
              rows={2}
              maxLength={2000}
              value={consent}
              disabled={busy || unavailable}
              onChange={(e) => {
                setConsent(e.target.value);
                setConfirm(false);
              }}
            />
          </label>
          {confirm ? (
            <div className="space-y-2">
              <p className="text-xs">
                Confirmar a entrada e o início automático dos novos registros que corresponderem a
                esta versão? O usuário que ativa será o responsável pela execução.
              </p>
              <Button
                size="sm"
                disabled={busy || unavailable || consent.trim().length < 10}
                onClick={() => void change(true)}
              >
                Confirmar ativação
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm(false)}>
                Voltar
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              disabled={busy || unavailable || consent.trim().length < 10}
              onClick={() => setConfirm(true)}
            >
              Ativar entrada automática
            </Button>
          )}
        </>
      )}
      {status?.enabled && canPause && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy || unavailable}
          onClick={() => void change(false)}
        >
          Pausar entrada de novos registros
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Pausar esta entrada preserva os contatos já inscritos. Use os controles de execução ou
        cancele a inscrição para interrompê-los.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
