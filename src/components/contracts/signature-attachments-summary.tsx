import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Paperclip, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useWorkCapabilities } from "@/lib/access-control/use-work-capabilities";
import { readViewAs } from "@/lib/view-as-client";
import {
  listContractAttachments,
  previewContractSignaturePackage,
  type ContractAttachment,
} from "@/lib/contracts/attachments.functions";
import { Button } from "@/components/ui/button";

export function SignatureAttachmentsSummary({
  contractId,
  canPreviewOverride,
}: {
  contractId: string;
  canPreviewOverride?: boolean;
}) {
  const { user } = useAuth();
  const permissions = usePermissions();
  const access = useWorkCapabilities("techcontracts.contracts", [contractId]);
  const list = useServerFn(listContractAttachments);
  const preview = useServerFn(previewContractSignaturePackage);
  const [opening, setOpening] = useState(false);
  const canView = access.for(contractId).can_view;
  const viewAs = readViewAs();
  const canPreview =
    !viewAs?.readOnly &&
    viewAs?.mode !== "role" &&
    (canPreviewOverride ??
      (access.for(contractId).can_update &&
        permissions.can("techcontracts.signature_evidence.manage.workspace") &&
        permissions.can("techcontracts.signature_evidence.view.workspace")));
  const attachments = useQuery({
    queryKey: [
      "contract-attachments",
      user?.id,
      permissions.workspaceId,
      [...permissions.permissions].sort(),
      contractId,
    ],
    queryFn: () => list({ data: { contractId } }),
    enabled: canView,
    staleTime: 0,
    retry: false,
  });
  const classify = (attachment: ContractAttachment): "external" | "internal" | "pending" => {
    if (attachment.sharing_blocked !== false) return "pending";
    if (attachment.signature_included === true) return "external";
    if (attachment.audience === "internal" && attachment.reviewed_at && attachment.reviewed_by)
      return "internal";
    return "pending";
  };
  const visible = attachments.data ?? [];
  const external = visible.filter((attachment) => classify(attachment) === "external");
  const internal = visible.filter((attachment) => classify(attachment) === "internal");
  const pending = visible.filter((attachment) => classify(attachment) === "pending");

  return (
    <section
      aria-label="Documentos incluídos na assinatura"
      className="space-y-3 rounded-md border p-3"
    >
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <Paperclip className="h-4 w-4 shrink-0" aria-hidden="true" />
        Documentos incluídos na assinatura
      </h3>
      <p className="text-sm text-muted-foreground">
        Contrato salvo e anexos revisados para seu destinatário.
      </p>
      {!canView ? (
        <p role="status" className="text-sm text-muted-foreground">
          Conferindo acesso aos anexos. Se necessário, solicite permissão de leitura do contrato.
        </p>
      ) : attachments.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando anexos…
        </p>
      ) : attachments.isError ? (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>Não foi possível conferir os anexos. Tente novamente antes de continuar.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void attachments.refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : attachments.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum anexo disponível no seu acesso. Confira os documentos na ficha do contrato.
        </p>
      ) : (
        <>
          <p className="text-sm font-medium">
            {external.length} anexo(s) externo(s) conferido(s) no seu acesso
          </p>
          <ul
            aria-label="Anexos que acompanham o contrato"
            className="max-h-48 space-y-2 overflow-y-auto text-sm"
          >
            {external.map((attachment) => (
              <li key={attachment.id} className="min-w-0 rounded-md bg-muted/40 p-2">
                <p className="break-words [overflow-wrap:anywhere]">{attachment.name}</p>
                <p className="text-xs text-muted-foreground">
                  {attachment.kind === "quote"
                    ? "Cotação"
                    : attachment.kind === "proposal"
                      ? "Proposta"
                      : "Arquivo"}
                  {attachment.frozen ? " · Cópia congelada" : ""}
                </p>
              </li>
            ))}
          </ul>
          {internal.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">
                Somente interno · não acompanha a assinatura
              </h4>
              <ul
                className="space-y-1 text-xs text-muted-foreground"
                aria-label="Arquivos internos preservados na ficha"
              >
                {internal.map((attachment) => (
                  <li key={attachment.id}>{attachment.name}</li>
                ))}
              </ul>
            </div>
          )}
          {pending.length > 0 && (
            <div role="alert" className="space-y-2 rounded-md bg-destructive/10 p-3 text-sm">
              <p className="font-medium">Revise o público dos anexos antes do envio.</p>
              <p>
                Na ficha do contrato, um responsável autorizado precisa conferir estes arquivos para
                o cliente ou a prestadora corretos, ou classificá-los expressamente como internos.
              </p>
              <ul className="list-inside list-disc">
                {pending.map((attachment) => (
                  <li key={attachment.id}>{attachment.name} · público pendente ou incompatível</li>
                ))}
              </ul>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto whitespace-normal text-left"
            disabled={opening || !canPreview || pending.length > 0}
            onClick={async () => {
              setOpening(true);
              try {
                const result = await preview({ data: { contractId } });
                window.location.assign(result.url);
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Não foi possível abrir a prévia.",
                );
              } finally {
                setOpening(false);
              }
            }}
          >
            <Eye className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
            {opening ? "Gerando prévia…" : "Baixar prévia do contrato e anexos"}
          </Button>
          {!canPreview && (
            <p className="text-xs text-muted-foreground">
              A prévia exige edição do contrato e permissão para gerenciar evidências de assinatura.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Confira o PDF completo antes de continuar. A assinatura exige validação do público de
            todos os anexos. Arquivos expressamente internos ficam preservados na ficha. A prévia
            congela as versões dos documentos comerciais. Gerar a prévia não envia convites nem
            consome créditos do ForSign.
          </p>
        </>
      )}
    </section>
  );
}
