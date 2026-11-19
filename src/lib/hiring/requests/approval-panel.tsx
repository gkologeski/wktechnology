import { useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormSection, ListPageSkeleton } from "@/components/techhire/ui";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useSharedAction } from "@/lib/access-control/use-shared-action";
import {
  getPreparationApproval,
  requestPreparationApproval,
  decidePreparationApproval,
} from "./approvals.functions";
import { approvalLabels, approvalEventLabels } from "./approval-types";
import { resourceFor, type RequestKind, type PreparationRow } from "./types";
import { readViewAs } from "@/lib/view-as-client";

export function ApprovalPanel({
  kind,
  row,
  dirty,
  busy,
  history = false,
}: {
  kind: RequestKind;
  row: PreparationRow;
  dirty: boolean;
  busy: boolean;
  history?: boolean;
}) {
  const p = usePermissions(),
    qc = useQueryClient();
  const canView = useSharedAction(resourceFor(kind), "view");
  const canRequest =
    canView &&
    !readViewAs()?.readOnly &&
    p.can(resourceFor(kind) + ".approval_request.create.workspace");
  const canDecide =
    canView && !readViewAs()?.readOnly && p.can(resourceFor(kind) + ".approval.approve.workspace");
  const get = useServerFn(getPreparationApproval),
    request = useServerFn(requestPreparationApproval),
    decide = useServerFn(decidePreparationApproval);
  const [offset, setOffset] = useState(0),
    [note, setNote] = useState("");
  const pending = useRef<{ fingerprint: string; operation: string } | null>(null);
  const query = useQuery({
    queryKey: ["preparation-approval", p.workspaceId, kind, row.id, row.revision, offset],
    enabled: canView,
    queryFn: () => get({ data: { kind, id: row.id, offset } }),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: async (decision: "approved" | "rejected" | "request") => {
      const current = query.data;
      if (!current || dirty || busy)
        throw new Error("Salve ou descarte as alterações antes de decidir.");
      const input = { kind, id: row.id, revision: row.revision };
      if (decision === "request") return request({ data: input });
      if (!current.approval_id || !current.stage) throw new Error("Recarregue a aprovação.");
      const fingerprint = JSON.stringify([current.approval_id, current.stage, decision, note]);
      if (pending.current?.fingerprint !== fingerprint)
        pending.current = { fingerprint, operation: crypto.randomUUID() };
      const operation = pending.current?.operation;
      if (!operation) throw new Error("Não foi possível preparar a decisão.");
      return decide({
        data: {
          ...input,
          approval: current.approval_id,
          stage: current.stage,
          decision,
          note,
          operation,
        },
      });
    },
    onSuccess: () => {
      pending.current = null;
      setNote("");
      void qc.invalidateQueries({ queryKey: ["preparation-approval"] });
    },
  });
  if (!canView) return null;
  if (query.isLoading) return <ListPageSkeleton />;
  if (query.isError)
    return (
      <div role="alert" className="space-y-2 text-sm">
        Aprovações indisponíveis. Verifique o acesso ou a disponibilidade deste lote.{" "}
        <Button variant="outline" onClick={() => void query.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  const data = query.data;
  if (!data) return null;
  if (history)
    return (
      <FormSection title="Histórico de aprovação">
        {data.events.length ? (
          <ol className="space-y-3">
            {data.events.slice(0, 50).map((e) => (
              <li key={e.id} className="border-b py-2 text-sm">
                <strong>
                  {approvalEventLabels[e.kind]} · Revisão {e.revision}
                  {e.stage ? ` · ${e.stage === "manager" ? "Gestor" : "CEO"}` : ""}
                </strong>
                {e.note && <p className="whitespace-pre-wrap break-words">{e.note}</p>}
                <p className="text-muted-foreground break-words">
                  {new Date(e.created_at).toLocaleString("pt-BR")} · Autor {e.actor_id}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma decisão registrada.</p>
        )}
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!offset}
            onClick={() => setOffset(Math.max(0, offset - 50))}
          >
            Mais recente
          </Button>
          <Button
            variant="outline"
            disabled={data.events.length <= 50}
            onClick={() => setOffset(offset + 50)}
          >
            Mais antigo
          </Button>
        </div>
      </FormSection>
    );
  const locked =
    dirty ||
    busy ||
    mutation.isPending ||
    query.isFetching ||
    data.request.revision !== row.revision;
  return (
    <section aria-label="Aprovação da solicitação" className="space-y-3 text-sm">
      <h3 className="font-semibold">{approvalLabels[data.status]}</h3>
      <p className="break-words">Gestor: {data.manager_id ?? "Não configurado"}</p>
      <p className="break-words">CEO: {data.ceo_id ?? "Não configurado"}</p>
      {data.stage && <p>Etapa atual: {data.stage === "manager" ? "Gestor" : "CEO"}</p>}
      {data.problem && (
        <p role="status" className="text-muted-foreground">
          {data.problem}
        </p>
      )}
      {dirty && (
        <p role="status">Existem alterações não salvas. Salve antes de solicitar ou decidir.</p>
      )}
      {canRequest && (
        <Button
          className="w-full whitespace-normal h-auto min-h-10"
          disabled={locked || !data.can_request}
          onClick={() => mutation.mutate("request")}
        >
          Solicitar aprovação
        </Button>
      )}
      {canDecide && data.can_decide && (
        <>
          <Label htmlFor="approval-note">Motivo da decisão</Label>
          <Textarea
            id="approval-note"
            value={note}
            maxLength={2000}
            disabled={locked}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={locked || note.trim().length < 5}
              onClick={() => mutation.mutate("approved")}
            >
              Aprovar
            </Button>
            <Button
              variant="destructive"
              disabled={locked || note.trim().length < 5}
              onClick={() => mutation.mutate("rejected")}
            >
              Rejeitar
            </Button>
          </div>
        </>
      )}
      {mutation.isPending && <p role="status">Registrando…</p>}
      {mutation.isError && (
        <div role="alert" className="text-destructive break-words">
          {mutation.error.message}
          <Button variant="outline" onClick={() => void query.refetch()}>
            Recarregar aprovação
          </Button>
        </div>
      )}
      <p className="text-muted-foreground">
        Aprovação não cria contratação, vaga, contrato ou pagamento.
      </p>
    </section>
  );
}
