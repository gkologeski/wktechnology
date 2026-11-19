import { useState } from "react";
import { useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertCircle, FileCheck2, History, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  openContractLegacyEvidence,
  recognizeContractLegacy,
} from "@/lib/contracts/legacy.functions";
import { LEGACY_SITUATION_LABEL } from "@/lib/contracts/legacy-types";
import {
  LEGACY_EVENT_LABEL,
  missingBeforeRegularize,
  type LegacyLoad,
  type LegacyMode,
  type LegacyState,
} from "@/lib/contracts/legacy-view";
import { formatDateTime } from "@/lib/crm";
import { LegacyRegularizeForm } from "./legacy-regularize-form";
import { LegacyPartiesEditor } from "./legacy-parties-editor";

const KEY = "techcontracts.legacy_contracts";
type ContractLike = {
  id: string;
  counterparty_company_id?: string | null;
  contracting_legal_entity_id?: string | null;
  body_html?: string | null;
  source_file_path?: string | null;
};

/** Painel de contrato legado: trilha no centro, ações à direita. */
export function ContractLegacyPanel({
  contract,
  mode,
  query,
  canUpdateContract,
}: {
  contract: ContractLike;
  mode: LegacyMode;
  query: UseQueryResult<LegacyLoad>;
  canUpdateContract: boolean;
}) {
  if (mode === "ineligible" || mode === "denied") return null;
  const state = query.data?.access === "granted" ? query.data.state : null;
  return (
    <Card aria-labelledby="legacy-title">
      <CardHeader className="pb-3">
        <CardTitle id="legacy-title" className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Contrato legado
          {state?.record ? (
            <Badge variant="outline">
              {state.record.status === "regularized" ? "Regularizado" : "Pendente de regularização"}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {mode === "loading" ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : mode === "error" ? (
          <div role="alert" className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5" aria-hidden="true" />
            <div className="space-y-2">
              <p>
                Não foi possível verificar se este contrato é legado. Aprovação e assinatura ficam
                ocultas até a verificação.
              </p>
              <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
                Tentar novamente
              </Button>
            </div>
          </div>
        ) : mode === "restricted_pending" || mode === "restricted_regularized" ? (
          <p className="text-sm text-muted-foreground">
            Este é um contrato legado{" "}
            {mode === "restricted_regularized" ? "regularizado" : "pendente de regularização"}. Não
            exige cotação, proposta, minuta ou nova assinatura. Para consultar evidências e
            regularizar, solicite ao administrador a permissão específica de contratos legados.
          </p>
        ) : state ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <LegacyTimeline state={state} contractId={contract.id} />
            <aside className="space-y-4" aria-label="Ações do contrato legado">
              {(mode === "eligible" || mode === "pending" || mode === "stale") && (
                <LegacyPartiesEditor
                  contractId={contract.id}
                  companyId={contract.counterparty_company_id ?? null}
                  legalEntityId={contract.contracting_legal_entity_id ?? null}
                  allowed={canUpdateContract}
                />
              )}
              <LegacyActions
                mode={mode}
                state={state}
                contract={contract}
                canUpdateContract={canUpdateContract}
              />
            </aside>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function LegacyTimeline({ state, contractId }: { state: LegacyState; contractId: string }) {
  const open = useServerFn(openContractLegacyEvidence);
  const [opening, setOpening] = useState<string | null>(null);
  async function preview(evidenceId: string) {
    setOpening(evidenceId);
    try {
      const r = await open({ data: { contractId, evidenceId } });
      window.open(r.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOpening(null);
    }
  }
  const used = state.evidence.filter((e) => e.status !== "pending_upload");
  return (
    <section className="space-y-4" aria-label="Trilha do contrato legado">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <History className="h-4 w-4" aria-hidden="true" /> Trilha
      </h3>
      {state.events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ainda não reconhecido como legado. A origem importada sozinha não comprova assinatura.
        </p>
      ) : (
        <ol className="space-y-3 border-l border-border pl-4">
          {state.events.map((e, i) => (
            <li key={`${e.kind}-${i}`} className="text-sm">
              <p className="font-medium">{LEGACY_EVENT_LABEL[e.kind]}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(e.created_at)} · revisão {e.revision}
              </p>
              {e.reason ? <p className="text-muted-foreground">{e.reason}</p> : null}
            </li>
          ))}
        </ol>
      )}
      {used.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <FileCheck2 className="h-4 w-4" aria-hidden="true" /> Original assinado (privado)
          </h3>
          {used.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="truncate">{e.file_name}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">
                  SHA-256 {e.sha256.slice(0, 16)}… ·{" "}
                  {e.status === "superseded" ? "substituído" : "conferido"}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={opening === e.id}
                onClick={() => void preview(e.id)}
              >
                {opening === e.id ? "Abrindo…" : "Ver PDF"}
              </Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            O hash comprova a integridade do arquivo, não autenticação jurídica externa.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function LegacyActions({
  mode,
  state,
  contract,
  canUpdateContract,
}: {
  mode: LegacyMode;
  state: LegacyState;
  contract: ContractLike;
  canUpdateContract: boolean;
}) {
  const { can } = usePermissions();
  const canCreate = can(`${KEY}.create.workspace`) && canUpdateContract;
  const canApprove = can(`${KEY}.approve.workspace`) && canUpdateContract;
  if (mode === "regularized" && state.record)
    return (
      <div className="space-y-2 text-sm">
        <p>
          Situação:{" "}
          <strong>
            {state.record.situation ? LEGACY_SITUATION_LABEL[state.record.situation] : "—"}
          </strong>
        </p>
        <p className="text-muted-foreground">
          Regularizado em{" "}
          {state.record.regularized_at ? formatDateTime(state.record.regularized_at) : "—"}. Não há
          exigência comercial retroativa; anexos, vínculos e identificadores foram mantidos.
          Alterações somente por aditivo.
        </p>
      </div>
    );
  if (mode === "eligible")
    return <RecognizeForm contractId={contract.id} revision={null} allowed={canCreate} />;
  const missing = missingBeforeRegularize(contract);
  return (
    <div className="space-y-4">
      {missing.length > 0 ? (
        <div role="status" className="text-sm space-y-1">
          <p className="font-medium">Complete as partes acima antes de regularizar:</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {mode === "stale" ? (
        <RecognizeForm
          contractId={contract.id}
          revision={state.record?.revision ?? null}
          allowed={canCreate}
          rebase
        />
      ) : state.record ? (
        <LegacyRegularizeForm
          contractId={contract.id}
          revision={state.record.revision}
          evidence={state.evidence}
          allowed={canApprove}
          blockedByMissing={missing.length > 0}
        />
      ) : null}
    </div>
  );
}

function RecognizeForm({
  contractId,
  revision,
  allowed,
  rebase = false,
}: {
  contractId: string;
  revision: number | null;
  allowed: boolean;
  rebase?: boolean;
}) {
  const qc = useQueryClient();
  const recognize = useServerFn(recognizeContractLegacy);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [op, setOp] = useState(() => crypto.randomUUID());
  async function submit() {
    setBusy(true);
    try {
      await recognize({
        data: { contractId, expectedRevision: revision, reason, operationId: op },
      });
      toast.success(
        rebase ? "Revisão do documento registrada." : "Contrato reconhecido como legado.",
      );
      setOp(crypto.randomUUID());
      await qc.invalidateQueries({ queryKey: ["contract-legacy", contractId] });
    } catch (e) {
      // Mantém o mesmo identificador: repetir é seguro (replay idempotente).
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {rebase
          ? "O documento mudou depois do reconhecimento. Registre a revisão; evidências anteriores deixam de valer."
          : "Use apenas para contratos antigos já assinados fora do sistema. Não cria cotação, proposta, minuta ou assinatura."}
      </p>
      <Label htmlFor="legacy-reason">Motivo</Label>
      <Textarea
        id="legacy-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={2000}
        disabled={!allowed || busy}
      />
      <Button
        className="w-full"
        disabled={!allowed || busy || reason.trim().length < 5}
        title={allowed ? undefined : "Sem permissão"}
        onClick={() => void submit()}
      >
        {busy
          ? "Registrando…"
          : rebase
            ? "Registrar revisão do documento"
            : "Reconhecer contrato legado"}
      </Button>
    </div>
  );
}
