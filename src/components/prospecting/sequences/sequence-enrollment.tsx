import { SequenceOperations } from "./sequence-operations";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { COHORT_REASONS, type CohortSummary } from "@/lib/prospecting/sequences/enrollment";
import {
  prepareProspectingSequenceEnrollment,
  listProspectingSequenceCohorts,
} from "@/lib/prospecting/sequences/enrollment.functions";
import type { SequenceRelease } from "@/lib/prospecting/sequences/releases.server";
export function SequenceEnrollment({
  workspaceId,
  versions,
  disabled,
}: {
  workspaceId: string;
  versions: SequenceRelease[];
  disabled: boolean;
}) {
  const permissions = usePermissions(),
    cache = useQueryClient();
  const [selected, setSelected] = useState(""),
    [consent, setConsent] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [last, setLast] = useState<CohortSummary | null>(null);
  const request = useRef<string | null>(null);
  const versionId = selected || versions[0]?.id;
  const canAssign =
    !permissions.isLoading &&
    !permissions.isError &&
    permissions.workspaceId === workspaceId &&
    permissions.canAny(
      ["own", "team", "workspace"].map((s) => `system.automation.sequences.assign.${s}`),
    );
  const create = useServerFn(prepareProspectingSequenceEnrollment),
    list = useServerFn(listProspectingSequenceCohorts);
  const history = useQuery({
    queryKey: ["sequence-cohorts", workspaceId, versionId],
    enabled: !!versionId && !permissions.isLoading && !permissions.isError,
    queryFn: () => list({ data: { workspaceId, versionId: versionId! } }),
  });
  const reserve = async () => {
    if (!canAssign || !versionId || busy || disabled || consent.trim().length < 10) return;
    setBusy(true);
    setError("");
    request.current ??= crypto.randomUUID();
    try {
      const result = await create({
        data: { workspaceId, versionId, requestId: request.current, consentEvidence: consent },
      });
      setLast(result);
      toast.success("Público reservado. Nenhum disparo iniciado.");
      await cache.invalidateQueries({ queryKey: ["sequence-cohorts", workspaceId, versionId] });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível preparar a inscrição. Nenhum envio foi iniciado.",
      );
    } finally {
      setBusy(false);
    }
  };
  const summary = last?.version_id === versionId ? last : history.data?.[0];
  return (
    <section className="space-y-3 border-t pt-4" aria-label="Inscrição do público">
      <h3 className="text-sm font-semibold">Inscrição do público em uma versão</h3>
      <p className="text-xs text-muted-foreground">
        Gera uma fotografia dos filtros salvos na versão, com exclusões, descadastros e
        duplicidades. As pessoas ficam reservadas e sem execução. Entrada automática por novos
        registros será habilitada no próximo lote.
      </p>
      <label className="block space-y-1 text-xs">
        Versão para inscrição
        <select
          aria-label="Versão para inscrição"
          value={versionId || ""}
          disabled={disabled || busy || !versions.length}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          onChange={(e) => {
            setSelected(e.target.value);
            setLast(null);
            request.current = null;
            setError("");
          }}
        >
          {!versions.length && <option value="">Crie uma versão primeiro</option>}
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              Revisão {v.draft_revision} · {v.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-xs">
        Origem e autorização para contato com este público
        <Textarea
          rows={2}
          maxLength={2000}
          disabled={disabled || busy || !canAssign}
          value={consent}
          onChange={(e) => {
            setConsent(e.target.value);
            request.current = null;
            setLast(null);
          }}
          placeholder="Registre a origem da lista e a evidência de autorização para os canais escolhidos."
        />
      </label>
      <Button
        variant="outline"
        disabled={
          !!last || !canAssign || !versionId || disabled || busy || consent.trim().length < 10
        }
        onClick={() => void reserve()}
      >
        {busy ? "Calculando e reservando…" : "Reservar público sem iniciar disparos"}
      </Button>
      {last && (
        <Button
          variant="ghost"
          disabled={busy || disabled || !canAssign}
          onClick={() => {
            request.current = null;
            setLast(null);
            setError("");
          }}
        >
          Nova inscrição com os filtros da versão
        </Button>
      )}
      {!canAssign && (
        <p className="text-xs text-muted-foreground">
          A inscrição exige a permissão Atribuir sequências, independente da edição e da criação de
          versões.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {history.isError && (
        <p className="text-xs text-destructive">
          Não foi possível carregar as inscrições; falha não significa público vazio.
        </p>
      )}
      {summary && (
        <div aria-live="polite" className="space-y-2 rounded-md bg-muted p-3 text-sm">
          <p>
            Última inscrição: {summary.requested} encontrados · {summary.held} reservados ·{" "}
            {summary.blocked} bloqueados
          </p>
          {summary.held + summary.blocked < summary.requested && (
            <p className="text-xs">
              Os contadores mostram apenas os registros que você ainda pode visualizar.
            </p>
          )}
          {Object.entries(summary.reasons).map(([reason, count]) => (
            <p key={reason} className="text-xs">
              {COHORT_REASONS[reason as keyof typeof COHORT_REASONS] || reason}: {count}
            </p>
          ))}
          <p className="text-xs text-muted-foreground">
            A reserva não envia mensagens. Consulte as execuções abaixo para acompanhar o início e
            cada ação.
          </p>
        </div>
      )}
      {versionId && (
        <SequenceOperations
          key={versionId}
          workspaceId={workspaceId}
          versionId={versionId}
          cohortId={summary?.id}
          held={summary?.held || 0}
          disabled={
            disabled ||
            permissions.isLoading ||
            permissions.isError ||
            permissions.workspaceId !== workspaceId
          }
        />
      )}
    </section>
  );
}
