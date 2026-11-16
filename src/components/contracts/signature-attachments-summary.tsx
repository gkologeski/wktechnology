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
} from "@/lib/contracts/attachments.functions";
import { Button } from "@/components/ui/button";

export function SignatureAttachmentsSummary({ contractId }: { contractId: string }) {
  const { user } = useAuth();
  const permissions = usePermissions();
  const access = useWorkCapabilities("techcontracts.contracts", [contractId]);
  const list = useServerFn(listContractAttachments);
  const preview = useServerFn(previewContractSignaturePackage);
  const [opening, setOpening] = useState(false);
  const canView = access.for(contractId).can_view;
  const viewAs = readViewAs();
  const canPreview =
    access.for(contractId).can_update &&
    permissions.can("techcontracts.signature_evidence.manage.workspace") &&
    permissions.can("techcontracts.signature_evidence.view.workspace") &&
    !viewAs?.readOnly &&
    viewAs?.mode !== "role";
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

  return (
    <section
      aria-label="Documentos incluídos na assinatura"
      className="space-y-3 rounded-md border p-3"
    >
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <Paperclip className="h-4 w-4 shrink-0" aria-hidden="true" />
        Documentos incluídos na assinatura
      </h3>
      <p className="text-sm text-muted-foreground">Contrato salvo e seus anexos.</p>
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
          <Button type="button" variant="outline" size="sm" onClick={() => attachments.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : attachments.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum anexo incluído. Somente o contrato será enviado.
        </p>
      ) : (
        <>
          <p className="text-sm font-medium">{attachments.data.length} anexo(s)</p>
          <ul
            aria-label="Anexos que acompanham o contrato"
            className="max-h-48 space-y-2 overflow-y-auto text-sm"
          >
            {attachments.data.map((attachment) => (
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto whitespace-normal text-left"
            disabled={opening || !canPreview}
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
            Confira o PDF completo antes de continuar. A prévia congela as versões dos documentos
            comerciais. Gerar a prévia não envia convites nem consome créditos do ForSign.
          </p>
        </>
      )}
    </section>
  );
}
