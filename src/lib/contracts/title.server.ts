// Helper server-side para aplicar o padrão de título em contratos existentes.
// Server-only: importado dinamicamente pelas server functions de contrato.
import { buildContractTitleResult, type TitleSkipReason } from "@/lib/contracts/title";

type Client = {
  from: (table: string) => any;
};

export type TitleChange = { id: string; before: string; after: string };
export type TitleUnchanged = { id: string; title: string };
export type TitleSkipped = { id: string; title: string; reason: TitleSkipReason };
export type TitlePreview = {
  changes: TitleChange[];
  unchanged: TitleUnchanged[];
  skipped: TitleSkipped[];
};

const SELECT =
  "id, title, role, service_type, document_kind, amendment_number, parent_contract_id, starts_at, metadata, counterparty_company_id, contracting_legal_entity_id, companies:counterparty_company_id(name), legal_entities:contracting_legal_entity_id(name)";

function metaString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function contractingNameOf(row: Record<string, any>): string | null {
  return (
    metaString(row["metadata"], "contracting_name_extracted") ??
    row["legal_entities"]?.name ??
    null
  );
}

function counterpartyNameOf(row: Record<string, any>): string | null {
  return (
    row["companies"]?.name ?? metaString(row["metadata"], "counterparty_name_extracted") ?? null
  );
}

async function loadOwnNames(supabase: Client, workspaceId: string): Promise<string[]> {
  const { data } = await supabase
    .from("legal_entities")
    .select("name, trade_name")
    .eq("workspace_id", workspaceId);
  const out: string[] = [];
  for (const raw of (data ?? []) as Record<string, any>[]) {
    for (const key of ["name", "trade_name"]) {
      const v = raw[key];
      if (typeof v === "string" && v.trim()) out.push(v);
    }
  }
  return out;
}

/** Calcula o título padronizado dos contratos informados (sem gravar). */
export async function previewContractTitles(
  supabase: Client,
  workspaceId: string,
  ids: string[],
): Promise<TitlePreview> {
  if (!ids.length) return { changes: [], unchanged: [], skipped: [] };
  const { data, error } = await supabase
    .from("contracts")
    .select(SELECT)
    .eq("workspace_id", workspaceId)
    .in("id", ids);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Record<string, any>[];
  const ownNames = await loadOwnNames(supabase, workspaceId);

  // Aditivos podem herdar as partes do contrato principal.
  const parentIds = Array.from(
    new Set(
      rows
        .filter((r) => r["document_kind"] === "amendment" && r["parent_contract_id"])
        .map((r) => r["parent_contract_id"] as string),
    ),
  );
  const parents = new Map<string, Record<string, any>>();
  if (parentIds.length) {
    const { data: parentRows } = await supabase
      .from("contracts")
      .select(SELECT)
      .eq("workspace_id", workspaceId)
      .in("id", parentIds);
    for (const p of (parentRows ?? []) as Record<string, any>[]) parents.set(p["id"], p);
  }

  const changes: TitleChange[] = [];
  const unchanged: TitleUnchanged[] = [];
  const skipped: TitleSkipped[] = [];

  for (const row of rows) {
    const parent = row["parent_contract_id"] ? parents.get(row["parent_contract_id"]) : undefined;
    const build = (source: Record<string, any>) =>
      buildContractTitleResult({
        role: row["role"] ?? source["role"],
        serviceType: row["service_type"] ?? source["service_type"],
        documentKind: row["document_kind"],
        amendmentNumber: row["amendment_number"],
        contractingName: contractingNameOf(source),
        counterpartyName: counterpartyNameOf(source),
        ownName: source["legal_entities"]?.name ?? null,
        ownNames,
        startsAt: row["starts_at"] ?? source["starts_at"],
      });

    let result = build(row);
    if (!result.title && parent) result = build(parent);

    if (!result.title) {
      skipped.push({ id: row["id"], title: row["title"] ?? "", reason: result.reason });
      continue;
    }
    if (result.title === row["title"]) {
      unchanged.push({ id: row["id"], title: row["title"] ?? "" });
      continue;
    }
    changes.push({ id: row["id"], before: row["title"] ?? "", after: result.title });
  }
  return { changes, unchanged, skipped };
}

/** Aplica o padrão de título. Retorna as alterações efetivamente gravadas. */
export async function applyContractTitles(
  supabase: Client,
  workspaceId: string,
  ids: string[],
): Promise<TitleChange[]> {
  const { changes } = await previewContractTitles(supabase, workspaceId, ids);
  const applied: TitleChange[] = [];
  for (const change of changes) {
    const { data, error } = await supabase
      .from("contracts")
      .update({ title: change.after })
      .eq("id", change.id)
      .select("id")
      .maybeSingle();
    if (error || !data) continue;
    applied.push(change);
  }
  return applied;
}
