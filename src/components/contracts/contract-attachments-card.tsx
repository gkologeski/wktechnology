import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useWorkCapabilities } from "@/lib/access-control/use-work-capabilities";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Paperclip, Trash2, Upload, Eye } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { QuoteInternalPreview } from "@/components/deals/quote-internal-preview";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  listContractAttachments,
  listContractAttachmentSources,
  linkContractAttachment,
  reserveContractAttachment,
  finishContractAttachment,
  removeContractAttachment,
  downloadContractAttachment,
  previewContractSignaturePackage,
  CONTRACT_ATTACHMENT_MAX_BYTES,
  CONTRACT_ATTACHMENT_TYPES,
} from "@/lib/contracts/attachments.functions";

export function ContractAttachmentsCard({
  contractId,
  canEdit: allowEdit,
}: {
  contractId: string;
  canEdit: boolean;
}) {
  const { user } = useAuth();
  const permissions = usePermissions();
  const access = useWorkCapabilities("techcontracts.contracts", [contractId]);
  const canEdit = allowEdit && access.for(contractId).can_update;
  const list = useServerFn(listContractAttachments),
    sources = useServerFn(listContractAttachmentSources),
    link = useServerFn(linkContractAttachment),
    reserve = useServerFn(reserveContractAttachment),
    finish = useServerFn(finishContractAttachment),
    remove = useServerFn(removeContractAttachment),
    download = useServerFn(downloadContractAttachment),
    preview = useServerFn(previewContractSignaturePackage);
  const qc = useQueryClient(),
    input = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [quote, setQuote] = useState<string | null>(null);
  const key = [
    "contract-attachments",
    user?.id,
    permissions.workspaceId,
    [...permissions.permissions].sort(),
    contractId,
  ];
  const attachments = useQuery({
    queryKey: key,
    queryFn: () => list({ data: { contractId } }),
    enabled: access.for(contractId).can_view,
  });
  const available = useQuery({
    queryKey: [...key, "sources"],
    queryFn: () => sources({ data: { contractId } }),
    enabled: canEdit,
  });
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: key }),
      qc.invalidateQueries({ queryKey: ["contract-signature", contractId] }),
      qc.invalidateQueries({ queryKey: ["contract-forsign", contractId] }),
    ]);
  };
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir a ação.");
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File) {
    if (file.size === 0 || file.size > CONTRACT_ATTACHMENT_MAX_BYTES) {
      toast.error("Escolha um arquivo de até 20 MB, com conteúdo.");
      return;
    }
    if (
      !CONTRACT_ATTACHMENT_TYPES.includes(file.type as (typeof CONTRACT_ATTACHMENT_TYPES)[number])
    ) {
      toast.error("Use PDF, DOCX, XLSX, JPG, PNG ou TXT.");
      return;
    }
    await run(async () => {
      const reservation = await reserve({ data: { contractId, name: file.name } });
      const { error } = await supabase.storage
        .from("contract-attachments")
        .upload(reservation.path, file, { contentType: file.type, upsert: false });
      if (error) {
        await remove({ data: { contractId, id: reservation.id } });
        throw new Error(error.message);
      }
      await finish({ data: { contractId, id: reservation.id } });
      toast.success("Anexo incluído no contrato.");
    });
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Paperclip className="h-4 w-4" />
          Anexos do contrato
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Vincule a cotação ou a proposta do negócio, ou envie outro documento. Vínculos exibem a
          versão atual da origem. Todos os anexos serão incluídos no pacote de assinatura, com a
          versão congelada na preparação do envio.
        </p>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={selected}
              onValueChange={setSelected}
              disabled={busy || available.isPending || !!available.error}
            >
              <SelectTrigger
                className="w-full md:w-80"
                aria-label="Documento comercial para anexar"
              >
                <SelectValue placeholder="Escolher cotação ou proposta" />
              </SelectTrigger>
              <SelectContent>
                {(available.data ?? []).map((s) => (
                  <SelectItem
                    key={s.kind + s.id}
                    value={`${s.kind}:${s.id}`}
                    disabled={attachments.data?.some(
                      (a) => a.kind === s.kind && a.source_id === s.id,
                    )}
                  >
                    {s.kind === "quote" ? "Cotação" : "Proposta"} — {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={!selected || busy}
              onClick={() =>
                void run(async () => {
                  const source = available.data?.find((s) => `${s.kind}:${s.id}` === selected);
                  if (!source) throw new Error("Selecione um documento disponível.");
                  await link({ data: { contractId, kind: source.kind, sourceId: source.id } });
                  setSelected("");
                  toast.success("Documento vinculado.");
                })
              }
            >
              Vincular documento
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              {busy ? "Aguarde…" : "Enviar arquivo"}
            </Button>
            <input
              ref={input}
              type="file"
              className="hidden"
              aria-label="Arquivo para anexar ao contrato"
              accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.txt"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void upload(file);
              }}
            />
          </div>
        )}
        {available.error && canEdit && (
          <p role="alert" className="text-sm text-destructive">
            Não foi possível carregar os documentos comerciais.{" "}
            <Button variant="link" onClick={() => void available.refetch()}>
              Tentar novamente
            </Button>
          </p>
        )}
        {canEdit && available.isSuccess && available.data.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma cotação ou proposta vinculada a este contrato/negócio está disponível no seu
            acesso. Você pode enviar um arquivo.
          </p>
        )}
        {attachments.isPending ? (
          <p role="status">Carregando anexos…</p>
        ) : attachments.error ? (
          <p role="alert">
            Não foi possível carregar os anexos.{" "}
            <Button variant="link" onClick={() => void attachments.refetch()}>
              Tentar novamente
            </Button>
          </p>
        ) : attachments.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum anexo disponível.</p>
        ) : (
          <ul className="divide-y">
            {attachments.data?.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0 break-words text-sm">
                  {a.kind === "quote" ? "Cotação: " : a.kind === "proposal" ? "Proposta: " : ""}
                  {a.name}
                  {a.frozen && (
                    <span className="ml-2 text-xs text-muted-foreground">Cópia congelada</span>
                  )}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  {a.kind === "proposal" && a.source_id && !a.frozen ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/proposals/$id" params={{ id: a.source_id }}>
                        Ver proposta
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        a.kind === "quote" && !a.frozen
                          ? setQuote(a.source_id)
                          : void run(async () => {
                              const result = await download({ data: { contractId, id: a.id } });
                              window.location.assign(result.url);
                            })
                      }
                    >
                      <Eye className="mr-1 h-4 w-4" />
                      {a.frozen
                        ? "Ver cópia anexada"
                        : a.kind === "quote"
                          ? "Ver cotação"
                          : "Baixar"}
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover anexo ${a.name}`}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          if (
                            !(await confirmDialog({
                              title: "Remover anexo?",
                              description:
                                "O vínculo será removido deste contrato. A cotação ou proposta original será preservada.",
                            }))
                          )
                            return;
                          await remove({ data: { contractId, id: a.id } });
                          toast.success("Anexo removido.");
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {canEdit && permissions.can("techcontracts.signature_evidence.manage.workspace") && (
          <Button
            variant="outline"
            disabled={busy || !attachments.data?.length}
            onClick={() =>
              void run(async () => {
                const result = await preview({ data: { contractId } });
                window.location.assign(result.url);
              })
            }
          >
            Baixar prévia para assinatura
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          Até 20 MB por arquivo · PDF, DOCX, XLSX, JPG, PNG e TXT. Acesso privado conforme as
          permissões atuais do contrato e do documento comercial.
        </p>
        <QuoteInternalPreview id={quote} onClose={() => setQuote(null)} />
      </CardContent>
    </Card>
  );
}
