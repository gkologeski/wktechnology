import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ContractSignersEditor, type ParticipantSelection } from "./contract-signers-editor";
import { contractSignersSchema } from "@/lib/contracts/signers";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  getContractForsign,
  sendContractForsign,
  refreshContractForsign,
  cancelContractForsign,
} from "@/lib/integrations/forsign/forsign.functions";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  memberStatusInfo,
  OP_STATUS_PT,
  opStatusTone,
} from "@/lib/integrations/forsign/forsign-core";
import {
  SignatureStatusBadge,
  SignatureStatusIcon,
} from "@/components/contracts/signature-status-indicator";
import { signatureToneInk } from "@/components/contracts/signature-status-tone";
import { SignatureAttachmentsSummary } from "./signature-attachments-summary";

export function ContractForsignPanel({
  contractId,
  hash,
  canManage,
  witnessesDetected,
}: {
  contractId: string;
  hash: string;
  canManage: boolean;
  witnessesDetected?: boolean;
}) {
  const load = useServerFn(getContractForsign);
  const send = useServerFn(sendContractForsign);
  const refresh = useServerFn(refreshContractForsign);
  const cancel = useServerFn(cancelContractForsign);
  const qc = useQueryClient();
  const { can } = usePermissions();
  canManage = canManage && can("techcontracts.forsign.manage.workspace");
  const key = ["contract-forsign", contractId];
  const q = useQuery({
    queryKey: key,
    queryFn: () => load({ data: { contractId } }),
    retry: false,
  });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signers, setSigners] = useState<ParticipantSelection[]>([
    { role: "CONTRATANTE", contact: null },
    { role: "CONTRATADO", contact: null },
  ]);
  const [cancelMsg, setCancelMsg] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      await Promise.all([
        qc.invalidateQueries({ queryKey: key }),
        qc.invalidateQueries({ queryKey: ["contract-signature", contractId] }),
      ]);
      toast.success(ok);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Carregando ForSign…</p>;
  if (q.error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {q.error.message}
      </p>
    );
  const d = q.data;
  if (!d) return null;
  const active = d.operations.find(
    (o) =>
      ["creating", "sent", "partially_signed", "completed", "evidence_recorded"].includes(
        o.status,
      ) && o.contract_hash === hash,
  );
  const allowSend = canManage && d.canSend && d.ready && !active;
  const payload = signers.map((s) => ({
    role: s.role,
    contactId: s.contact?.id ?? "",
    cpf: s.cpf || null,
  }));
  const valid =
    signers.length <= 10 &&
    contractSignersSchema.safeParse(payload).success &&
    signers.every((s) => !!s.contact?.email);

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">ForSign</h3>
        {canManage && d.canSend && (
          <Button size="sm" disabled={busy || !allowSend} onClick={() => setOpen(true)}>
            Enviar pelo ForSign
          </Button>
        )}
      </div>
      {!d.ready && (
        <p className="text-sm text-muted-foreground">
          A integração ForSign não está conectada neste workspace.{" "}
          <Link to="/settings/integrations/forsign" className="underline">
            Configurar
          </Link>
        </p>
      )}
      {d.operations.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum envio ao ForSign.</p>
      ) : (
        <ul className="space-y-2">
          {d.operations.map((o) => (
            <li key={o.id} className="rounded-md border p-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">
                  {o.operation_id ? `Operação ${o.operation_id}` : "Envio"}
                </p>
                <SignatureStatusBadge tone={opStatusTone(o.status)}>
                  {OP_STATUS_PT[o.status]}
                </SignatureStatusBadge>
                {o.contract_hash !== hash && o.status !== "evidence_recorded" && (
                  <SignatureStatusBadge tone="neutral">versão anterior</SignatureStatusBadge>
                )}
                {o.members.length > 0 && (
                  <span className="text-xs tabular-nums text-text-tertiary">
                    {o.members.filter((m) => m.status === "Completed").length} de {o.members.length}{" "}
                    assinaram
                  </span>
                )}
              </div>
              {o.last_error && <p className="text-destructive">{o.last_error}</p>}
              <ul className="mt-2 space-y-1.5">
                {o.members.map((m) => {
                  const s = memberStatusInfo(m);
                  return (
                    <li key={m.email} className="flex items-start gap-2">
                      <SignatureStatusIcon tone={s.tone} />
                      <span className="min-w-0">
                        <span className="font-medium text-text-primary">{m.name}</span>
                        <span className="text-text-secondary"> ({m.role ?? "assinante"})</span>
                        <span className="text-text-secondary">
                          {" — "}
                          <span className={signatureToneInk(s.tone)}>{s.label}</span>
                          {m.completedAt
                            ? ` em ${new Date(m.completedAt).toLocaleString("pt-BR")}`
                            : ""}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              {o.last_synced_at && (
                <p className="text-xs text-muted-foreground">
                  Atualizado em {new Date(o.last_synced_at).toLocaleString("pt-BR")}
                </p>
              )}
              {["sent", "partially_signed", "completed"].includes(o.status) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      act(() => refresh({ data: { operationRowId: o.id } }), "Situação atualizada.")
                    }
                  >
                    Atualizar situação
                  </Button>
                  {canManage && d.canSend && o.status !== "completed" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setCancelId(o.id)}
                    >
                      Cancelar envio
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Enviar pelo ForSign</DialogTitle>
            <DialogDescription>
              O TechERP gera o PDF da versão atual do contrato e o ForSign envia o convite por
              e-mail a cada assinante. Esta ação consome créditos do seu plano ForSign.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <SignatureAttachmentsSummary contractId={contractId} />
            <ContractSignersEditor
              value={signers}
              onChange={setSigners}
              disabled={busy}
              witnessesDetected={witnessesDetected}
              max={10}
              showCpf
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Voltar
              </Button>
              <Button
                disabled={busy || !valid}
                onClick={async () => {
                  const ok = await act(
                    () =>
                      send({
                        data: {
                          contractId,
                          hash,
                          signers: payload,
                        },
                      }),
                    "Contrato enviado ao ForSign.",
                  );
                  if (ok) setOpen(false);
                }}
              >
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelId !== null} onOpenChange={(v) => !v && setCancelId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar envio no ForSign</DialogTitle>
            <DialogDescription>
              Os assinantes não poderão mais assinar. Créditos só voltam se ninguém tiver assinado.
            </DialogDescription>
          </DialogHeader>
          <Label htmlFor="fs-cancel">Motivo (enviado aos assinantes)</Label>
          <Textarea
            id="fs-cancel"
            value={cancelMsg}
            onChange={(e) => setCancelMsg(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCancelId(null)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={busy || cancelMsg.trim().length < 5}
              onClick={async () => {
                const id = cancelId!;
                const ok = await act(
                  () => cancel({ data: { operationRowId: id, message: cancelMsg.trim() } }),
                  "Envio cancelado.",
                );
                if (ok) {
                  setCancelId(null);
                  setCancelMsg("");
                }
              }}
            >
              Cancelar envio
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
