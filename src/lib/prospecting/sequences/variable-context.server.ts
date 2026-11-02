// Monta o contexto de variáveis da pessoa inscrita: o próprio cadastro, empresa e negócio vinculados.
// Leitura restrita ao workspace da execução; colunas internas/sensíveis são removidas.
import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeEntityRow } from "./variable-tokens";

type Row = Record<string, unknown>;

async function one(
  admin: SupabaseClient,
  table: string,
  workspaceId: string,
  column: string,
  value: unknown,
): Promise<Row | null> {
  if (typeof value !== "string" || !value) return null;
  const q = await admin
    .from(table as never)
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq(column, value)
    .limit(1)
    .maybeSingle();
  if (q.error) throw new Error("Não foi possível ler os campos da variável.");
  return (q.data as Row | null) ?? null;
}

export async function loadEntityVariables(
  admin: SupabaseClient,
  workspaceId: string,
  person: { id: string; entity: "lead" | "contact" },
) {
  const self = await one(
    admin,
    person.entity === "lead" ? "leads" : "contacts",
    workspaceId,
    "id",
    person.id,
  );
  const company = await one(admin, "companies", workspaceId, "id", self?.company_id);
  let deal: Row | null = null;
  if (person.entity === "lead") deal = await one(admin, "deals", workspaceId, "id", self?.converted_deal_id);
  else if (self) {
    const q = await admin
      .from("deals")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("primary_contact_id", person.id)
      .not("stage", "in", "(won,lost)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (q.error) throw new Error("Não foi possível ler os campos da variável.");
    deal = (q.data as Row | null) ?? null;
  }
  return {
    [person.entity]: sanitizeEntityRow(self),
    company: sanitizeEntityRow(company),
    deal: sanitizeEntityRow(deal),
  };
}
