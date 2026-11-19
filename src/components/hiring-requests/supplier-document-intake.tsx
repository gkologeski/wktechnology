import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useAuth } from "@/lib/auth";
import { readViewAs } from "@/lib/view-as-client";
import { parseContractPdf, parseContractText } from "@/lib/contracts/import.functions";
import { getContract } from "@/lib/contracts.functions";
import { PreparationReferenceField } from "./preparation-reference-field";
import {
  documentSuggestion,
  applyDocumentSuggestion,
  type DocumentSuggestion,
} from "@/lib/hiring/requests/document-review";
import { modalityLabels } from "@/lib/hiring/requests/types";
import type { PreparationData } from "@/lib/hiring/requests/types";
export function SupplierDocumentIntake({
  form,
  disabled,
  canWriteReference,
  onApply,
  onReference,
}: {
  form: PreparationData;
  disabled: boolean;
  canWriteReference: boolean;
  onApply: (form: PreparationData) => void;
  onReference: (n: number) => void;
}) {
  const p = usePermissions(),
    { user } = useAuth(),
    pdf = useServerFn(parseContractPdf),
    text = useServerFn(parseContractText),
    load = useServerFn(getContract);
  const [source, setSource] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [review, setReview] = useState<{
      suggestion: DocumentSuggestion;
      workspace: string;
      actor: string;
      source: string;
    } | null>(null),
    [fields, setFields] = useState<Set<string>>(new Set());
  const canViewContract = p.canAny(
    ["own", "team", "workspace"].map((s) => `techcontracts.contracts.view.${s}`),
  );
  const canExtract =
    p.can("techcontracts.imports.manage.workspace") &&
    p.canAny(["own", "team", "workspace"].map((s) => `techcontracts.contracts.create.${s}`));
  const writable =
    !disabled &&
    !p.isLoading &&
    !p.isError &&
    !readViewAs()?.readOnly &&
    !!p.workspaceId &&
    !!user?.id;
  async function prepare(run: () => Promise<DocumentSuggestion>, label: string) {
    if (!writable) return;
    const workspace = p.workspaceId!,
      actor = user!.id;
    setBusy(true);
    setError("");
    setReview(null);
    setFields(new Set());
    try {
      setReview({ suggestion: await run(), workspace, actor, source: label });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File) {
    if (!canExtract) return;
    await prepare(async () => {
      const ext = file.name.toLowerCase();
      if (ext.endsWith(".pdf")) {
        if (file.size > 15 * 1024 * 1024) throw Error("O PDF deve ter até 15 MB.");
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
          throw Error("Arquivo PDF inválido.");
        let binary = "";
        for (let i = 0; i < bytes.length; i += 32768)
          binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
        return documentSuggestion(
          (await pdf({ data: { filename: file.name, base64: btoa(binary) } })).extracted,
        );
      }
      if (!ext.endsWith(".docx") || file.size > 10 * 1024 * 1024)
        throw Error("Selecione PDF (até 15 MB) ou DOCX (até 10 MB).");
      const mammoth = await import("mammoth/mammoth.browser");
      const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return documentSuggestion(await text({ data: { filename: file.name, text: value } }));
    }, file.name);
  }
  const current =
    review && review.workspace === p.workspaceId && review.actor === user?.id
      ? writable
        ? review
        : null
      : null;
  return (
    <section className="space-y-3 border-b pb-4 mb-4" aria-label="Preencher pelo documento">
      <h3 className="font-medium">Preencher pelo documento do fornecedor</h3>
      <p className="text-sm text-muted-foreground">
        Use um contrato de compra já importado ou leia um PDF/DOCX com a IA do workspace. Revise os
        campos antes de aplicar ao rascunho. O arquivo lido aqui não é cadastrado como contrato nem
        anexado automaticamente.
      </p>
      {canViewContract && (
        <>
          <PreparationReferenceField
            kind="supplier"
            picker="contract"
            label="Contrato do fornecedor já importado — WK contratante"
            value={source}
            onChange={(v) => {
              setSource(v);
              setReview(null);
            }}
            disabled={!writable || busy}
            company={null}
            allowCreate={false}
          />
          <Button
            type="button"
            variant="outline"
            disabled={!writable || busy || !source}
            onClick={() =>
              void prepare(async () => {
                const row = await load({ data: { id: source! } });
                if (!row || row.workspace_id !== p.workspaceId || row.role !== "client")
                  throw Error("Contrato de compra indisponível neste workspace.");
                return documentSuggestion({
                  title: row.title,
                  service_scope: row.service_scope,
                  monthly_value: row.monthly_value,
                  total_value: row.total_value,
                  role: "client",
                  confidence: 1,
                  warnings: [],
                });
              }, "Contrato de fornecedor selecionado")
            }
          >
            Revisar dados do contrato
          </Button>
        </>
      )}
      {canExtract ? (
        <Input
          type="file"
          accept=".pdf,.docx"
          aria-label="Ler documento do fornecedor com IA"
          disabled={!writable || busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          A leitura por IA usa as permissões atuais de importar e criar contratos. Solicite acesso
          ao administrador se necessário.
        </p>
      )}
      {busy && <p role="status">Lendo documento…</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {current && (
        <div className="space-y-3">
          <p className="font-medium">Revisão: {current.source}</p>
          <p className="text-xs">
            Marque somente os campos que deseja preencher ou substituir. Nenhum dado será salvo
            antes de “Criar rascunho” ou “Salvar alterações”.
          </p>
          {(
            [
              "title",
              "scope_text",
              "modality",
              ...(canWriteReference ? ["reference_value"] : []),
            ] as const
          ).map((key) => {
            const k = key as keyof DocumentSuggestion,
              value = current.suggestion[k];
            if (value == null || value === "") return null;
            const labels: Record<string, string> = {
              title: "Título",
              scope_text: "Justificativa / escopo",
              modality: "Modalidade",
              reference_value: "Valor de referência",
            };
            return (
              <label key={key} className="flex gap-2 items-start text-sm">
                <input
                  type="checkbox"
                  disabled={!writable}
                  checked={fields.has(key)}
                  onChange={(e) =>
                    setFields((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(key);
                      else next.delete(key);
                      return next;
                    })
                  }
                />
                <span>
                  <strong>{labels[key]}</strong>
                  <span className="block whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                    {key === "modality"
                      ? modalityLabels[value as keyof typeof modalityLabels]
                      : key === "reference_value"
                        ? Number(value).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })
                        : String(value)}
                  </span>
                </span>
              </label>
            );
          })}
          {(current.suggestion.supplier || current.suggestion.wk) && (
            <p className="text-sm">
              Partes identificadas: {current.suggestion.supplier} / {current.suggestion.wk}.
              Confirme os cadastros existentes nos campos de vínculos; nomes não criam nem
              substituem IDs.
            </p>
          )}
          {current.suggestion.warnings.map((w, i) => (
            <p key={i} className="text-sm text-muted-foreground">
              {w}
            </p>
          ))}
          <Button
            type="button"
            disabled={!writable || !fields.size}
            onClick={() => {
              onApply(applyDocumentSuggestion(form, current.suggestion, fields));
              if (
                canWriteReference &&
                fields.has("reference_value") &&
                current.suggestion.reference_value != null
              )
                onReference(current.suggestion.reference_value);
              setReview(null);
            }}
          >
            Aplicar campos selecionados ao rascunho
          </Button>
          <Button type="button" variant="ghost" onClick={() => setReview(null)}>
            Descartar leitura
          </Button>
        </div>
      )}
    </section>
  );
}
