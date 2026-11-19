// Wizard de importação de contrato (.pdf / .docx).
// Fluxo: 1) Upload → 2) Revisão dos campos extraídos → 3) Cria contrato em draft.
import { usePermissions } from "@/lib/access-control/use-permissions";
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
import { buildImportPatch } from "@/lib/contracts/import-patch";
import { getContractLegacyState } from "@/lib/contracts/legacy.functions";
import {
  attemptFor,
  bodylessRetryAllowed,
  buildCreateFromImportRequest,
  legacyPendingConfirmed,
  legacyReasonError,
  manualRoleFrom,
  originalRequired,
  type ImportAttempt,
  type ImportMode,
} from "@/lib/contracts/import-mode";
import {
  ImportModeChooser,
  useImportModeAccess,
} from "@/components/contracts/import/import-mode-chooser";
import {
  fitBodyHtml,
  hasBodyText,
  plainTextToBodyHtml,
  PDF_BODY_ERROR_MESSAGES,
  type PdfBodyError,
} from "@/lib/contracts/import-body";
import {
  PAYMENT_METHODS,
  SERVICE_LOCATIONS,
  SERVICE_TYPES,
  serviceTypeLabel,
  SIGNATURE_PROVIDERS,
} from "@/lib/contracts/import-schemas";

import { IsoDatePicker } from "@/components/iso-date-picker";
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

/** Corpo do .docx com a formatação; se falhar, conversão simples. */
async function docxToBodyHtml(file: File): Promise<string | null> {
  const buf = await file.arrayBuffer();
  try {
    const [{ unzipSync, strFromU8 }, { docxXmlToHtml }] = await Promise.all([
      import("fflate"),
      import("@/lib/contracts/docx-formatted-html"),
    ]);
    const files = unzipSync(new Uint8Array(buf));
    const read = (n: string) => (files[n] ? strFromU8(files[n]) : undefined);
    const document = read("word/document.xml");
    if (document) {
      const html = docxXmlToHtml({
        document,
        numbering: read("word/numbering.xml"),
        styles: read("word/styles.xml"),
      });
      if (hasBodyText(html)) return html;
    }
  } catch {
    // segue para a conversão simples
  }
  try {
    const mammoth = await import("mammoth/mammoth.browser");
    const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
    return hasBodyText(value) ? value : null;
  } catch {
    return null;
  }
}

/** Texto integral do PDF em parágrafos (PDF digitalizado sem texto devolve null). */
async function pdfToBodyHtml(file: File): Promise<string | null> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const workerUrl = (await import("pdfjs-dist/legacy/build/pdf.worker.mjs?url")).default;
    (pdfjs as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
      workerUrl;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      pages.push(
        (tc.items as Array<{ str?: string; hasEOL?: boolean }>)
          .map((it) => (typeof it.str === "string" ? it.str : "") + (it.hasEOL ? "\n" : ""))
          .join(""),
      );
    }
    const html = plainTextToBodyHtml(pages.join("\n\n"));
    return hasBodyText(html) ? html : null;
  } catch (e) {
    console.warn(
      "[contracts] leitor de PDF do navegador falhou:",
      e instanceof Error ? e.name : "erro",
    );
    return null;
  }
}

export function ImportContractFileDialog({ open, onOpenChange }: Props) {
  const permissions = usePermissions();
  const canImport =
    !permissions.isLoading &&
    !permissions.isError &&
    permissions.can("techcontracts.imports.manage.workspace");
  const { access } = useImportModeAccess();
  const parsePdf = useServerFn(parseContractPdf);
  const parseText = useServerFn(parseContractText);
  const createFromImport = useServerFn(createContractFromImport);
  const loadLegacy = useServerFn(getContractLegacyState);
  const updateFn = useServerFn(updateContract);
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<ExtractionProgress>(IDLE_PROGRESS);
  const parsing = isExtracting(progress);

  const [mode, setMode] = useState<ImportMode | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<ExtractedContract | null>(null);
  const [bodyHtml, setBodyHtml] = useState<string | null>(null);
  const [roleTouched, setRoleTouched] = useState(false);
  const [attempt, setAttempt] = useState<ImportAttempt | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const [keepFile, setKeepFile] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const kind = file ? fileExt(file.name) : null;
  const legacy = mode === "legacy";
  const modeAllowed = mode === "draft" ? access.draft : mode === "legacy" ? access.legacy : false;
  const reasonOk = !legacy || legacyReasonError(reason) === null;

  const reset = useCallback(() => {
    setStep("upload");
    setFile(null);
    setProgress(IDLE_PROGRESS);
    setMode(null);
    setReason("");
    setSaving(false);
    setFields(null);
    setBodyHtml(null);
    setRoleTouched(false);
    setAttempt(null);
    setCreateError(null);
    setContractId(null);
    setKeepFile(true);
    setViewerOpen(false);
    setExtractedText(null);
  }, []);

  const handleClose = useCallback(
    (next: boolean) => {
      if (!next) {
        if (saving) return;
        if (contractId) toast.info("Contrato salvo em Contratos. Você pode retomar quando quiser.");
        else if (attempt?.uploaded && legacy)
          toast.info("Nenhum contrato foi criado; o arquivo enviado não foi vinculado.");
        reset();
      }
      onOpenChange(next);
    },
    [onOpenChange, reset, contractId, saving, attempt, legacy],
  );

  const handleFile = useCallback((f: File | null) => {
    setFile(f);
    setFields(null);
    setBodyHtml(null);
    setRoleTouched(false);
    // Arquivo novo = tentativa nova; o mesmo arquivo reaproveita UUID e caminho.
    setAttempt(null);
    setCreateError(null);
    setContractId(null);
    setExtractedText(null);
    setProgress(IDLE_PROGRESS);
  }, []);

  const changeMode = useCallback((m: ImportMode) => {
    setMode(m);
    if (originalRequired(m)) setKeepFile(true);
  }, []);

  /** Envia o original uma única vez por tentativa; no legado a falha aborta (sem contrato). */
  const ensureUploaded = useCallback(
    async (f: File, current: ImportAttempt): Promise<ImportAttempt> => {
      if (current.uploaded) return current;
      if (!keepFile && !originalRequired(mode)) return current;
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Falha ao enviar o arquivo original: sessão expirada.");
      const safeName = f.name.replace(/[^\w.-]+/g, "_");
      const path = `${uid}/${current.operationId}-${safeName}`;
      const { error } = await supabase.storage
        .from("contract-imports")
        .upload(path, f, { contentType: f.type || undefined, upsert: false });
      if (error && !/exists|duplicate/i.test(error.message)) {
        if (originalRequired(mode))
          throw new Error(
            `Falha ao enviar o arquivo original (${error.message}). Nenhum contrato foi criado.`,
          );
        toast.warning(`O arquivo original não foi guardado (${error.message}).`);
        return { ...current, uploaded: true };
      }
      const next = { ...current, sourceFilePath: path, uploaded: true };
      setAttempt(next);
      return next;
    },
    [keepFile, mode],
  );

  /** Cria pelo servidor com o mesmo UUID/caminho; nunca repete sozinho nem sem corpo. */
  const create = useCallback(
    async (f: ExtractedContract, withBody: boolean) => {
      if (!file || !kind || !mode) return null;
      const base = attemptFor(attempt, () => crypto.randomUUID());
      setAttempt(base);
      const ready = await ensureUploaded(file, base);
      const request = buildCreateFromImportRequest({
        mode,
        fields: f,
        attempt: ready,
        kind,
        bodyHtml: withBody ? bodyHtml : null,
        reason,
        manualRole: manualRoleFrom(roleTouched ? f.role : null),
      });
      // import_mode/legacy_reason/operation_id/manual_role: contrato do servidor (lote C/0387).
      const result = await createFromImport({ data: request });
      if (mode === "legacy") {
        const state = await loadLegacy({ data: { contractId: result.id } }).catch(() => null);
        if (!legacyPendingConfirmed(state))
          throw Object.assign(
            new Error(
              "O contrato foi criado, mas o servidor não confirmou o reconhecimento como legado. Abra a ficha e confira; não repita a importação.",
            ),
            { createdId: result.id },
          );
      }
      return result;
    },
    [
      file,
      kind,
      mode,
      attempt,
      ensureUploaded,
      bodyHtml,
      reason,
      roleTouched,
      createFromImport,
      loadLegacy,
    ],
  );

  const runExtraction = useCallback(async () => {
    if (!mode) return toast.error("Escolha o tipo de importação antes de extrair.");
    if (!modeAllowed) return toast.error("Você não tem permissão para este tipo de importação.");
    if (!reasonOk) return toast.error(legacyReasonError(reason) ?? "Motivo inválido.");
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
    setCreateError(null);
    let stage = "Falha na leitura do arquivo pela IA";
    try {
      let extracted: ExtractedContract;
      let serverBody: string | null = null;
      let serverBodyError: PdfBodyError | null = null;
      if (kind === "pdf") {
        setProgress(progressFor("text"));
        const b64 = await fileToBase64(file);
        setProgress(progressFor("ai"));
        const parsed = await parsePdf({ data: { filename: file.name, base64: b64 } });
        extracted = parsed.extracted;
        serverBody = parsed.body_html;
        serverBodyError = parsed.body_error;
      } else {
        setProgress(progressFor("text"));
        stage = "Falha ao ler o texto do .docx";
        const text = await docxToText(file);
        if (text.trim().length < 20) {
          throw new Error("Não foi possível extrair texto do .docx.");
        }
        setExtractedText(text);
        setProgress(progressFor("ai"));
        stage = "Falha na leitura do arquivo pela IA";
        extracted = await parseText({ data: { filename: file.name, text } });
      }
      let rawBody: string | null = serverBody;
      if (!rawBody) {
        try {
          rawBody = kind === "pdf" ? await pdfToBodyHtml(file) : await docxToBodyHtml(file);
        } catch {
          rawBody = null;
        }
      }
      const body = fitBodyHtml(rawBody);
      if (!body.html) {
        toast.warning(
          serverBodyError
            ? PDF_BODY_ERROR_MESSAGES[serverBodyError]
            : "Não foi possível ler o texto do arquivo para o corpo do contrato.",
        );
      } else if (body.truncated) toast.warning("Corpo do contrato muito longo: foi truncado.");
      setFields(extracted);
      setBodyHtml(body.html);
      setStep("review");
      if (mode === "legacy") {
        // Legado: nada é gravado antes da revisão humana.
        setProgress(progressFor("done"));
        toast.success("Campos extraídos. Revise e confirme para criar o contrato legado pendente.");
        return;
      }
      setProgress(progressFor("draft"));
      stage = "Falha ao gravar o rascunho do contrato";
      setSaving(true);
      try {
        const result = await create(extracted, true);
        if (result) setContractId(result.id);
        setProgress(progressFor("done"));
        toast.success("Rascunho criado. Revise e finalize.");
      } catch (e) {
        const detail = e instanceof Error ? e.message : "";
        setCreateError(detail ? `${stage}: ${detail}` : stage);
        setProgress(IDLE_PROGRESS);
      } finally {
        setSaving(false);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      const msg =
        detail && detail.startsWith("Falha") ? detail : detail ? `${stage}: ${detail}` : stage;
      setProgress(progressFor("error", msg));
      toast.error(msg);
    }
  }, [mode, modeAllowed, reasonOk, reason, file, kind, parsePdf, parseText, create]);

  const goToContract = useCallback(
    (id: string) => {
      reset();
      onOpenChange(false);
      navigate({ to: "/contracts/$id", params: { id } });
    },
    [reset, onOpenChange, navigate],
  );

  /** Tentativa explícita do usuário: mesmo UUID e caminho; sem corpo só quando escolhido no rascunho. */
  const retryCreate = useCallback(
    async (withBody: boolean) => {
      if (!fields) return;
      setSaving(true);
      setCreateError(null);
      try {
        const result = await create(fields, withBody);
        if (!result) return;
        if (legacy) {
          toast.success("Contrato legado pendente criado. Conclua a conferência na ficha.");
          goToContract(result.id);
        } else {
          setContractId(result.id);
          toast.success("Rascunho criado. Revise e finalize.");
        }
      } catch (e) {
        const created = (e as { createdId?: string }).createdId;
        if (created) setContractId(created);
        setCreateError(e instanceof Error ? e.message : "Falha ao criar o contrato.");
      } finally {
        setSaving(false);
      }
    },
    [fields, create, legacy, goToContract],
  );

  const submit = useCallback(async () => {
    if (!fields) return;
    if (legacy) {
      if (contractId) return goToContract(contractId);
      return retryCreate(true);
    }
    if (!contractId) return;
    setSaving(true);
    try {
      // buildImportPatch nunca inclui signature_* (campos protegidos).
      await updateFn({ data: { id: contractId, patch: buildImportPatch(fields) } });
      toast.success("Contrato salvo.");
      goToContract(contractId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao salvar contrato";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [fields, legacy, contractId, goToContract, retryCreate, updateFn]);

  const patch = useCallback((p: Partial<ExtractedContract>) => {
    if ("role" in p) setRoleTouched(true);
    setFields((prev) => (prev ? { ...prev, ...p } : prev));
  }, []);

  const canExtract = canImport && !!file && !!mode && modeAllowed && reasonOk && !parsing;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Importar contrato
          </DialogTitle>
          <DialogDescription>
            Escolha o tipo de importação e envie um .pdf ou .docx. A IA extrai os campos e você
            revisa tudo antes de concluir.
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

        {createError ? (
          <div
            role="alert"
            className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
          >
            <p className="text-destructive">{createError}</p>
            {contractId ? (
              <Button size="sm" variant="outline" onClick={() => goToContract(contractId)}>
                Abrir ficha do contrato
              </Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => retryCreate(true)} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Tentar novamente
                </Button>
                {bodylessRetryAllowed(mode) && bodyHtml ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => retryCreate(false)}
                    disabled={saving}
                  >
                    Gravar sem o corpo
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {step === "upload" && (
          <>
            <ImportModeChooser
              mode={mode}
              onModeChange={changeMode}
              reason={reason}
              onReasonChange={setReason}
              access={access}
              disabled={parsing || saving}
            />
            <UploadStep
              file={file}
              onFile={handleFile}
              onExtract={runExtraction}
              parsing={parsing}
              keepFile={keepFile}
              keepFileLocked={originalRequired(mode)}
              onKeepFileChange={setKeepFile}
            />
          </>
        )}

        {step === "review" && fields && (
          <ReviewStep fields={fields} onPatch={patch} legacy={legacy} created={!!contractId} />
        )}

        <DialogFooter className="gap-2">
          {step === "review" && !contractId && (
            <Button variant="outline" onClick={() => setStep("upload")} disabled={saving}>
              Voltar
            </Button>
          )}
          <Button variant="ghost" onClick={() => handleClose(false)} disabled={parsing || saving}>
            Cancelar
          </Button>
          {step === "upload" && (
            <Button onClick={runExtraction} disabled={!canExtract}>
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
            <Button onClick={submit} disabled={saving || (!legacy && !contractId) || !reasonOk}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando…
                </>
              ) : legacy ? (
                "Criar contrato legado pendente"
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
  keepFileLocked,
  onKeepFileChange,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  onExtract: () => void;
  parsing: boolean;
  keepFile: boolean;
  keepFileLocked: boolean;
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
          checked={keepFileLocked || keepFile}
          disabled={keepFileLocked}
          onChange={(e) => onKeepFileChange(e.target.checked)}
        />
        {keepFileLocked
          ? "Contrato legado: o arquivo original é guardado obrigatoriamente; se o envio falhar, nada é criado."
          : "Guardar o arquivo original no contrato para consulta futura."}
      </label>

      <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
        A extração é feita por IA. No rascunho, o contrato é gravado logo após a leitura e você
        revisa em seguida; no legado, nada é gravado antes da sua revisão.
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
  legacy,
  created,
}: {
  fields: ExtractedContract;
  onPatch: (p: Partial<ExtractedContract>) => void;
  legacy: boolean;
  created: boolean;
}) {
  const confidence = typeof fields.confidence === "number" ? fields.confidence : null;
  const warnings = Array.isArray(fields.warnings) ? fields.warnings : [];

  return (
    <div className="space-y-5 py-2">
      <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3 text-sm">
        <Sparkles className="h-4 w-4 text-primary" />
        <div className="flex-1" aria-live="polite">
          {legacy
            ? created
              ? "Contrato legado pendente criado. Abra a ficha para a conferência humana com o PDF original assinado."
              : "Ainda não gravado. Ao confirmar, cria o contrato como legado pendente de regularização: sem cotação, proposta, minuta ou nova assinatura, e sem liberar cobranças. Assinatura e provedor extraídos ficam só como referência."
            : created
              ? "Rascunho salvo. Edite o que precisar e clique em Finalizar — ou feche: o rascunho continua em Contratos."
              : "Rascunho ainda não gravado."}
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
          <IsoDatePicker
            value={fields.starts_at ?? ""}
            onChange={(v) => onPatch({ starts_at: (v ?? "") || null })}
          />
        </Field>
        <Field label="Fim">
          <IsoDatePicker
            value={fields.ends_at ?? ""}
            onChange={(v) => onPatch({ ends_at: (v ?? "") || null })}
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
                  {serviceTypeLabel(s)}
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
