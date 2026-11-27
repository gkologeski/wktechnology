import { usePermissions } from "@/lib/access-control/use-permissions";
import { useWorkCapabilities } from "@/lib/access-control/use-work-capabilities";
import { useCurrentUserId } from "@/hooks/use-current-user-id";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  XCircle,
  RotateCw,
  PlayCircle,
  Clock,
  MessageSquare,
  UserCheck,
  Loader2,
} from "lucide-react";
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
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { readViewAs } from "@/lib/view-as-client";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getContractApprovalSubstitutionContext,
  assumeContractApproval,
  type ContractApprovalSubstitutionContext,
} from "@/lib/contracts/approval-substitution.functions";

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
  commercial_accepted: "Aceite comercial do contrato registrado",
  commercial_acceptance_link_created: "Link de aceite comercial criado",
  commercial_acceptance_link_revoked: "Link de aceite comercial revogado",
  commercial_acceptance_revoked: "Aceite comercial revogado",
  commercial_acceptance_billing_released: "Faturamento liberado pelo aceite comercial",
  service_execution_completed: "Execução do serviço concluída",
  approval_substituted: "Responsabilidade de aprovação assumida",
};

export function ContractApprovalsPanel({ contractId }: { contractId: string }) {
  const qc = useQueryClient();
  const perms = usePermissions();
  const me = useCurrentUserId();
  const parentAccess = useWorkCapabilities("techcontracts.contracts", [contractId]);
  const ready = !!perms.workspaceId && !perms.isLoading && !perms.isError;
  const canReadParent = ready && parentAccess.for(contractId).can_view;
  const permissionSignature = [...(perms.permissions ?? [])].sort().join("|");
  const writable = ready && !readViewAs()?.readOnly && readViewAs()?.mode !== "role";
  const canView =
    canReadParent &&
    perms.canAny([
      "techcontracts.approvals.view.own",
      "techcontracts.approvals.view.team",
      "techcontracts.approvals.view.workspace",
    ]);
  const canViewAudit = canReadParent && perms.can("techcontracts.audit.view.workspace");
  const canManage =
    writable &&
    canView &&
    perms.can("techcontracts.approvals.manage.workspace") &&
    parentAccess.for(contractId).can_update;
  const canApprove = writable && canView && perms.can("techcontracts.approvals.approve.workspace");
  const canSubstitute =
    canManage && canApprove && perms.can("techcontracts.approval_substitution.manage.workspace");
  const list = useServerFn(listContractApprovals);
  const events = useServerFn(listContractEvents);
  const start = useServerFn(startContractApprovals);
  const reset = useServerFn(resetContractApprovals);
  const getSubstitution = useServerFn(getContractApprovalSubstitutionContext);
  const { nameFor } = useWorkspaceMembers();
  const substitution = useQuery({
    queryKey: [
      "contract-approval-substitution",
      perms.workspaceId,
      contractId,
      permissionSignature,
    ],
    queryFn: () => getSubstitution({ data: { contractId } }),
    enabled: canSubstitute,
    staleTime: 0,
    retry: false,
  });

  const approvalQuery = useQuery({
    queryKey: ["contract-approvals", contractId, perms.workspaceId, permissionSignature],
    queryFn: () => list({ data: { contractId } }),
    enabled: canView,
  });

  const eventQuery = useQuery({
    queryKey: ["contract-events", contractId, perms.workspaceId, permissionSignature],
    queryFn: () => events({ data: { contractId } }),
    enabled: canViewAudit,
  });
  // Disabled React Query observers retain cached data; authorization gates the rendering too.
  const approvals = canView && approvalQuery.isSuccess ? (approvalQuery.data ?? []) : [];
  const eventList = canViewAudit && eventQuery.isSuccess ? (eventQuery.data ?? []) : [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["contract-approvals", contractId] });
    qc.invalidateQueries({ queryKey: ["contract-events", contractId] });
    qc.invalidateQueries({ queryKey: ["contract", contractId] });
    qc.invalidateQueries({ queryKey: ["contract-approval-substitution"] });
    qc.invalidateQueries({ queryKey: ["contract-acceptance"] });
    qc.invalidateQueries({ queryKey: ["deal-contracting-journey"] });
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
    if (
      !(await confirmDialog(
        "Reiniciar abrirá uma nova cadeia. As decisões anteriores serão preservadas no histórico. Continuar?",
      ))
    )
      return;
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
            {canView &&
              (approvals.length === 0 ? (
                <Button size="sm" onClick={handleStart} disabled={!canManage}>
                  <PlayCircle className="h-4 w-4 mr-2" /> Iniciar fluxo
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={handleReset} disabled={!canManage}>
                  <RotateCw className="h-4 w-4 mr-2" /> Reiniciar
                </Button>
              ))}
          </div>
        </CardHeader>
        <CardContent>
          {canSubstitute && substitution.isError && (
            <div className="mb-3 space-y-2 text-sm" role="alert">
              <p>Não foi possível conferir a substituição dos aprovadores.</p>
              <Button size="sm" variant="outline" onClick={() => void substitution.refetch()}>
                Tentar novamente
              </Button>
            </div>
          )}
          {!canView ? (
            <p className="text-sm text-muted-foreground">
              Você não tem permissão para consultar as aprovações deste contrato.
            </p>
          ) : approvalQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : approvalQuery.isError ? (
            <div role="alert" className="space-y-2 text-sm">
              <p>Não foi possível carregar as aprovações.</p>
              <Button size="sm" variant="outline" onClick={() => void approvalQuery.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : approvals.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              Nenhum fluxo de aprovação iniciado. As etapas serão criadas automaticamente conforme o
              tipo do contrato.
            </div>
          ) : (
            <div className="space-y-2">
              {(approvals as any[]).map((a, idx) => (
                <ApprovalRow
                  key={a.id}
                  approval={a}
                  index={idx}
                  canDecide={
                    canApprove &&
                    (!a.approver_id || a.approver_id === me) &&
                    (approvals as any[]).slice(0, idx).every((p) => p.status === "approved") &&
                    !(approvals as any[]).some((p) => p.status === "rejected")
                  }
                  onDecide={invalidate}
                  nameFor={nameFor}
                  substitution={
                    canSubstitute && substitution.isSuccess && substitution.data.canAssume
                      ? (substitution.data.approvals.find((item) => item.id === a.id) ?? null)
                      : null
                  }
                  contractId={contractId}
                />
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
          {!canViewAudit ? (
            <p className="text-sm text-muted-foreground">
              Você não tem permissão para consultar o histórico deste contrato.
            </p>
          ) : eventQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando histórico…</p>
          ) : eventQuery.isError ? (
            <div role="alert" className="space-y-2 text-sm">
              <p>Não foi possível carregar o histórico do contrato.</p>
              <Button size="sm" variant="outline" onClick={() => void eventQuery.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : eventList.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              Nenhum evento registrado ainda.
            </div>
          ) : (
            <ol className="relative border-l border-border pl-5 space-y-3">
              {(eventList as any[]).map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[27px] top-1 w-3 h-3 rounded-full bg-primary/70" />
                  <div className="text-sm font-medium">
                    {EVENT_LABEL[e.event_type] ?? e.event_type}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(e.created_at)} · {nameFor(e.actor_id)}
                    {e.payload?.stage
                      ? ` · ${STAGE_LABEL[e.payload.stage] ?? e.payload.stage}`
                      : ""}
                  </div>
                  {e.payload?.comment && (
                    <div className="text-xs mt-1 rounded-md bg-muted/50 p-2 flex gap-2">
                      <MessageSquare className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                      <span>{e.payload.comment}</span>
                    </div>
                  )}
                  {e.event_type === "approval_substituted" && (
                    <div className="mt-1 space-y-1 rounded-md bg-muted/50 p-2 text-xs">
                      <p>
                        Responsável anterior: {nameFor(e.payload?.previous_approver_id)}. Novo
                        responsável: {nameFor(e.payload?.acting_approver_id)}.
                      </p>
                      {e.payload?.reason && (
                        <p className="whitespace-pre-wrap">{e.payload.reason}</p>
                      )}
                      <p className="text-muted-foreground">
                        A substituição preservou a decisão pendente.
                      </p>
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
  canDecide,
  substitution,
  contractId,
}: {
  canDecide: boolean;
  approval: any;
  index: number;
  onDecide: () => void;
  nameFor: (id: string | null | undefined) => string;
  contractId: string;
  substitution: ContractApprovalSubstitutionContext["approvals"][number] | null;
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
            <div className="font-medium text-sm">
              {STAGE_LABEL[approval.stage] ?? approval.stage}
            </div>
            <div className="text-xs text-muted-foreground">
              {approval.decided_at ? (
                <>
                  {approval.status === "approved" ? "Aprovado por " : "Rejeitado por "}
                  {nameFor(approval.decided_by)} · {formatDateTime(approval.decided_at)}
                </>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Aguardando decisão · Responsável:{" "}
                  {nameFor(approval.approver_id)}
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
          {substitution?.canAssume && (
            <AssumeApprovalButton
              contractId={contractId}
              approvalId={approval.id}
              stage={STAGE_LABEL[approval.stage] ?? approval.stage}
              currentApproverId={substitution.approverId}
              currentApproverName={substitution.approverName ?? nameFor(substitution.approverId)}
              onAssumed={onDecide}
            />
          )}
          {substitution?.orderBlockedReason && (
            <p className="text-xs text-muted-foreground">{substitution.orderBlockedReason}</p>
          )}
          <Textarea
            disabled={!canDecide}
            placeholder="Comentário (obrigatório para rejeição)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => submit("rejected")}
              disabled={saving || !canDecide}
            >
              <XCircle className="h-4 w-4 mr-2" /> Rejeitar
            </Button>
            <Button size="sm" onClick={() => submit("approved")} disabled={saving || !canDecide}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Aprovar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AssumeApprovalButton({
  contractId,
  approvalId,
  stage,
  currentApproverId,
  currentApproverName,
  onAssumed,
}: {
  contractId: string;
  approvalId: string;
  stage: string;
  currentApproverId: string | null;
  currentApproverName: string;
  onAssumed: () => void;
}) {
  const assume = useServerFn(assumeContractApproval);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState<{ id: string | null; name: string } | null>(null);
  const stale = !!reviewed && reviewed.id !== currentApproverId;
  const submit = async () => {
    if (!reviewed || stale || reason.trim().length < 10) return;
    setBusy(true);
    try {
      await assume({
        data: { contractId, approvalId, expectedApproverId: reviewed.id, reason: reason.trim() },
      });
      toast.success(
        "Responsabilidade assumida. Confira a etapa e registre sua decisão em Aprovar ou Rejeitar.",
      );
      setOpen(false);
      setReason("");
      onAssumed();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível assumir a aprovação.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setReviewed({ id: currentApproverId, name: currentApproverName });
          setReason("");
          setOpen(true);
        }}
      >
        <UserCheck className="mr-1.5 h-4 w-4" aria-hidden />
        Assumir aprovação
      </Button>
      <Dialog open={open} onOpenChange={(value) => !busy && setOpen(value)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assumir aprovação · {stage}</DialogTitle>
            <DialogDescription>
              Você assumirá a responsabilidade desta etapa. A decisão ficará registrada no seu nome.
              A aprovação não será registrada automaticamente; depois, use Aprovar ou Rejeitar.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            Responsável atual: <strong>{reviewed?.name}</strong>.
          </p>
          <div className="space-y-2">
            <Label htmlFor={`approval-assumption-reason-${approvalId}`}>
              Motivo da substituição
            </Label>
            <Textarea
              id={`approval-assumption-reason-${approvalId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={4000}
              disabled={busy}
              placeholder="Informe por que você assumirá esta aprovação."
            />
            <p className="text-xs text-muted-foreground">
              Mínimo de 10 caracteres. O responsável anterior, seu usuário e o motivo ficam no
              histórico.
            </p>
          </div>
          {stale && (
            <p role="alert" className="text-sm text-destructive">
              O responsável mudou durante a conferência. Feche a janela e confira a atribuição
              atual.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={busy || stale || reason.trim().length < 10}
              onClick={() => void submit()}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}Confirmar que
              vou assumir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
