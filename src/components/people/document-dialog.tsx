// Dialog para adicionar/editar documento de pessoa (TechPeople).
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import {
  upsertPersonDocument,
  createDocumentUpload,
  type PeopleDocumentRow,
} from "@/lib/people/documents.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  personId: string;
  document?: PeopleDocumentRow | null;
};

const DOC_TYPE_SUGGESTIONS = [
  "RG",
  "CPF",
  "CNH",
  "Contrato Social",
  "Cartão CNPJ",
  "Certidão Negativa",
  "Comprovante de endereço",
  "Contrato de prestação",
  "NDA",
];

export function PersonDocumentDialog({ open, onOpenChange, personId, document }: Props) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertPersonDocument);
  const uploadFn = useServerFn(createDocumentUpload);

  const [docType, setDocType] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setDocType(document?.doc_type ?? "");
      setDocNumber(document?.doc_number ?? "");
      setIssuedAt(document?.issued_at ?? "");
      setExpiresAt(document?.expires_at ?? "");
      setNotes(document?.notes ?? "");
      setFileName(document?.file_name ?? null);
      setFilePath(document?.file_url ?? null);
    }
  }, [open, document]);

  async function uploadFile(file: File) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo maior que 20 MB");
      return;
    }
    setUploading(true);
    try {
      const { path, token } = await uploadFn({
        data: { person_id: personId, file_name: file.name },
      });
      const { error } = await supabase.storage
        .from("people-documents")
        .uploadToSignedUrl(path, token, file);
      if (error) throw error;
      setFilePath(path);
      setFileName(file.name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  const mut = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: document?.id ?? null,
          person_id: personId,
          doc_type: docType.trim(),
          doc_number: docNumber || null,
          issued_at: issuedAt || null,
          expires_at: expiresAt || null,
          file_url: filePath,
          file_name: fileName,
          is_sensitive: true,
          notes: notes || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["person-docs", personId] });
      qc.invalidateQueries({ queryKey: ["people-docs-expiring"] });
      toast.success(document ? "Documento atualizado" : "Documento adicionado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{document ? "Editar documento" : "Novo documento"}</DialogTitle>
          <DialogDescription>
            Documentos são privados e visíveis apenas para administradores do workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Input
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              list="doc-type-suggestions"
              placeholder="Ex.: RG, Contrato Social..."
            />
            <datalist id="doc-type-suggestions">
              {DOC_TYPE_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Número</Label>
              <Input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Emissão</Label>
              <Input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Validade</Label>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Deixe em branco se o documento não tem validade. Alerta automático 30 dias antes.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Arquivo</Label>
            <div className="flex items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span>{uploading ? "Enviando..." : "Selecionar arquivo"}</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadFile(f);
                    e.target.value = "";
                  }}
                  disabled={uploading}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPickerOpen(true)}
                disabled={uploading}
              >
                <FolderOpen className="mr-2 h-4 w-4" /> Centro de Arquivos
              </Button>
              {fileName ? (
                <span className="truncate text-xs text-muted-foreground">{fileName}</span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">PDF, imagem ou Word. Até 20 MB.</p>
          </div>

          <FileCenterPickerDialog
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            multiple={false}
            onPicked={async (files) => {
              if (files[0]) await uploadFile(files[0]);
            }}
          />

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !docType.trim() || uploading}
          >
            {mut.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
