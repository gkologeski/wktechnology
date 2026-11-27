import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Link2, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IsoDatePicker } from "@/components/iso-date-picker";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { readViewAs } from "@/lib/view-as-client";
import { formatDateOnly, formatDateTime } from "@/lib/crm";
import { formatIsoDate } from "@/lib/iso-date";
import {
  createContractAcceptanceLink,
  getContractAcceptance,
  recordContractAcceptance,
  releaseContractAcceptanceBilling,
  revokeContractAcceptance,
  revokeContractAcceptanceLink,
} from "@/lib/contracts/acceptance.functions";

/** Aceite comercial e autorização de faturamento não alteram a evidência de assinatura. */
export function ContractAcceptanceCard({
  contractId,
  role,
  hasUnsavedChanges = false,
}: {
  contractId: string;
  role: string;
  hasUnsavedChanges?: boolean;
}) {
  const permissions = usePermissions();
  const get = useServerFn(getContractAcceptance);
  const record = useServerFn(recordContractAcceptance);
  const createLink = useServerFn(createContractAcceptanceLink);
  const release = useServerFn(releaseContractAcceptanceBilling);
  const revoke = useServerFn(revokeContractAcceptance);
  const revokeLink = useServerFn(revokeContractAcceptanceLink);
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<"record" | "release" | "revoke" | null>(null);
  const [clientName, setClientName] = useState("");
  const [acceptedAt, setAcceptedAt] = useState("");
  const [evidence, setEvidence] = useState("");
  const [reason, setReason] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reviewedHash, setReviewedHash] = useState("");
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const viewAllowed =
    !permissions.isLoading &&
    !permissions.isError &&
    !!permissions.workspaceId &&
    ["own", "team", "workspace"].some((s) => permissions.can(`techcontracts.contracts.view.${s}`));
  const writable =
    viewAllowed && !hasUnsavedChanges && !readViewAs()?.readOnly && readViewAs()?.mode !== "role";
  const q = useQuery({
    queryKey: ["contract-acceptance", permissions.workspaceId, contractId],
    queryFn: () => get({ data: { contractId } }),
    enabled: viewAllowed && role === "provider",
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
  if (role !== "provider" || !viewAllowed) return null;
  const d = q.data;
  const canRecord =
    writable &&
    !!d?.canRecord &&
    permissions.can("techcontracts.contract_acceptance.approve.workspace");
  const canManage =
    writable &&
    !!d?.canManageLinks &&
    permissions.can("techcontracts.contract_acceptance.manage.workspace");
  const canRelease =
    writable &&
    !!d?.canReleaseBilling &&
    permissions.can("techcontracts.contract_acceptance_billing.manage.workspace") &&
    permissions.can("techservice.billing.manage.workspace") &&
    ["own", "workspace"].some((scope) => permissions.can(`techfinance.entries.create.${scope}`)) &&
    ["own", "workspace"].some((scope) => permissions.can(`techfinance.entries.view.${scope}`));
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["contract-acceptance"] }),
      qc.invalidateQueries({ queryKey: ["contract-services", contractId] }),
      qc.invalidateQueries({ queryKey: ["service"] }),
      qc.invalidateQueries({ queryKey: ["service-entries"] }),
      qc.invalidateQueries({ queryKey: ["services"] }),
      qc.invalidateQueries({ queryKey: ["journey-services"] }),
      qc.invalidateQueries({ queryKey: ["deal-contracting-journey"] }),
    ]);
  };
  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      setDialog(null);
      setReason("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir a operação.");
    } finally {
      setBusy(false);
    }
  };
  const open = (value: "record" | "release" | "revoke") => {
    setReason("");
    setDueDate("");
    setReviewedHash(d?.currentHash ?? "");
    setDialog(value);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Aceite do contrato e faturamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          O aceite confirma as condições do contrato e permite ao Financeiro liberar o faturamento.
          A assinatura do cliente continua registrada separadamente.
        </p>
        {hasUnsavedChanges && (
          <p role="status" className="text-sm text-muted-foreground">
            Salve as alterações do contrato antes de gerar um link, registrar o aceite ou liberar o
            faturamento.
          </p>
        )}
        {q.isLoading ? (
          <p role="status">Carregando aceite…</p>
        ) : q.isError || !d ? (
          <div role="alert" className="space-y-2 text-sm">
            <p>Não foi possível conferir o aceite do contrato.</p>
            <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2" aria-label="Situação do aceite e assinatura">
              <Badge variant={d.accepted ? "secondary" : "outline"}>
                {d.accepted ? "Contrato aceito · versão atual" : "Aceite da versão atual pendente"}
              </Badge>
              <Badge variant="outline">
                {d.signaturePending ? "Assinatura pendente" : "Assinatura registrada"}
              </Badge>
              <Badge variant="outline">
                {d.billingReleased
                  ? "Faturamento liberado pelo aceite"
                  : "Sem liberação pelo aceite vigente"}
              </Badge>
            </div>
            {d.accepted && d.acceptance && (
              <div className="space-y-1 rounded-md bg-muted/40 p-3 text-sm">
                <p>
                  <Check className="mr-1 inline h-4 w-4 text-primary" aria-hidden />
                  Aceito por {d.acceptance.clientName} em {formatDateOnly(d.acceptance.acceptedAt)}.
                </p>
                <p className="text-xs text-muted-foreground">
                  {d.acceptance.source === "public"
                    ? "Confirmado pelo link de aceite"
                    : "Aceite recebido e registrado pela equipe"}
                  {" · "}Registrado em {formatDateTime(d.acceptance.recordedAt)}.
                </p>
                {d.acceptance.evidence && (
                  <p className="whitespace-pre-wrap text-xs">{d.acceptance.evidence}</p>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {!d.accepted && canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const created = await createLink({ data: { contractId } });
                      setLink({
                        url: new URL(created.path, window.location.origin).href,
                        expiresAt: created.expiresAt,
                      });
                    }, "Link de aceite criado. Compartilhe com o cliente após conferir o documento.")
                  }
                >
                  <Link2 className="mr-1.5 h-4 w-4" aria-hidden /> Gerar link de aceite
                </Button>
              )}
              {!d.accepted && canRecord && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => open("record")}>
                  Registrar aceite recebido
                </Button>
              )}
              {!d.accepted && canManage && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await revokeLink({ data: { contractId } });
                      setLink(null);
                    }, "Links de aceite pendentes revogados.")
                  }
                >
                  Revogar links pendentes
                </Button>
              )}
              {d.accepted && !d.billingReleased && canRelease && (
                <Button size="sm" disabled={busy} onClick={() => open("release")}>
                  <Receipt className="mr-1.5 h-4 w-4" aria-hidden /> Liberar faturamento
                </Button>
              )}
              {d.accepted && canRecord && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => open("revoke")}>
                  Revogar aceite
                </Button>
              )}
            </div>
            {d.releaseBlocked && !d.billingReleased && (
              <p className="text-xs text-muted-foreground" role="status">
                {d.releaseBlocked}
              </p>
            )}
            {d.accepted && !d.billingReleased && !canRelease && !d.releaseBlocked && (
              <p className="text-xs text-muted-foreground">
                O Financeiro autorizado precisa conferir as condições e liberar o faturamento.
              </p>
            )}
            {d.history.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer font-medium">
                  Histórico de aceites ({d.history.length})
                </summary>
                <ul className="mt-2 space-y-3 border-l border-border pl-3">
                  {d.history.map((item) => (
                    <li key={item.id}>
                      <p>
                        {item.clientName} · {formatDateOnly(item.acceptedAt)} ·{" "}
                        {item.source === "public" ? "Link do cliente" : "Registro da equipe"}
                      </p>
                      {item.recordedByName && (
                        <p className="text-muted-foreground">
                          Registrado por {item.recordedByName} em {formatDateTime(item.recordedAt)}
                        </p>
                      )}
                      <p className="text-muted-foreground">
                        {item.revokedAt
                          ? `Revogado em ${formatDateTime(item.revokedAt)}: ${item.revokeReason}`
                          : item.contentHash === d.currentHash
                            ? "Versão atual"
                            : "Versão anterior; não libera a versão atual"}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {link && (
              <div className="space-y-2 rounded-md border p-3">
                <Label htmlFor={`contract-acceptance-link-${contractId}`}>
                  Link de aceite da versão atual
                </Label>
                <div className="flex gap-2">
                  <Input id={`contract-acceptance-link-${contractId}`} value={link.url} readOnly />
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Copiar link de aceite"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(link.url);
                        toast.success("Link copiado.");
                      } catch {
                        toast.error("Selecione e copie o link exibido.");
                      }
                    }}
                  >
                    <Copy className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Expira em {formatDateTime(link.expiresAt)}.
                </p>
                {canManage && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await revokeLink({ data: { contractId } });
                        setLink(null);
                      }, "Link de aceite revogado.")
                    }
                  >
                    Revogar link de aceite
                  </Button>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Alterações no documento exigem novo aceite. Concluir um serviço não confirma aceite
              nem assinatura; liberar faturamento não registra pagamento. Revogar o aceite não
              cancela títulos já gerados, que devem ser conferidos pelo Financeiro.
            </p>
          </>
        )}
      </CardContent>
      <Dialog open={dialog !== null} onOpenChange={(value) => !value && !busy && setDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialog === "record"
                ? "Registrar aceite recebido"
                : dialog === "release"
                  ? "Liberar faturamento pelo aceite"
                  : "Revogar aceite do contrato"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "record"
                ? "Use somente para um aceite que o cliente já confirmou. Informe a data real e a comprovação. Isso não registra uma assinatura."
                : dialog === "release"
                  ? "Confirme as condições para gerar as contas a receber uma única vez. O aceite e a assinatura permanecem separados."
                  : "A revogação preserva o histórico e não cancela cobranças já geradas. O Financeiro deve conferir os lançamentos existentes."}
            </DialogDescription>
          </DialogHeader>
          {dialog === "record" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="contract-acceptance-name">Quem confirmou pelo cliente</Label>
                <Input
                  id="contract-acceptance-name"
                  value={clientName}
                  maxLength={200}
                  onChange={(e) => setClientName(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contract-acceptance-date">Data do aceite</Label>
                <IsoDatePicker
                  id="contract-acceptance-date"
                  ariaLabel="Data do aceite"
                  value={acceptedAt}
                  onChange={(v) => setAcceptedAt(v ?? "")}
                  max={formatIsoDate(new Date())}
                  required
                  disabled={busy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contract-acceptance-evidence">Comprovação do aceite</Label>
                <Textarea
                  id="contract-acceptance-evidence"
                  value={evidence}
                  maxLength={4000}
                  onChange={(e) => setEvidence(e.target.value)}
                  disabled={busy}
                  placeholder="Descreva o e-mail, mensagem ou documento em que o cliente confirmou o contrato."
                />
              </div>
            </>
          )}
          {dialog === "release" && (
            <div className="space-y-2">
              <Label htmlFor="contract-acceptance-due">Vencimento acordado (opcional)</Label>
              <IsoDatePicker
                id="contract-acceptance-due"
                ariaLabel="Vencimento acordado"
                value={dueDate}
                onChange={(v) => setDueDate(v ?? "")}
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">
                Para parcela única. Sem alteração, seguem as condições de pagamento do contrato.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="contract-acceptance-reason">
              {dialog === "revoke"
                ? "Motivo da revogação"
                : dialog === "record"
                  ? "Observação para o histórico (opcional)"
                  : "Motivo da liberação"}
            </Label>
            <Textarea
              id="contract-acceptance-reason"
              value={reason}
              maxLength={2000}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
            />
            {dialog !== "record" && (
              <p className="text-xs text-muted-foreground">Mínimo de 10 caracteres.</p>
            )}
          </div>
          {reviewedHash && reviewedHash !== d?.currentHash && (
            <p role="alert" className="text-sm text-destructive">
              O documento mudou durante esta conferência. Feche esta janela e revise a versão atual
              antes de confirmar.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              disabled={
                busy ||
                !reviewedHash ||
                reviewedHash !== d?.currentHash ||
                (dialog !== "record" && reason.trim().length < 10) ||
                (dialog === "record" &&
                  (!acceptedAt || clientName.trim().length < 3 || evidence.trim().length < 10))
              }
              onClick={() =>
                void run(
                  async () => {
                    if (dialog === "record")
                      await record({
                        data: {
                          contractId,
                          expectedHash: reviewedHash,
                          acceptedAt,
                          clientName: clientName.trim(),
                          evidence: evidence.trim(),
                          ...(reason.trim() ? { reason: reason.trim() } : {}),
                        },
                      });
                    else if (dialog === "release")
                      await release({
                        data: {
                          contractId,
                          expectedHash: reviewedHash,
                          ...(dueDate ? { dueDate } : {}),
                          reason: reason.trim(),
                        },
                      });
                    else if (dialog === "revoke")
                      await revoke({ data: { contractId, reason: reason.trim() } });
                  },
                  dialog === "record"
                    ? "Aceite do contrato registrado. Assinatura permanece separada."
                    : dialog === "release"
                      ? "Faturamento liberado. Confira as contas a receber geradas."
                      : "Aceite revogado e histórico preservado.",
                )
              }
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              {dialog === "record"
                ? "Confirmar aceite recebido"
                : dialog === "release"
                  ? "Confirmar liberação do faturamento"
                  : "Confirmar revogação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
