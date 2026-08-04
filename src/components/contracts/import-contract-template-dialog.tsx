// Importação de MODELO de contrato a partir de .docx ou .pdf.
// A IA converte o documento em HTML e substitui os dados das partes por variáveis.
import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  parseContractTemplatePdf,
  parseContractTemplateHtml,
} from "@/lib/contracts/template-import.functions";
import { createContractTemplate } from "@/lib/contracts/templates.functions";
import {
  IDLE_PROGRESS,
  isExtracting,
  progressFor,
  type ExtractionProgress,
} from "@/components/contracts/import-progress";

const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_DOCX_BYTES = 10 * 1024 * 1024;

function fileExt(name: string): "pdf" | "docx" | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  return null;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

async function docxToHtml(file: File): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser");
  const buf = await file.arrayBuffer();
  const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
  return value ?? "";
}

export function ImportContractTemplateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const parsePdf = useServerFn(parseContractTemplatePdf);
  const parseHtml = useServerFn(parseContractTemplateHtml);
  const createTemplate = useServerFn(createContractTemplate);
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [progress, setProgress] = useState<ExtractionProgress>(IDLE_PROGRESS);
  const busy = isExtracting(progress);
  const kind = file ? fileExt(file.name) : null;

  const reset = useCallback(() => {
    setFile(null);
    setName("");
    setProgress(IDLE_PROGRESS);
  }, []);

  const handleClose = useCallback(
    (next: boolean) => {
      if (!next) reset();
      onOpenChange(next);
    },
    [onOpenChange, reset],
  );

  const run = useCallback(async () => {
    if (!file || !kind) return;
    if (kind === "pdf" && file.size > MAX_PDF_BYTES) {
      toast.error("PDF maior que 15 MB. Envie um arquivo menor ou a versão .docx.");
      return;
    }
    if (kind === "docx" && file.size > MAX_DOCX_BYTES) {
      toast.error(".docx maior que 10 MB.");
      return;
    }
    setProgress(progressFor("preparing"));
    try {
      let result: Awaited<ReturnType<typeof parsePdf>>;
      if (kind === "pdf") {
        setProgress(progressFor("text"));
        const b64 = await fileToBase64(file);
        setProgress(progressFor("ai"));
        result = await parsePdf({ data: { filename: file.name, base64: b64 } });
      } else {
        setProgress(progressFor("text"));
        const html = await docxToHtml(file);
        if (html.trim().length < 40) throw new Error("Não foi possível extrair o texto do .docx.");
        setProgress(progressFor("ai"));
        result = await parseHtml({ data: { filename: file.name, html } });
      }

      setProgress(progressFor("draft"));
      const created = await createTemplate({
        data: {
          name: name.trim() || result.name?.trim() || file.name.replace(/\.(pdf|docx)$/i, ""),
          role: result.role ?? undefined,
          service_type: result.service_type ?? null,
          body_html: result.body_html ?? null,
          imported_from: kind,
          status: "draft",
          description: (result.warnings ?? []).join(" · ") || null,
        },
      });
      setProgress(progressFor("done"));
      toast.success("Modelo criado como rascunho. Revise as variáveis sugeridas.");
      handleClose(false);
      navigate({ to: "/contracts/templates/$id", params: { id: created.id } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha na conversão";
      setProgress(progressFor("error", msg));
      toast.error(msg);
    }
  }, [file, kind, name, parsePdf, parseHtml, createTemplate, handleClose, navigate]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Importar modelo de contrato
          </DialogTitle>
          <DialogDescription>
            Envie um .docx ou .pdf. A IA converte o texto e sugere as variáveis automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Nome do modelo (opcional)</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Prestação de serviços — Outsourcing"
              disabled={busy}
            />
          </div>

          {file ? (
            <div className="flex items-center justify-between gap-2 rounded-md border p-3">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm">{file.name}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remover arquivo"
                onClick={() => setFile(null)}
                disabled={busy}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed p-6 text-center transition-colors hover:border-primary/40 focus-within:ring-2 focus-within:ring-ring">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Escolher arquivo</span>
              <span className="text-xs text-muted-foreground">
                .pdf até 15 MB · .docx até 10 MB
              </span>
              <input
                type="file"
                accept=".pdf,.docx"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && !fileExt(f.name)) {
                    toast.error("Formato não suportado. Envie .pdf ou .docx.");
                    return;
                  }
                  setFile(f);
                  setProgress(IDLE_PROGRESS);
                }}
              />
            </label>
          )}

          {busy || progress.phase === "error" ? (
            <div className="space-y-2 rounded-md border bg-muted/20 p-3" aria-live="polite">
              <Progress value={progress.percent} />
              <p className="text-xs font-medium">{progress.message}</p>
              {progress.detail ? (
                <p className="text-xs text-destructive">{progress.detail}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={run} disabled={!file || busy}>
            <Sparkles className="mr-1 h-4 w-4" /> Converter em modelo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
