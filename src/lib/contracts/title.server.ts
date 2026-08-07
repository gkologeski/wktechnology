// Helper server-side para aplicar o padrão de título em contratos existentes.
// Server-only: importado dinamicamente pelas server functions de contrato.
import { buildContractTitle } from "@/lib/contracts/title";

type Client = {
  from: (table: string) => any;
};

export type TitleChange = { id: string; before: string; after: string };

const SELECT =
  "id, title, role, service_type, document_kind, amendment_number, starts_at, metadata, counterparty_company_id, contracting_legal_entity_id, companies:counterparty_company_id(name), legal_entities:contracting_legal_entity_id(name)";

function metaString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

/** Calcula o título padronizado dos contratos informados (sem gravar). */
export async function previewContractTitles(
  supabase: Client,
  workspaceId: string,
  ids: string[],
): Promise<TitleChange[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("contracts")
    .select(SELECT)
    .eq("workspace_id", workspaceId)
    .in("id", ids);
  if (error) throw new Error(error.message);

  const changes: TitleChange[] = [];
  for (const raw of data ?? []) {
    const row = raw as Record<string, any>;
    const next = buildContractTitle({
      role: row["role"],
      serviceType: row["service_type"],
      documentKind: row["document_kind"],
      amendmentNumber: row["amendment_number"],
      contractingName:
        metaString(row["metadata"], "contracting_name_extracted") ??
        row["legal_entities"]?.name ??
        null,
      counterpartyName:
        row["companies"]?.name ??
        metaString(row["metadata"], "counterparty_name_extracted") ??
        null,
      ownName: row["legal_entities"]?.name ?? null,
      startsAt: row["starts_at"],
    });
    if (!next || next === row["title"]) continue;
    changes.push({ id: row["id"], before: row["title"] ?? "", after: next });
  }
  return changes;
}

/** Aplica o padrão de título. Retorna as alterações efetivamente gravadas. */
export async function applyContractTitles(
  supabase: Client,
  workspaceId: string,
  ids: string[],
): Promise<TitleChange[]> {
  const changes = await previewContractTitles(supabase, workspaceId, ids);
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
