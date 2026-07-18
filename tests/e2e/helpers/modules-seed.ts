import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Helpers de seed/cleanup para specs dos módulos Contratos / Serviços / PSA / Financeiro.
 *
 * Convenções:
 * - Todo insert é feito via cliente `supa` do usuário logado (respeita RLS do owner).
 * - Cada função retorna o registro criado com { id, ...campos usados nos asserts }.
 * - Cleanup fica a cargo do spec (afterEach / finally), como nos demais specs.
 */

type Any = any;

export async function seedCompany(
  supa: SupabaseClient,
  userId: string,
  workspaceId: string,
  name: string,
) {
  const { data, error } = await (supa as Any)
    .from("companies")
    .insert({ owner_id: userId, workspace_id: workspaceId, name })
    .select("id, name")
    .single();
  if (error) throw new Error("seedCompany: " + error.message);
  return data as { id: string; name: string };
}

export async function seedContract(
  supa: SupabaseClient,
  userId: string,
  workspaceId: string,
  overrides: Partial<Record<string, unknown>> = {},
) {
  const payload = {
    owner_id: userId,
    workspace_id: workspaceId,
    title: `E2E Contract ${Date.now()}`,
    role: "provider",
    status: "draft",
    total_value: 1000,
    currency: "BRL",
    starts_at: new Date().toISOString().slice(0, 10),
    ...overrides,
  };
  const { data, error } = await (supa as Any)
    .from("contracts")
    .insert(payload)
    .select("id, title, status")
    .single();
  if (error) throw new Error("seedContract: " + error.message);
  return data as { id: string; title: string; status: string };
}

export async function seedService(
  supa: SupabaseClient,
  userId: string,
  workspaceId: string,
  contractId: string,
  overrides: Partial<Record<string, unknown>> = {},
) {
  const today = new Date().toISOString().slice(0, 10);
  const payload = {
    owner_id: userId,
    workspace_id: workspaceId,
    contract_id: contractId,
    role: "provider",
    name: `E2E Service ${Date.now()}`,
    type: "recurring",
    status: "active",
    quantity: 1,
    unit_price: 500,
    currency: "BRL",
    cadence: "monthly",
    starts_at: today,
    next_billing_at: today, // já venceu → tick deve gerar
    ...overrides,
  };
  const { data, error } = await (supa as Any)
    .from("services")
    .insert(payload)
    .select("id, name, next_billing_at")
    .single();
  if (error) throw new Error("seedService: " + error.message);
  return data as { id: string; name: string; next_billing_at: string | null };
}

export async function seedProject(
  supa: SupabaseClient,
  userId: string,
  workspaceId: string,
  overrides: Partial<Record<string, unknown>> = {},
) {
  const { data, error } = await (supa as Any)
    .from("projects")
    .insert({
      owner_id: userId,
      workspace_id: workspaceId,
      name: `E2E Project ${Date.now()}`,
      status: "active",
      role: "provider",
      ...overrides,
    })
    .select("id, name")
    .single();
  if (error) throw new Error("seedProject: " + error.message);
  return data as { id: string; name: string };
}

export async function seedFinancialEntry(
  supa: SupabaseClient,
  userId: string,
  workspaceId: string,
  overrides: Partial<Record<string, unknown>> = {},
) {
  const today = new Date().toISOString().slice(0, 10);
  const payload = {
    owner_id: userId,
    workspace_id: workspaceId,
    direction: "receivable",
    description: `E2E Entry ${Date.now()}`,
    amount: 1000,
    currency: "BRL",
    competence_date: today,
    due_date: today,
    status: "open",
    ...overrides,
  };
  const { data, error } = await (supa as Any)
    .from("financial_entries")
    .insert(payload)
    .select("id, description, amount, paid_amount, status")
    .single();
  if (error) throw new Error("seedFinancialEntry: " + error.message);
  return data as {
    id: string;
    description: string;
    amount: number;
    paid_amount: number;
    status: string;
  };
}

/** Deleta em cascata os registros criados por um spec, tolerante a falhas. */
export async function safeCleanup(supa: SupabaseClient, table: string, id: string) {
  try {
    await (supa as Any).from(table).delete().eq("id", id);
  } catch {
    /* noop */
  }
}
