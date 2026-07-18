import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, XCircle, RotateCw, PlayCircle, Clock, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  listContractApprovals,
  listContractEvents,
  startContractApprovals,
  decideContractApproval,
  resetContractApprovals,
} from "@/lib/contract-approvals.functions";
import { formatDateTime } from "@/lib/crm";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";

const STAGE_LABEL: Record<string, string> = {
  legal: "Jurídico",
  finance: "Financeiro",
  purchasing: "Compras",
};

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  approved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  rejected: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  skipped: "bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  skipped: "Ignorado",
};

const EVENT_LABEL: Record<string, string> = {
  approvals_started: "Fluxo de aprovação iniciado",
  approvals_reset: "Fluxo de aprovação reiniciado",
  approval_approved: "Etapa aprovada",
  approval_rejected: "Etapa rejeitada",
};

export function ContractApprovalsPanel({ contractId }: { contractId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listContractApprovals);
  const events = useServerFn(listContractEvents);
  const start = useServerFn(startContractApprovals);
  const reset = useServerFn(resetContractApprovals);
  const { nameFor } = useWorkspaceMembers();

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ["contract-approvals", contractId],
    queryFn: () => list({ data: { contractId } }),
  });

  const { data: eventList = [] } = useQuery({
    queryKey: ["contract-events", contractId],
    queryFn: () => events({ data: { contractId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["contract-approvals", contractId] });
    qc.invalidateQueries({ queryKey: ["contract-events", contractId] });
    qc.invalidateQueries({ queryKey: ["contract", contractId] });
  };

  const handleStart = async () => {
    try {
      await start({ data: { contractId } });
      toast.success("Fluxo de aprovação iniciado");
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao iniciar aprovação");
    }
  };

  const handleReset = async () => {
    if (!confirm("Reiniciar o fluxo de aprovação removerá as decisões atuais. Continuar?")) return;
    try {
      await reset({ data: { contractId } });
      toast.success("Fluxo reiniciado");
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Aprovações</CardTitle>
          <div className="flex gap-2">
            {approvals.length === 0 ? (
              <Button size="sm" onClick={handleStart}>
                <PlayCircle className="h-4 w-4 mr-2" /> Iniciar fluxo
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={handleReset}>
                <RotateCw className="h-4 w-4 mr-2" /> Reiniciar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : approvals.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              Nenhum fluxo de aprovação iniciado. As etapas serão criadas automaticamente conforme o tipo do contrato.
            </div>
          ) : (
            <div className="space-y-2">
              {(approvals as any[]).map((a, idx) => (
                <ApprovalRow key={a.id} approval={a} index={idx} onDecide={invalidate} nameFor={nameFor} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Histórico do contrato</CardTitle>
        </CardHeader>
        <CardContent>
          {eventList.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Nenhum evento registrado ainda.</div>
          ) : (
            <ol className="relative border-l border-border pl-5 space-y-3">
              {(eventList as any[]).map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[27px] top-1 w-3 h-3 rounded-full bg-primary/70" />
                  <div className="text-sm font-medium">{EVENT_LABEL[e.event_type] ?? e.event_type}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(e.created_at)} · {nameFor(e.actor_id)}
                    {e.payload?.stage ? ` · ${STAGE_LABEL[e.payload.stage] ?? e.payload.stage}` : ""}
                  </div>
                  {e.payload?.comment && (
                    <div className="text-xs mt-1 rounded-md bg-muted/50 p-2 flex gap-2">
                      <MessageSquare className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                      <span>{e.payload.comment}</span>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ApprovalRow({
  approval,
  index,
  onDecide,
  nameFor,
}: {
  approval: any;
  index: number;
  onDecide: () => void;
  nameFor: (id: string | null | undefined) => string;
}) {
  const decide = useServerFn(decideContractApproval);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const isPending = approval.status === "pending";

  const submit = async (decision: "approved" | "rejected") => {
    if (decision === "rejected" && !comment.trim()) {
      toast.error("Informe o motivo da rejeição");
      return;
    }
    setSaving(true);
    try {
      await decide({
        data: { approvalId: approval.id, decision, comment: comment.trim() || undefined },
      });
      toast.success(decision === "approved" ? "Etapa aprovada" : "Etapa rejeitada");
      setComment("");
      onDecide();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 shrink-0 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
            {index + 1}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-sm">{STAGE_LABEL[approval.stage] ?? approval.stage}</div>
            <div className="text-xs text-muted-foreground">
              {approval.decided_at ? (
                <>
                  {approval.status === "approved" ? "Aprovado por " : "Rejeitado por "}
                  {nameFor(approval.decided_by)} · {formatDateTime(approval.decided_at)}
                </>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Aguardando decisão
                </span>
              )}
            </div>
          </div>
        </div>
        <Badge variant="outline" className={STATUS_TONE[approval.status]}>
          {STATUS_LABEL[approval.status]}
        </Badge>
      </div>

      {approval.comment && !isPending && (
        <div className="text-xs rounded-md bg-muted/50 p-2 flex gap-2">
          <MessageSquare className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
          <span>{approval.comment}</span>
        </div>
      )}

      {isPending && (
        <div className="space-y-2 pt-1">
          <Textarea
            placeholder="Comentário (obrigatório para rejeição)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => submit("rejected")} disabled={saving}>
              <XCircle className="h-4 w-4 mr-2" /> Rejeitar
            </Button>
            <Button size="sm" onClick={() => submit("approved")} disabled={saving}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Aprovar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
