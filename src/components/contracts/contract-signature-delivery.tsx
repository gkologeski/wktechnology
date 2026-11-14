import { useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getEsignDocument } from "@/lib/esign.functions";
import { sendContractSignatureRequest } from "@/lib/contracts/signature-delivery.functions";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useWorkCapabilities } from "@/lib/access-control/use-work-capabilities";
import { readViewAs } from "@/lib/view-as-client";
import { formatDateTime } from "@/lib/crm";
import { getPublicAppUrl } from "@/lib/app-url";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
const documentStatus: Record<string, string> = {
  draft: "Preparado · ainda não disponibilizado",
  sent: "Disponível para assinatura",
  partially_signed: "Assinado parcialmente",
  completed: "Assinaturas concluídas",
  declined: "Recusado",
  expired: "Expirado",
  canceled: "Cancelado",
};
const signerStatus: Record<string, string> = {
  pending: "Pendente",
  viewed: "Visualizado",
  signed: "Assinado",
  declined: "Recusado",
};
const deliveryStatus: Record<string, string> = {
  pending: "Convite aguardando confirmação de envio",
  accepted: "Convite aceito pelo serviço de e-mail",
  suppressed: "Envio suprimido pelo provedor",
  failed: "Falha no envio do convite",
};
export function ContractSignatureDelivery({
  contractId,
  documentId,
  hash,
  current,
}: {
  contractId: string;
  documentId: string;
  hash: string;
  current: boolean;
}) {
  const p = usePermissions(),
    caps = useWorkCapabilities("techcontracts.esign", [documentId]),
    qc = useQueryClient();
  const get = useServerFn(getEsignDocument),
    send = useServerFn(sendContractSignatureRequest);
  const allowed =
    !p.isLoading &&
    !p.isError &&
    p.canAny([
      "techcontracts.esign.view.own",
      "techcontracts.esign.view.team",
      "techcontracts.esign.view.workspace",
    ]);
  const q = useQuery({
    queryKey: ["esign-doc", p.workspaceId, documentId],
    queryFn: () => get({ data: { id: documentId } }),
    enabled: allowed,
    refetchInterval: 30000,
    staleTime: 0,
    retry: false,
  });
  const [confirm, setConfirm] = useState(false),
    [retry, setRetry] = useState(false);
  const request = useRef<string | null>(null);
  const mutation = useMutation({
    mutationFn: () =>
      send({
        data: {
          contractId,
          documentId,
          hash,
          requestId: request.current ?? (request.current = crypto.randomUUID()),
        },
      }),
    onSuccess: async (r) => {
      setConfirm(false);
      setRetry(r.failed > 0);
      if (!r.failed) request.current = null;
      toast[r.failed || r.suppressed ? "warning" : "success"](
        `${r.accepted} convite(s) aceito(s) para envio; ${r.failed} falha(s); ${r.suppressed} suprimido(s).`,
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["esign-doc"] }),
        qc.invalidateQueries({ queryKey: ["contract-signature", contractId] }),
        qc.invalidateQueries({ queryKey: ["deal-contracting-journey"] }),
        qc.invalidateQueries({ queryKey: ["esign-docs"] }),
      ]);
    },
    onError: (e: Error) => {
      setRetry(true);
      toast.error(e.message);
    },
  });
  if (!allowed)
    return (
      <p className="text-sm text-muted-foreground">
        Solicite acesso à assinatura eletrônica para consultar os signatários.
      </p>
    );
  if (q.isError)
    return (
      <div role="alert" className="space-y-2">
        <p>Não foi possível carregar os signatários e convites.</p>
        <Button variant="outline" onClick={() => q.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  if (!q.data) return <p role="status">Carregando signatários…</p>;
  const { doc, signers, deliveries } = q.data;
  const expired = !!doc.expires_at && new Date(doc.expires_at).getTime() <= Date.now();
  const pending = signers.filter((s) => ["pending", "viewed"].includes(s.status));
  const writable = !readViewAs()?.readOnly && readViewAs()?.mode !== "role";
  const canSend =
    current &&
    writable &&
    caps.for(documentId).can_send &&
    !expired &&
    ["draft", "sent", "partially_signed"].includes(doc.status) &&
    pending.length > 0;
  return (
    <section className="space-y-3 border-t pt-3" aria-label="Envio e acompanhamento de assinaturas">
      <p className="text-sm font-medium">{doc.title}</p>
      <Badge variant="outline">{documentStatus[doc.status] ?? "Consulte o documento"}</Badge>
      {!current && (
        <p role="note" className="text-sm text-muted-foreground">
          Esta evidência foi revogada ou pertence a outra versão. Prepare uma assinatura da versão
          atual para enviar novos convites.
        </p>
      )}
      {expired && (
        <p role="note" className="text-sm text-destructive">
          O prazo de assinatura terminou. Prepare um novo documento antes de enviar.
        </p>
      )}
      <ul className="space-y-2">
        {signers.map((s) => {
          const latest = deliveries?.find((d) => d.signer_id === s.id);
          return (
            <li key={s.id} className="rounded-md border p-3 text-sm">
              <p className="font-medium">
                {s.name} · {signerStatus[s.status] ?? "Consultar"}
              </p>
              <p className="break-all text-muted-foreground">{s.email}</p>
              {s.signed_at && <p>Assinado em {formatDateTime(s.signed_at)}</p>}
              {!s.signed_at && s.viewed_at && <p>Visualizado em {formatDateTime(s.viewed_at)}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                {latest
                  ? `${deliveryStatus[latest.status] ?? "Consultar envio"} · ${formatDateTime(latest.updated_at)}`
                  : "Nenhum convite de e-mail registrado."}
              </p>
              {s.public_token && current && doc.status !== "draft" && (
                <Button
                  size="sm"
                  variant="link"
                  onClick={async () => {
                    await navigator.clipboard.writeText(
                      `${getPublicAppUrl()}/sign/${s.public_token}`,
                    );
                    toast.success("Link pessoal copiado.");
                  }}
                >
                  Copiar link de {s.name}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {canSend && (
        <Button disabled={mutation.isPending} onClick={() => setConfirm(true)}>
          {mutation.isPending
            ? "Enviando convites…"
            : retry
              ? "Tentar envio novamente"
              : doc.status === "draft"
                ? "Enviar para assinatura por e-mail"
                : "Reenviar aos signatários pendentes"}
        </Button>
      )}
      {!canSend &&
        current &&
        !expired &&
        pending.length > 0 &&
        ["draft", "sent", "partially_signed"].includes(doc.status) && (
          <p className="text-xs text-muted-foreground">
            O envio exige permissão de enviar assinaturas e uma sessão com edição.
          </p>
        )}
      <p className="text-xs text-muted-foreground">
        Os convites são pessoais. Aceite pelo serviço de e-mail não comprova entrega na caixa postal
        nem assinatura. Reenvios têm intervalo mínimo de 60 segundos.
      </p>
      <Dialog
        open={confirm}
        onOpenChange={(o) => {
          if (!mutation.isPending) setConfirm(o);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar convites para assinatura?</DialogTitle>
            <DialogDescription>
              Será enviado um link pessoal aos signatários pendentes abaixo. Confirme os
              destinatários e a versão do contrato antes de continuar.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            {pending.map((s) => (
              <li key={s.id}>
                {s.name} · {s.email}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setConfirm(false)}
            >
              Voltar
            </Button>
            <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? "Enviando…" : "Confirmar envio dos convites"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
