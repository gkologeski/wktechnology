// Diagnóstico e correção em lote do tipo de documento (Principal x Aditivo).
// Server-only: importado dinamicamente pelas server functions de contratos.
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";
import { buildContractTitle } from "@/lib/contracts/title";
import { detectAmendmentSignals } from "@/lib/contracts/doc-kind";

type Client = SupabaseClient;

export const CONTRACT_UPDATE_PERMISSIONS = [
  "techcontracts.contracts.update.own",
  "techcontracts.contracts.update.team",
  "techcontracts.contracts.update.workspace",
];

const SELECT =
  "id, number, title, role, status, document_kind, amendment_of_id, amendment_number, service_type, starts_at, source_file_path, counterparty_company_id, contracting_legal_entity_id, metadata, companies:counterparty_company_id(name), legal_entities:contracting_legal_entity_id(name)";

export type DocKindCandidateParent = {
  id: string;
  number: string | null;
  title: string;
};

export type DocKindSuspect = {
  id: string;
  number: string | null;
  title: string;
  role: "provider" | "client";
  amendment_number: string | null;
  reasons: string[];
  suggested_parent: DocKindCandidateParent | null;
  candidates: DocKindCandidateParent[];
};

export type DocKindDiagnosis = {
  total: number;
  amendments: number;
  suspects: DocKindSuspect[];
};

export type ApplyDocKindResult = { updated: number; retitled: number; skipped: number };

type Named = { name?: string | null } | { name?: string | null }[] | null | undefined;

type Row = {
  id: string;
  number: string | null;
  title: string | null;
  role: "provider" | "client" | null;
  document_kind: string | null;
  amendment_number: string | null;
  service_type: string | null;
  starts_at: string | null;
  source_file_path: string | null;
  counterparty_company_id: string | null;
  contracting_legal_entity_id: string | null;
  metadata: unknown;
  companies?: Named;
  legal_entities?: Named;
};

function nameOf(value: Named): string | null {
  if (!value) return null;
  const first = Array.isArray(value) ? value[0] : value;
  return first?.name ?? null;
}

function metaString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function warningsOf(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object") return [];
  const value = (metadata as Record<string, unknown>)["import_warnings"];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function fileNameOf(path: unknown): string | null {
  return typeof path === "string" && path ? (path.split("/").pop() ?? null) : null;
}

function counterpartyKey(row: Row): string | null {
  const cnpj = (metaString(row.metadata, "counterparty_cnpj_extracted") ?? "").replace(/\D/g, "");
  if (cnpj.length === 14) return `cnpj:${cnpj}`;
  if (row.counterparty_company_id) return `company:${row.counterparty_company_id}`;
  const name = metaString(row.metadata, "counterparty_name_extracted");
  return name ? `name:${name.trim().toLowerCase()}` : null;
}

function titlePartsOf(row: Row, documentKind: string, amendmentNumber: string | null) {
  return {
    role: row.role,
    serviceType: row.service_type,
    documentKind,
    amendmentNumber,
    contractingName:
      metaString(row.metadata, "contracting_name_extracted") ?? nameOf(row.legal_entities),
    counterpartyName:
      nameOf(row.companies) ?? metaString(row.metadata, "counterparty_name_extracted"),
    ownName: nameOf(row.legal_entities),
    startsAt: row.starts_at,
  };
}

function labelOf(row: Row): DocKindCandidateParent {
  return {
    id: row.id as string,
    number: row.number,
    title: row.title ?? "",
  };
}

/** Lista contratos marcados como Principal que aparentam ser aditivos. */
export async function diagnoseDocKinds(
  supabase: Client,
  workspaceId: string,
): Promise<DocKindDiagnosis> {
  const { data, error } = await supabase
    .from("contracts")
    .select(SELECT)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as Row[];
  const suspects: DocKindSuspect[] = [];
  const signalsById = new Map<string, ReturnType<typeof detectAmendmentSignals>>();

  for (const row of rows) {
    signalsById.set(
      row.id,
      detectAmendmentSignals({
        title: row.title,
        warnings: warningsOf(row.metadata),
        selfNumber: metaString(row.metadata, "self_contract_number"),
        fileName: fileNameOf(row.source_file_path),
      }),
    );
  }

  for (const row of rows) {
    if (row.document_kind === "amendment") continue;
    const signals = signalsById.get(row.id);
    if (!signals?.isAmendment) continue;

    // Candidatos a contrato principal: mesmo papel, mesma contraparte, sem sinal de aditivo.
    const key = counterpartyKey(row);
    const candidates = rows
      .filter(
        (other) =>
          other.id !== row.id &&
          other.document_kind !== "amendment" &&
          other.role === row.role &&
          !signalsById.get(other.id)?.isAmendment &&
          (key ? counterpartyKey(other) === key : false),
      )
      .slice(0, 10)
      .map(labelOf);

    suspects.push({
      id: row.id as string,
      number: row.number,
      title: row.title ?? "",
      role: row.role ?? "provider",
      amendment_number: signals.number,
      reasons: signals.reasons,
      suggested_parent: candidates[0] ?? null,
      candidates,
    });
  }

  return {
    total: rows.length,
    amendments: rows.filter((r) => r["document_kind"] === "amendment").length,
    suspects,
  };
}

/**
 * Converte os contratos indicados em aditivos do contrato principal escolhido,
 * regrava o título padronizado e registra o evento em `contract_events`.
 */
export async function applyDocKindCorrections(
  supabase: Client,
  workspaceId: string,
  userId: string,
  items: { id: string; mainContractId: string; amendmentNumber?: string | null }[],
): Promise<ApplyDocKindResult> {
  await assertAnyPermission(supabase, userId, workspaceId, CONTRACT_UPDATE_PERMISSIONS);

  const ids = Array.from(new Set(items.map((i) => i.id)));
  const { data, error } = await supabase
    .from("contracts")
    .select(SELECT)
    .eq("workspace_id", workspaceId)
    .in("id", ids);
  if (error) throw new Error(error.message);
  const byId = new Map<string, Row>(((data ?? []) as unknown as Row[]).map((r) => [r.id, r]));

  let updated = 0;
  let retitled = 0;
  let skipped = 0;

  for (const item of items) {
    const row = byId.get(item.id);
    if (!row || row.document_kind === "amendment") {
      skipped += 1;
      continue;
    }
    if (item.mainContractId === item.id) {
      skipped += 1;
      continue;
    }

    const amendmentNumber = item.amendmentNumber?.trim() || null;
    const newTitle = buildContractTitle(titlePartsOf(row, "amendment", amendmentNumber));

    const patch: Record<string, unknown> = {
      document_kind: "amendment",
      amendment_of_id: item.mainContractId,
      amendment_number: amendmentNumber,
      amendment_effective_at: row.starts_at ?? null,
    };
    if (newTitle) patch["title"] = newTitle;

    const { data: upRow, error: upErr } = await supabase
      .from("contracts")
      .update(patch as never)
      .eq("id", item.id)
      .select("id")
      .maybeSingle();
    if (upErr) throw new Error(upErr.message);
    if (!upRow) {
      skipped += 1;
      continue;
    }

    updated += 1;
    if (newTitle) retitled += 1;

    await supabase.from("contract_events").insert({
      workspace_id: workspaceId,
      contract_id: item.id,
      actor_id: userId,
      event_type: "document_kind_corrected",
      payload: {
        from: row.document_kind ?? "main",
        to: "amendment",
        main_contract_id: item.mainContractId,
        amendment_number: amendmentNumber,
        title_before: row.title ?? null,
        title_after: newTitle,
        source: "doc-kind-review",
      },
    } as never);
  }

  return { updated, retitled, skipped };
}
