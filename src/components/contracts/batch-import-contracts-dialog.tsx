// Importação em lote de contratos (.pdf / .docx).
// Fluxo: 1) Seleção de vários arquivos → 2) Grid de revisão (tipo: prestação/compra)
// → 3) Processar: IA extrai, cria rascunhos e tenta vincular compra ↔ prestação.
import { Fragment, useCallback, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Link2,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  createContractFromImport,
  linkImportedContracts,
  parseContractPdf,
  parseContractText,
} from "@/lib/contracts/import.functions";
import type { ExtractedContract } from "@/lib/contracts/import-schemas";
import { linkContractAmendment } from "@/lib/contracts.functions";
import {
  MainContractPicker,
  type MainContractOption,
} from "@/components/contracts/main-contract-picker";
import { Input } from "@/components/ui/input";
import { buildContractTitle } from "@/lib/contracts/title";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
};

type RoleHint = "auto" | "provider" | "client";
type ItemStatus = "queued" | "processing" | "done" | "error";
type DocKind = "main" | "amendment";

type QueueItem = {
  key: string;
  file: File;
  kind: "pdf" | "docx";
  roleHint: RoleHint;
  status: ItemStatus;
  message?: string;
  contractId?: string;
  detectedRole?: "provider" | "client";
  title?: string;
  docKind: DocKind;
  /** Contrato principal já existente. */
  mainContract: MainContractOption | null;
  /** Contrato principal que será criado neste mesmo lote (key do item). */
  mainFromKey?: string;
  amendmentNumber?: string;
  amendmentEffectiveAt?: string;
  linkMessage?: string;
  linkError?: boolean;
};

const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_DOCX_BYTES = 10 * 1024 * 1024;

const ROLE_LABEL: Record<"provider" | "client", string> = {
  provider: "Prestação",
  client: "Compra",
};

function fileExt(name: string): "pdf" | "docx" | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  return null;
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

async function docxToText(file: File): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser");
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return value ?? "";
}

export function BatchImportContractsDialog({ open, onOpenChange, onImported }: Props) {
  const parsePdf = useServerFn(parseContractPdf);
  const parseText = useServerFn(parseContractText);
  const createFromImport = useServerFn(createContractFromImport);
  const linkFn = useServerFn(linkImportedContracts);
  const linkAmendment = useServerFn(linkContractAmendment);
  const navigate = useNavigate();

  const [items, setItems] = useState<QueueItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [keepFiles, setKeepFiles] = useState(true);
  const [linkSummary, setLinkSummary] = useState<{ linked: number; pending: number } | null>(null);

  const done = items.filter((i) => i.status === "done").length;
  const errors = items.filter((i) => i.status === "error").length;
  const percent = items.length ? Math.round(((done + errors) / items.length) * 100) : 0;
  const finished = items.length > 0 && done + errors === items.length && !processing;

  const reset = useCallback(() => {
    setItems([]);
    setProcessing(false);
    setLinkSummary(null);
    setKeepFiles(true);
  }, []);

  const handleClose = useCallback(
    (next: boolean) => {
      if (processing) return;
      if (!next) reset();
      onOpenChange(next);
    },
    [onOpenChange, processing, reset],
  );

  const addFiles = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files);
    setItems((prev) => {
      const next = [...prev];
      for (const f of incoming) {
        const kind = fileExt(f.name);
        if (!kind) {
          toast.error(`${f.name}: formato não suportado. Use .pdf ou .docx.`);
          continue;
        }
        if (kind === "pdf" && f.size > MAX_PDF_BYTES) {
          toast.error(`${f.name}: PDF maior que 15 MB.`);
          continue;
        }
        if (kind === "docx" && f.size > MAX_DOCX_BYTES) {
          toast.error(`${f.name}: .docx maior que 10 MB.`);
          continue;
        }
        if (next.some((i) => i.file.name === f.name && i.file.size === f.size)) continue;
        next.push({
          key: `${f.name}-${f.size}-${next.length}-${Date.now()}`,
          file: f,
          kind,
          roleHint: "auto",
          status: "queued",
          docKind: "main",
          mainContract: null,
        });
      }
      return next;
    });
  }, []);

  const setRoleHint = useCallback((key: string, roleHint: RoleHint) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, roleHint } : i)));
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) =>
      prev
        .filter((i) => i.key !== key)
        .map((i) => (i.mainFromKey === key ? { ...i, mainFromKey: undefined } : i)),
    );
  }, []);

  const patchItem = useCallback((key: string, patch: Partial<QueueItem>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }, []);

  const setDocKind = useCallback((key: string, docKind: DocKind) => {
    setItems((prev) =>
      prev.map((i) =>
        i.key === key
          ? docKind === "main"
            ? { ...i, docKind, mainContract: null, mainFromKey: undefined }
            : { ...i, docKind }
          : i,
      ),
    );
  }, []);

  const uploadOriginal = useCallback(
    async (f: File) => {
      if (!keepFiles) return null;
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return null;
      const safeName = f.name.replace(/[^\w.\-]+/g, "_");
      const path = `${uid}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage
        .from("contract-imports")
        .upload(path, f, { contentType: f.type || undefined, upsert: false });
      if (error) return null;
      return path;
    },
    [keepFiles],
  );

  const process = useCallback(async () => {
    const pending = items.filter((i) => i.status === "queued" || i.status === "error");
    if (!pending.length) return;
    // Principais primeiro: um aditivo pode apontar para um principal do mesmo lote.
    const queue = [
      ...pending.filter((i) => i.docKind === "main"),
      ...pending.filter((i) => i.docKind === "amendment"),
    ];
    setProcessing(true);
    setLinkSummary(null);
    const mainIds: string[] = [];
    const createdByKey = new Map<string, string>();

    // Sequencial: cada documento consome uma chamada de IA; paralelizar estoura rate limit.
    for (const item of queue) {
      patchItem(item.key, {
        status: "processing",
        message: "Extraindo com IA…",
        linkMessage: undefined,
        linkError: false,
      });
      try {
        let extracted: ExtractedContract;
        if (item.kind === "pdf") {
          const b64 = await fileToBase64(item.file);
          extracted = await parsePdf({ data: { filename: item.file.name, base64: b64 } });
        } else {
          const text = await docxToText(item.file);
          if (text.trim().length < 20) throw new Error("Não foi possível extrair texto do .docx.");
          extracted = await parseText({ data: { filename: item.file.name, text } });
        }

        // A escolha manual do usuário no grid prevalece sobre o palpite da IA.
        const role: "provider" | "client" =
          item.roleHint === "auto" ? (extracted.role ?? "provider") : item.roleHint;
        const fields = { ...extracted, role } as ExtractedContract;

        patchItem(item.key, { message: "Criando rascunho…" });
        const path = await uploadOriginal(item.file);
        const result = await createFromImport({
          data: { fields, source_file_path: path, imported_from: item.kind },
        });
        createdByKey.set(item.key, result.id);
        if (item.docKind === "main") mainIds.push(result.id);
        patchItem(item.key, {
          status: "done",
          message: "Rascunho criado",
          contractId: result.id,
          detectedRole: role,
          title:
            buildContractTitle({
              role,
              serviceType: fields.service_type,
              documentKind: item.docKind,
              amendmentNumber: item.amendmentNumber,
              contractingName: fields.contracting_name,
              counterpartyName: fields.counterparty_name,
              startsAt: fields.starts_at ?? null,
            }) ??
            fields.title ??
            item.file.name,
        });

        if (item.docKind === "amendment") {
          const mainId = item.mainFromKey
            ? createdByKey.get(item.mainFromKey)
            : (item.mainContract?.id ?? undefined);
          if (!mainId) {
            patchItem(item.key, {
              linkMessage: "Contrato principal não disponível — vincule manualmente.",
              linkError: true,
            });
          } else {
            try {
              patchItem(item.key, { message: "Vinculando aditivo…" });
              await linkAmendment({
                data: {
                  amendmentId: result.id,
                  mainContractId: mainId,
                  amendmentNumber: item.amendmentNumber?.trim() || null,
                  effectiveAt: item.amendmentEffectiveAt?.trim() || extracted.starts_at || null,
                },
              });
              patchItem(item.key, {
                message: "Aditivo criado",
                linkMessage: "Aditivo vinculado ao contrato principal",
              });
            } catch (err) {
              patchItem(item.key, {
                linkMessage: err instanceof Error ? err.message : "Falha ao vincular o aditivo.",
                linkError: true,
              });
            }
          }
        }
      } catch (err) {
        patchItem(item.key, {
          status: "error",
          message: err instanceof Error ? err.message : "Falha na extração",
        });
      }
    }

    // O pareamento automático compra ↔ prestação só vale entre documentos principais.
    if (mainIds.length) {
      try {
        const res = await linkFn({ data: { ids: mainIds } });
        setLinkSummary({ linked: res.linked.length, pending: res.pending.length });
      } catch {
        setLinkSummary({ linked: 0, pending: mainIds.length });
      }
    }

    setProcessing(false);
    onImported?.();
    toast.success("Processamento concluído.");
  }, [
    items,
    patchItem,
    parsePdf,
    parseText,
    uploadOriginal,
    createFromImport,
    linkFn,
    linkAmendment,
    onImported,
  ]);

  const pendingItems = useMemo(
    () => items.filter((i) => i.status === "queued" || i.status === "error"),
    [items],
  );
  const missingMain = useMemo(
    () =>
      pendingItems.filter((i) => i.docKind === "amendment" && !i.mainContract && !i.mainFromKey)
        .length,
    [pendingItems],
  );
  const canProcess = pendingItems.length > 0 && missingMain === 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Importar contratos em lote
          </DialogTitle>
          <DialogDescription>
            Selecione vários arquivos, confirme o tipo de cada contrato e processe. A IA extrai os
            campos, cria rascunhos e tenta vincular contratos de compra ao contrato de prestação
            correspondente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
          >
            <Upload className="h-7 w-7 text-muted-foreground" />
            <div className="text-sm font-medium">Arraste os arquivos aqui</div>
            <div className="text-xs text-muted-foreground">
              ou clique para escolher · .pdf (até 15 MB) ou .docx (até 10 MB) · sem limite de
              arquivos por lote
            </div>
            <input
              type="file"
              multiple
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              disabled={processing}
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>

          {items.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum arquivo na fila. Adicione contratos de prestação e/ou de compra.
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left font-medium">Arquivo</th>
                    <th className="p-2 text-left font-medium w-44">Tipo</th>
                    <th className="p-2 text-left font-medium w-36">Documento</th>
                    <th className="p-2 text-left font-medium w-56">Status</th>
                    <th className="p-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <Fragment key={i.key}>
                      <tr className="border-t">
                        <td className="p-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="truncate">{i.title ?? i.file.name}</span>
                            <Badge variant="outline" className="uppercase shrink-0">
                              {i.kind}
                            </Badge>
                          </div>
                        </td>
                        <td className="p-2">
                          <Select
                            value={i.roleHint}
                            onValueChange={(v) => setRoleHint(i.key, v as RoleHint)}
                            disabled={processing || i.status === "done"}
                          >
                            <SelectTrigger aria-label={`Tipo do contrato ${i.file.name}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">Detectar com IA</SelectItem>
                              <SelectItem value="provider">Prestação (cliente final)</SelectItem>
                              <SelectItem value="client">Compra (prestador)</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Select
                            value={i.docKind}
                            onValueChange={(v) => setDocKind(i.key, v as DocKind)}
                            disabled={processing || i.status === "done"}
                          >
                            <SelectTrigger aria-label={`Tipo de documento de ${i.file.name}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="main">Principal</SelectItem>
                              <SelectItem value="amendment">Aditivo</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>

                        <td className="p-2">
                          {i.status === "queued" && (
                            <span className="text-xs text-muted-foreground">Na fila</span>
                          )}
                          {i.status === "processing" && (
                            <span className="text-xs flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" /> {i.message}
                            </span>
                          )}
                          {i.status === "done" && (
                            <span className="text-xs flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              {i.detectedRole ? ROLE_LABEL[i.detectedRole] : "Rascunho"} criado
                            </span>
                          )}
                          {i.status === "error" && (
                            <span className="text-xs flex items-start gap-1 text-destructive">
                              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                              <span className="break-words">{i.message}</span>
                            </span>
                          )}
                          {i.linkMessage ? (
                            <span
                              className={`mt-1 text-xs flex items-start gap-1 ${
                                i.linkError ? "text-destructive" : "text-muted-foreground"
                              }`}
                            >
                              <Link2 className="h-3 w-3 mt-0.5 shrink-0" />
                              <span className="break-words">{i.linkMessage}</span>
                            </span>
                          ) : null}
                        </td>
                        <td className="p-2 text-right">
                          {i.status === "done" && i.contractId ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                handleClose(false);
                                navigate({
                                  to: "/contracts/$id",
                                  params: { id: i.contractId as string },
                                });
                              }}
                            >
                              Abrir
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={processing}
                              onClick={() => removeItem(i.key)}
                              aria-label={`Remover ${i.file.name}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                      {i.docKind === "amendment" && i.status !== "done" ? (
                        <tr className="bg-muted/20">
                          <td colSpan={5} className="p-2">
                            <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                              <div className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground">
                                  Contrato principal
                                </span>
                                {i.mainFromKey ? (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="truncate">
                                      Neste lote:{" "}
                                      {items.find((x) => x.key === i.mainFromKey)?.file.name ?? "—"}
                                    </Badge>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      disabled={processing}
                                      onClick={() => patchItem(i.key, { mainFromKey: undefined })}
                                    >
                                      Trocar
                                    </Button>
                                  </div>
                                ) : (
                                  <MainContractPicker
                                    value={i.mainContract}
                                    onChange={(next) =>
                                      patchItem(i.key, {
                                        mainContract: next,
                                        mainFromKey: undefined,
                                      })
                                    }
                                    disabled={processing}
                                    ariaLabel={`Contrato principal de ${i.file.name}`}
                                  />
                                )}
                                {items.some((x) => x.docKind === "main" && x.key !== i.key) &&
                                !i.mainFromKey ? (
                                  <Select
                                    value=""
                                    onValueChange={(v) =>
                                      patchItem(i.key, { mainFromKey: v, mainContract: null })
                                    }
                                    disabled={processing}
                                  >
                                    <SelectTrigger
                                      aria-label={`Usar arquivo do lote como principal de ${i.file.name}`}
                                      className="h-8 text-xs"
                                    >
                                      <SelectValue placeholder="Ou usar um arquivo deste lote…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {items
                                        .filter((x) => x.docKind === "main" && x.key !== i.key)
                                        .map((x) => (
                                          <SelectItem key={x.key} value={x.key}>
                                            {x.title ?? x.file.name}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                ) : null}
                                {!i.mainContract && !i.mainFromKey ? (
                                  <span className="text-xs text-destructive">
                                    Escolha o contrato principal para processar este aditivo.
                                  </span>
                                ) : null}
                              </div>
                              <div className="space-y-1">
                                <label
                                  className="text-xs font-medium text-muted-foreground"
                                  htmlFor={`amd-num-${i.key}`}
                                >
                                  Nº do aditivo (opcional)
                                </label>
                                <Input
                                  id={`amd-num-${i.key}`}
                                  value={i.amendmentNumber ?? ""}
                                  disabled={processing}
                                  placeholder="Ex.: 1"
                                  onChange={(e) =>
                                    patchItem(i.key, { amendmentNumber: e.target.value })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <label
                                  className="text-xs font-medium text-muted-foreground"
                                  htmlFor={`amd-date-${i.key}`}
                                >
                                  Vigência (opcional)
                                </label>
                                <Input
                                  id={`amd-date-${i.key}`}
                                  type="date"
                                  value={i.amendmentEffectiveAt ?? ""}
                                  disabled={processing}
                                  onChange={(e) =>
                                    patchItem(i.key, { amendmentEffectiveAt: e.target.value })
                                  }
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {processing || finished ? (
            <div className="space-y-2 rounded-md border bg-muted/20 p-3" aria-live="polite">
              <Progress value={percent} />
              <p className="text-xs font-medium">
                {done} de {items.length} processados
                {errors ? ` · ${errors} com erro` : ""}
              </p>
              {linkSummary ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Link2 className="h-3 w-3" />
                  {linkSummary.linked} vínculo(s) automático(s) · {linkSummary.pending} pendente(s)
                  de vinculação manual
                </p>
              ) : null}
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={keepFiles}
              disabled={processing}
              onChange={(e) => setKeepFiles(e.target.checked)}
            />
            Guardar os arquivos originais nos contratos para consulta futura.
          </label>
        </div>

        <DialogFooter className="gap-2 sm:items-center">
          {missingMain > 0 && !processing ? (
            <p className="mr-auto text-xs text-destructive" aria-live="polite">
              {missingMain} aditivo(s) sem contrato principal selecionado.
            </p>
          ) : null}
          <Button variant="ghost" onClick={() => handleClose(false)} disabled={processing}>
            {finished ? "Fechar" : "Cancelar"}
          </Button>
          {finished && linkSummary && linkSummary.pending > 0 ? (
            <Button
              variant="outline"
              onClick={() => {
                handleClose(false);
                navigate({ to: "/contracts/links" });
              }}
            >
              <Link2 className="h-4 w-4 mr-2" /> Vincular manualmente
            </Button>
          ) : null}
          <Button onClick={process} disabled={!canProcess || processing}>
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" /> Processar {items.length || ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
