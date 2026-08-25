// Wizard de importação de contrato (.pdf / .docx).
// Fluxo: 1) Upload → 2) Revisão dos campos extraídos → 3) Cria contrato em draft.
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload, FileText, X, AlertTriangle, Sparkles, Eye } from "lucide-react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  parseContractPdf,
  parseContractText,
  createContractFromImport,
} from "@/lib/contracts/import.functions";
import { updateContract } from "@/lib/contracts.functions";
import { LocalContractFileViewerDialog } from "@/components/contracts/local-file-viewer-dialog";
import {
  IDLE_PROGRESS,
  isExtracting,
  progressFor,
  type ExtractionProgress,
} from "@/components/contracts/import-progress";
import type { ExtractedContract } from "@/lib/contracts/import-schemas";
import {
  PAYMENT_METHODS,
  SERVICE_LOCATIONS,
  SERVICE_TYPES,
  SIGNATURE_PROVIDERS,
} from "@/lib/contracts/import-schemas";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Step = "upload" | "review";

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

async function docxToText(file: File): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser");
  const buf = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
  return value ?? "";
}

export function ImportContractFileDialog({ open, onOpenChange }: Props) {
  const parsePdf = useServerFn(parseContractPdf);
  const parseText = useServerFn(parseContractText);
  const createFromImport = useServerFn(createContractFromImport);
  const updateFn = useServerFn(updateContract);
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<ExtractionProgress>(IDLE_PROGRESS);
  const parsing = isExtracting(progress);

  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<ExtractedContract | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const [sourceFilePath, setSourceFilePath] = useState<string | null>(null);
  const [keepFile, setKeepFile] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const kind = file ? fileExt(file.name) : null;

  const reset = useCallback(() => {
    setStep("upload");
    setFile(null);
    setProgress(IDLE_PROGRESS);

    setSaving(false);
    setFields(null);
    setContractId(null);
    setSourceFilePath(null);
    setKeepFile(true);
    setViewerOpen(false);
    setExtractedText(null);
  }, []);

  const handleClose = useCallback(
    (next: boolean) => {
      if (!next) {
        if (contractId) {
          toast.info("Rascunho salvo em Contratos. Você pode retomar quando quiser.");
        }
        reset();
      }
      onOpenChange(next);
    },
    [onOpenChange, reset, contractId],
  );

  const handleFile = useCallback((f: File | null) => {
    setFile(f);
    setFields(null);
    setContractId(null);
    setSourceFilePath(null);
    setExtractedText(null);
    setProgress(IDLE_PROGRESS);
  }, []);

  const uploadOriginal = useCallback(
    async (f: File) => {
      if (!keepFile) return null;
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return null;
      const safeName = f.name.replace(/[^\w.-]+/g, "_");
      const path = `${uid}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage
        .from("contract-imports")
        .upload(path, f, { contentType: f.type || undefined, upsert: false });
      if (error) {
        toast.warning(
          `Rascunho criado, mas o arquivo original não foi guardado (${error.message}).`,
        );
        return null;
      }
      return path;
    },
    [keepFile],
  );

  const runExtraction = useCallback(async () => {
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
      let extracted: ExtractedContract;
      if (kind === "pdf") {
        setProgress(progressFor("text"));
        const b64 = await fileToBase64(file);
        setProgress(progressFor("ai"));
        extracted = await parsePdf({ data: { filename: file.name, base64: b64 } });
      } else {
        setProgress(progressFor("text"));
        const text = await docxToText(file);
        if (text.trim().length < 20) {
          throw new Error("Não foi possível extrair texto do .docx.");
        }
        setExtractedText(text);
        setProgress(progressFor("ai"));
        extracted = await parseText({ data: { filename: file.name, text } });
      }

      // Persistir rascunho imediatamente para não perder o trabalho se a aba fechar.
      setProgress(progressFor("storing"));
      const path = await uploadOriginal(file);
      setProgress(progressFor("draft"));
      const result = await createFromImport({
        data: {
          fields: extracted,
          source_file_path: path,
          imported_from: kind,
        },
      });

      setFields(extracted);
      setSourceFilePath(path);
      setContractId(result.id);
      setStep("review");
      setProgress(progressFor("done"));
      toast.success("Rascunho criado. Revise e finalize.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha na extração";
      setProgress(progressFor("error", msg));
      toast.error(msg);
    }
  }, [file, kind, parsePdf, parseText, uploadOriginal, createFromImport]);

  const buildPatch = useCallback((f: ExtractedContract) => {
    const num = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? v : v == null || v === "" ? null : Number(v);
    return {
      title: f.title?.trim() || "Contrato importado",
      role: f.role ?? undefined,
      total_value: (f.total_value ?? f.monthly_value ?? 0) as number,
      currency: f.currency ?? "BRL",
      starts_at: f.starts_at ?? null,
      ends_at: f.ends_at ?? null,
      auto_renew: f.auto_renew ?? false,
      notice_days: (num(f.notice_days) ?? 30) as number,
      monthly_value: num(f.monthly_value),
      hours_per_month: num(f.hours_per_month),
      payment_day: num(f.payment_day),
      payment_method: f.payment_method ?? null,
      late_fee_percent: num(f.late_fee_percent),
      late_interest_monthly_percent: num(f.late_interest_monthly_percent),
      expense_reimbursement_days: num(f.expense_reimbursement_days),
      readjustment_index: f.readjustment_index ?? null,
      readjustment_period: f.readjustment_period ?? null,
      penalty_percent: num(f.penalty_percent),
      cure_period_days: num(f.cure_period_days),
      trial_period_days: num(f.trial_period_days),
      unilateral_termination_notice_days: num(f.unilateral_termination_notice_days),
      service_type: f.service_type ?? null,
      service_scope: f.service_scope ?? null,
      service_location: f.service_location ?? null,
      governing_law: f.governing_law ?? null,
      jurisdiction: f.jurisdiction ?? null,
      confidentiality_term_months: num(f.confidentiality_term_months),
      signature_provider: f.signature_provider ?? null,
      signature_document_id: f.signature_document_id ?? null,
      signature_operation_id: f.signature_operation_id ?? null,
    };
  }, []);

  const submit = useCallback(async () => {
    if (!fields || !contractId) return;
    setSaving(true);
    try {
      await updateFn({ data: { id: contractId, patch: buildPatch(fields) } });
      toast.success("Contrato salvo.");
      const id = contractId;
      reset();
      onOpenChange(false);
      navigate({ to: "/contracts/$id", params: { id } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao salvar contrato";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [fields, contractId, updateFn, buildPatch, reset, onOpenChange, navigate]);

  // Silence unused warnings — sourceFilePath is stored for future retry surfaces.
  void sourceFilePath;

  const patch = useCallback(
    (p: Partial<ExtractedContract>) => setFields((prev) => (prev ? { ...prev, ...p } : prev)),
    [],
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Importar contrato
          </DialogTitle>
          <DialogDescription>
            Faça upload de um .pdf ou .docx. A IA extrai os campos e cria um rascunho que você
            revisa em seguida.
          </DialogDescription>
          {file ? (
            <div className="pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setViewerOpen(true)}>
                <Eye className="h-4 w-4 mr-1" /> Visualizar contrato
              </Button>
            </div>
          ) : null}
        </DialogHeader>

        {parsing || progress.phase === "error" ? (
          <div className="space-y-2 rounded-md border bg-muted/20 p-3" aria-live="polite">
            <Progress value={progress.percent} />
            <p className="text-xs font-medium">{progress.message}</p>
            {progress.detail ? <p className="text-xs text-destructive">{progress.detail}</p> : null}
          </div>
        ) : null}

        {step === "upload" && (
          <UploadStep
            file={file}
            onFile={handleFile}
            onExtract={runExtraction}
            parsing={parsing}
            keepFile={keepFile}
            onKeepFileChange={setKeepFile}
          />
        )}

        {step === "review" && fields && <ReviewStep fields={fields} onPatch={patch} />}

        <DialogFooter className="gap-2">
          {step === "review" && (
            <Button variant="outline" onClick={() => setStep("upload")} disabled={saving}>
              Voltar
            </Button>
          )}
          <Button variant="ghost" onClick={() => handleClose(false)} disabled={parsing || saving}>
            Cancelar
          </Button>
          {step === "upload" && (
            <Button onClick={runExtraction} disabled={!file || parsing}>
              {parsing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Extraindo…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" /> Extrair com IA
                </>
              )}
            </Button>
          )}
          {step === "review" && (
            <Button onClick={submit} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando…
                </>
              ) : (
                "Finalizar"
              )}
            </Button>
          )}
        </DialogFooter>

        <LocalContractFileViewerDialog
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          file={file}
          text={extractedText}
          progress={progress}
          extracted={fields}
          onExtract={runExtraction}
          onSave={submit}
          saving={saving}
        />
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Upload step
// -----------------------------------------------------------------------------

function UploadStep({
  file,
  onFile,
  onExtract,
  parsing,
  keepFile,
  onKeepFileChange,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  onExtract: () => void;
  parsing: boolean;
  keepFile: boolean;
  onKeepFileChange: (v: boolean) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const kind = file ? fileExt(file.name) : null;

  return (
    <div className="space-y-4 py-2">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f && fileExt(f.name)) onFile(f);
          else if (f) toast.error("Formato não suportado. Use .pdf ou .docx.");
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition ${
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        }`}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <div className="text-sm font-medium">Arraste um arquivo aqui</div>
        <div className="text-xs text-muted-foreground">
          ou clique para escolher · .pdf (até 15 MB) ou .docx (até 10 MB)
        </div>
        <input
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && fileExt(f.name)) onFile(f);
            else if (f) toast.error("Formato não suportado. Use .pdf ou .docx.");
            e.target.value = "";
          }}
        />
      </label>

      {file && (
        <div className="flex items-center justify-between rounded-md border p-3 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{file.name}</span>
            <Badge variant="outline" className="uppercase">
              {kind}
            </Badge>
            <span className="text-xs text-muted-foreground shrink-0">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFile(null)}
            disabled={parsing}
            aria-label="Remover arquivo"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border"
          checked={keepFile}
          onChange={(e) => onKeepFileChange(e.target.checked)}
        />
        Guardar o arquivo original no contrato para consulta futura.
      </label>

      <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
        A extração é feita por IA e nunca cria o contrato sozinha. Você revisa e edita todos os
        campos antes de salvar.
      </div>

      {/* Botão de extrair está no footer; este bloco existe para acessibilidade caso a UI
          decida expor o CTA duplicado — atualmente escondido para evitar ruído. */}
      <div className="sr-only">
        <Button onClick={onExtract} disabled={!file || parsing}>
          Extrair
        </Button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Review step
// -----------------------------------------------------------------------------

function ReviewStep({
  fields,
  onPatch,
}: {
  fields: ExtractedContract;
  onPatch: (p: Partial<ExtractedContract>) => void;
}) {
  const confidence = typeof fields.confidence === "number" ? fields.confidence : null;
  const warnings = Array.isArray(fields.warnings) ? fields.warnings : [];

  return (
    <div className="space-y-5 py-2">
      <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3 text-sm">
        <Sparkles className="h-4 w-4 text-primary" />
        <div className="flex-1">
          Rascunho salvo. Edite o que precisar e clique em Finalizar — ou feche: o rascunho continua
          em Contratos.
        </div>
        {confidence !== null && (
          <Badge variant="outline">Confiança: {(confidence * 100).toFixed(0)}%</Badge>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2 font-medium mb-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Avisos da extração
          </div>
          <ul className="list-disc pl-4 space-y-0.5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <FieldSection title="Identificação">
        <Field label="Título">
          <Input value={fields.title ?? ""} onChange={(e) => onPatch({ title: e.target.value })} />
        </Field>
        <Field label="Nosso papel">
          <Select
            value={fields.role ?? undefined}
            onValueChange={(v) => onPatch({ role: v as "provider" | "client" })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="provider">Prestação (somos contratada)</SelectItem>
              <SelectItem value="client">Compra (somos contratante)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Contraparte (razão social)">
          <Input
            value={fields.counterparty_name ?? ""}
            onChange={(e) => onPatch({ counterparty_name: e.target.value })}
          />
        </Field>
        <Field label="Contraparte (CNPJ)">
          <Input
            value={fields.counterparty_cnpj ?? ""}
            onChange={(e) => onPatch({ counterparty_cnpj: e.target.value })}
          />
        </Field>
      </FieldSection>

      <FieldSection title="Vigência">
        <Field label="Início">
          <Input
            type="date"
            value={fields.starts_at ?? ""}
            onChange={(e) => onPatch({ starts_at: e.target.value || null })}
          />
        </Field>
        <Field label="Fim">
          <Input
            type="date"
            value={fields.ends_at ?? ""}
            onChange={(e) => onPatch({ ends_at: e.target.value || null })}
          />
        </Field>
        <Field label="Renovação automática">
          <Select
            value={fields.auto_renew ? "yes" : "no"}
            onValueChange={(v) => onPatch({ auto_renew: v === "yes" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Sim</SelectItem>
              <SelectItem value="no">Não</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Aviso prévio (dias) — renovação">
          <Input
            type="number"
            min={0}
            value={fields.notice_days ?? ""}
            onChange={(e) =>
              onPatch({ notice_days: e.target.value ? Number(e.target.value) : null })
            }
          />
        </Field>
      </FieldSection>

      <FieldSection title="Financeiro">
        <Field label="Valor mensal (R$)">
          <Input
            type="number"
            step="0.01"
            value={fields.monthly_value ?? ""}
            onChange={(e) =>
              onPatch({ monthly_value: e.target.value ? Number(e.target.value) : null })
            }
          />
        </Field>
        <Field label="Horas mensais">
          <Input
            type="number"
            min={0}
            value={fields.hours_per_month ?? ""}
            onChange={(e) =>
              onPatch({ hours_per_month: e.target.value ? Number(e.target.value) : null })
            }
          />
        </Field>
        <Field label="Valor total (R$)">
          <Input
            type="number"
            step="0.01"
            value={fields.total_value ?? ""}
            onChange={(e) =>
              onPatch({ total_value: e.target.value ? Number(e.target.value) : null })
            }
          />
        </Field>
        <Field label="Moeda">
          <Input
            value={fields.currency ?? "BRL"}
            onChange={(e) => onPatch({ currency: e.target.value })}
          />
        </Field>
        <Field label="Dia do pagamento">
          <Input
            type="number"
            min={1}
            max={31}
            value={fields.payment_day ?? ""}
            onChange={(e) =>
              onPatch({ payment_day: e.target.value ? Number(e.target.value) : null })
            }
          />
        </Field>
        <Field label="Método de pagamento">
          <Select
            value={fields.payment_method ?? undefined}
            onValueChange={(v) =>
              onPatch({ payment_method: v as ExtractedContract["payment_method"] })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Multa de mora (%)">
          <Input
            type="number"
            step="0.001"
            value={fields.late_fee_percent ?? ""}
            onChange={(e) =>
              onPatch({ late_fee_percent: e.target.value ? Number(e.target.value) : null })
            }
          />
        </Field>
        <Field label="Juros ao mês (%)">
          <Input
            type="number"
            step="0.001"
            value={fields.late_interest_monthly_percent ?? ""}
            onChange={(e) =>
              onPatch({
                late_interest_monthly_percent: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </Field>
        <Field label="Reembolso de despesas (dias)">
          <Input
            type="number"
            min={0}
            value={fields.expense_reimbursement_days ?? ""}
            onChange={(e) =>
              onPatch({
                expense_reimbursement_days: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </Field>
        <Field label="Índice de reajuste">
          <Input
            value={fields.readjustment_index ?? ""}
            onChange={(e) => onPatch({ readjustment_index: e.target.value })}
          />
        </Field>
        <Field label="Periodicidade do reajuste">
          <Input
            value={fields.readjustment_period ?? ""}
            onChange={(e) => onPatch({ readjustment_period: e.target.value })}
          />
        </Field>
      </FieldSection>

      <FieldSection title="Rescisão / cláusula penal">
        <Field label="Multa compensatória (%)">
          <Input
            type="number"
            step="0.001"
            value={fields.penalty_percent ?? ""}
            onChange={(e) =>
              onPatch({ penalty_percent: e.target.value ? Number(e.target.value) : null })
            }
          />
        </Field>
        <Field label="Prazo para sanar infração (dias)">
          <Input
            type="number"
            min={0}
            value={fields.cure_period_days ?? ""}
            onChange={(e) =>
              onPatch({ cure_period_days: e.target.value ? Number(e.target.value) : null })
            }
          />
        </Field>
        <Field label="Carência sem multa (dias)">
          <Input
            type="number"
            min={0}
            value={fields.trial_period_days ?? ""}
            onChange={(e) =>
              onPatch({ trial_period_days: e.target.value ? Number(e.target.value) : null })
            }
          />
        </Field>
        <Field label="Aviso p/ resilição unilateral (dias)">
          <Input
            type="number"
            min={0}
            value={fields.unilateral_termination_notice_days ?? ""}
            onChange={(e) =>
              onPatch({
                unilateral_termination_notice_days: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </Field>
      </FieldSection>

      <FieldSection title="Escopo">
        <Field label="Tipo de serviço">
          <Select
            value={fields.service_type ?? undefined}
            onValueChange={(v) => onPatch({ service_type: v as ExtractedContract["service_type"] })}
          >
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_TYPES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Local de execução">
          <Select
            value={fields.service_location ?? undefined}
            onValueChange={(v) =>
              onPatch({ service_location: v as ExtractedContract["service_location"] })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_LOCATIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="md:col-span-2">
          <Field label="Objeto / escopo detalhado">
            <Textarea
              value={fields.service_scope ?? ""}
              onChange={(e) => onPatch({ service_scope: e.target.value })}
              rows={3}
            />
          </Field>
        </div>
      </FieldSection>

      <FieldSection title="Legal">
        <Field label="Lei aplicável">
          <Input
            value={fields.governing_law ?? ""}
            onChange={(e) => onPatch({ governing_law: e.target.value })}
          />
        </Field>
        <Field label="Foro">
          <Input
            value={fields.jurisdiction ?? ""}
            onChange={(e) => onPatch({ jurisdiction: e.target.value })}
          />
        </Field>
        <Field label="Sigilo (meses após término)">
          <Input
            type="number"
            min={0}
            value={fields.confidentiality_term_months ?? ""}
            onChange={(e) =>
              onPatch({
                confidentiality_term_months: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </Field>
      </FieldSection>

      <FieldSection title="Assinatura eletrônica">
        <Field label="Provedor">
          <Select
            value={fields.signature_provider ?? undefined}
            onValueChange={(v) =>
              onPatch({ signature_provider: v as ExtractedContract["signature_provider"] })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {SIGNATURE_PROVIDERS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="ID do documento">
          <Input
            value={fields.signature_document_id ?? ""}
            onChange={(e) => onPatch({ signature_document_id: e.target.value })}
          />
        </Field>
        <Field label="ID da operação">
          <Input
            value={fields.signature_operation_id ?? ""}
            onChange={(e) => onPatch({ signature_operation_id: e.target.value })}
          />
        </Field>
      </FieldSection>
    </div>
  );
}

function FieldSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
