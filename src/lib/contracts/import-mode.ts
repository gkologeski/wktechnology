import type { ExtractedContract } from "@/lib/contracts/import-schemas";

/** Modo escolhido antes da extração: documento novo em elaboração ou contrato legado já formalizado. */
export type ImportMode = "draft" | "legacy";
export type ManualRole = "provider" | "client" | null;

export const LEGACY_REASON_MIN = 5;
export const LEGACY_REASON_MAX = 2000;

export const IMPORT_MODE_OPTIONS: ReadonlyArray<{
  value: ImportMode;
  label: string;
  description: string;
}> = [
  {
    value: "draft",
    label: "Documento em elaboração",
    description:
      "Cria um rascunho que segue a jornada normal (aprovações, minuta e assinatura pelo sistema).",
  },
  {
    value: "legacy",
    label: "Contrato legado / já formalizado",
    description:
      "Contrato assinado fora do sistema. Não pede cotação, proposta, minuta nem nova assinatura; fica pendente até a conferência humana na ficha com o PDF original assinado e não libera cobranças.",
  },
];

/** Chaves exigidas, além de importar, para criar contrato legado pendente. */
export const LEGACY_IMPORT_KEY = "techcontracts.legacy_contracts.create.workspace";
const IMPORTS_KEY = "techcontracts.imports.manage.workspace";
const CREATE_KEYS = [
  "techcontracts.contracts.create.own",
  "techcontracts.contracts.create.team",
  "techcontracts.contracts.create.workspace",
];
const VIEW_KEYS = [
  "techcontracts.contracts.view.own",
  "techcontracts.contracts.view.team",
  "techcontracts.contracts.view.workspace",
];
const UPDATE_KEYS = [
  "techcontracts.contracts.update.own",
  "techcontracts.contracts.update.team",
  "techcontracts.contracts.update.workspace",
];

export type ImportModeAccess = { draft: boolean; legacy: boolean; legacyMissing: string[] };

/** Acesso por modo (UI). O servidor revalida tudo; isto apenas evita oferecer ação negada. */
export function importModeAccess(
  perm: { can: (k: string) => boolean; canAny: (k: string[]) => boolean },
  ready: boolean,
): ImportModeAccess {
  if (!ready) return { draft: false, legacy: false, legacyMissing: [] };
  const draft = perm.can(IMPORTS_KEY) && perm.canAny(CREATE_KEYS);
  const missing: string[] = [];
  if (!perm.can(IMPORTS_KEY)) missing.push("importar contratos");
  if (!perm.canAny(CREATE_KEYS)) missing.push("criar contratos");
  if (!perm.canAny(VIEW_KEYS)) missing.push("ver contratos");
  if (!perm.canAny(UPDATE_KEYS)) missing.push("editar contratos");
  if (!perm.can(LEGACY_IMPORT_KEY)) missing.push("reconhecer contrato legado");
  return { draft, legacy: missing.length === 0, legacyMissing: missing };
}

export function legacyReasonError(reason: string): string | null {
  const n = reason.trim().length;
  if (n < LEGACY_REASON_MIN) return `Informe o motivo (mínimo ${LEGACY_REASON_MIN} caracteres).`;
  if (n > LEGACY_REASON_MAX) return `Motivo com no máximo ${LEGACY_REASON_MAX} caracteres.`;
  return null;
}

/** Legado exige guardar o original; rascunho permite desmarcar. */
export const originalRequired = (mode: ImportMode | null) => mode === "legacy";
/** Pareamento comercial automático só para rascunhos; legado só com vínculos explícitos. */
export const autoPairAllowed = (mode: ImportMode | null) => mode === "draft";
/** Gravar sem o corpo só por ação explícita e só para rascunho (o legado é conferido pelo documento). */
export const bodylessRetryAllowed = (mode: ImportMode | null) => mode === "draft";

/** Tentativa estável por arquivo: o mesmo UUID e o mesmo caminho são reaproveitados no retry. */
export type ImportAttempt = {
  operationId: string;
  sourceFilePath: string | null;
  uploaded: boolean;
};

export function attemptFor(prev: ImportAttempt | null, newId: () => string): ImportAttempt {
  return prev ?? { operationId: newId(), sourceFilePath: null, uploaded: false };
}

/** Papel manual só quando a pessoa escolheu; nunca disfarça o extraído como manual. */
export function manualRoleFrom(
  choice: "auto" | "provider" | "client" | null | undefined,
): ManualRole {
  return choice === "provider" || choice === "client" ? choice : null;
}

export type CreateFromImportRequest = {
  fields: ExtractedContract;
  source_file_path: string | null;
  imported_from: "pdf" | "docx";
  body_html: string | null;
  import_mode: ImportMode;
  legacy_reason?: string;
  operation_id: string;
  manual_role: ManualRole;
  manual_document_kind?: "main" | "amendment";
};

export function buildCreateFromImportRequest(a: {
  mode: ImportMode;
  fields: ExtractedContract;
  attempt: ImportAttempt;
  kind: "pdf" | "docx";
  bodyHtml: string | null;
  reason?: string;
  manualRole: ManualRole;
  manualDocumentKind?: "main" | "amendment";
}): CreateFromImportRequest {
  if (a.mode === "legacy") {
    const err = legacyReasonError(a.reason ?? "");
    if (err) throw new Error(err);
    if (!a.attempt.sourceFilePath)
      throw new Error("Contrato legado exige o arquivo original guardado.");
  }
  return {
    fields: a.fields,
    source_file_path: a.attempt.sourceFilePath,
    imported_from: a.kind,
    body_html: a.bodyHtml,
    import_mode: a.mode,
    ...(a.mode === "legacy" ? { legacy_reason: (a.reason ?? "").trim() } : {}),
    operation_id: a.attempt.operationId,
    manual_role: a.manualRole,
    ...(a.manualDocumentKind ? { manual_document_kind: a.manualDocumentKind } : {}),
  };
}

/** Confirma que o servidor criou o legado pendente; nunca presume pelo simples retorno de id. */
export function legacyPendingConfirmed(value: unknown): boolean {
  const load = value as {
    access?: string;
    classification?: string;
    state?: { record?: { status?: string } | null };
  } | null;
  return load?.access === "granted"
    ? load.state?.record?.status === "pending"
    : load?.access === "denied" && load.classification === "pending";
}
