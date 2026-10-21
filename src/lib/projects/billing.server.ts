// Leituras e chamadas de RPC do Ciclo 4 com o cliente do usuário (RLS + permissões revalidadas no banco).
// Nunca usa service_role: custos/tarifas só chegam a quem a política do banco permite.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { cleanDbError } from "@/lib/projects/time-entry.shared";
import type {
  BillingConfigRow,
  MeasurementDetail,
  MeasurementLine,
  MeasurementRow,
  RateRow,
} from "@/lib/projects/billing.types";

type Db = SupabaseClient<Database>;

/** Mensagem do banco → texto para a pessoa (sem códigos internos nem detalhes de índice). */
export function billingError(message: string | null | undefined): string {
  const m = message ?? "";
  if (/project_measurement_lines_source_uniq/.test(m))
    return "Algum apontamento, marco ou evento já está em outra medição. Atualize e tente novamente.";
  if (/project_measurements_regular_uniq/.test(m))
    return "Já existe medição desta competência. Atualize a lista.";
  if (/project_rates_month_only_cost/.test(m))
    return "Valor mensal só vale como custo de alocação ou pessoa (não é convertido em hora).";
  if (/permission denied|42501/.test(m) && !/Sem permissão|somente leitura|membros ativos/.test(m))
    return "Sem permissão para esta ação.";
  return cleanDbError(m);
}

export async function rpc<T>(db: Db, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (
    db.rpc as unknown as (
      f: string,
      a: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  )(fn, args);
  if (error) throw new Error(billingError(error.message));
  return data as T;
}

async function namesFor(db: Db, ids: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return {};
  const { data } = await db.from("profiles").select("id, full_name").in("id", unique.slice(0, 500));
  const out: Record<string, string> = {};
  for (const p of data ?? []) out[p.id] = p.full_name ?? "Sem nome";
  return out;
}

export async function loadRates(db: Db, ws: string): Promise<RateRow[]> {
  const { data, error } = await db
    .from("project_rates")
    .select(
      "id, kind, scope, project_id, user_id, allocation_id, service_id, person_id, service_catalog_id, unit, proration, currency, amount, valid_from, valid_to, version, supersedes_id, status, reason, created_at",
    )
    .eq("workspace_id", ws)
    .order("valid_from", { ascending: false })
    .limit(500);
  if (error) throw new Error(billingError(error.message));
  const rows = data ?? [];
  const pick = (k: keyof (typeof rows)[number]) =>
    Array.from(new Set(rows.map((r) => r[k] as string | null).filter(Boolean))) as string[];
  const [projects, services, people, catalog, allocations, users] = await Promise.all([
    pick("project_id").length
      ? db.from("projects").select("id, name").in("id", pick("project_id"))
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    pick("service_id").length
      ? db.from("services").select("id, name").in("id", pick("service_id"))
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    pick("person_id").length
      ? db.from("people").select("id, full_name").in("id", pick("person_id"))
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    pick("service_catalog_id").length
      ? db.from("service_catalog").select("id, name").in("id", pick("service_catalog_id"))
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    pick("allocation_id").length
      ? db
          .from("people_allocations")
          .select("id, role_title, people(full_name)")
          .in("id", pick("allocation_id"))
      : Promise.resolve({
          data: [] as { id: string; role_title: string | null; people: unknown }[],
        }),
    namesFor(db, pick("user_id")),
  ]);
  const map = (list: Array<{ id: string; name?: string; full_name?: string }> | null) =>
    Object.fromEntries((list ?? []).map((x) => [x.id, x.name ?? x.full_name ?? "—"]));
  const pj = map(projects.data as never);
  const sv = map(services.data as never);
  const pe = map(people.data as never);
  const ct = map(catalog.data as never);
  const al = Object.fromEntries(
    (
      (allocations.data ?? []) as Array<{
        id: string;
        role_title: string | null;
        people: { full_name?: string } | null;
      }>
    ).map((a) => [
      a.id,
      `${a.people?.full_name ?? "Pessoa"}${a.role_title ? ` · ${a.role_title}` : ""}`,
    ]),
  );
  return rows.map((r) => ({
    ...(r as Omit<RateRow, "target_label">),
    amount: Number(r.amount),
    target_label:
      r.scope === "exception"
        ? `${pj[r.project_id ?? ""] ?? "Projeto"} · ${users[r.user_id ?? ""] ?? "Pessoa"}`
        : r.scope === "allocation"
          ? (al[r.allocation_id ?? ""] ?? "Alocação")
          : r.scope === "service"
            ? (sv[r.service_id ?? ""] ?? "Serviço")
            : r.scope === "person"
              ? (pe[r.person_id ?? ""] ?? "Pessoa")
              : (ct[r.service_catalog_id ?? ""] ?? "Catálogo"),
  }));
}

export async function loadConfigs(db: Db, contractId: string): Promise<BillingConfigRow[]> {
  const { data, error } = await db
    .from("project_billing_configs")
    .select(
      "id, contract_id, service_id, model, currency, params, valid_from, valid_to, version, status, reason, created_at, services(name)",
    )
    .eq("contract_id", contractId)
    .order("valid_from", { ascending: false })
    .limit(100);
  if (error) throw new Error(billingError(error.message));
  return (data ?? []).map((r) => {
    const { services, ...rest } = r as typeof r & { services: { name: string } | null };
    return { ...(rest as unknown as BillingConfigRow), service_name: services?.name ?? null };
  });
}

export async function loadMeasurementDetail(db: Db, id: string): Promise<MeasurementDetail> {
  const { data: m, error } = await db
    .from("project_measurements")
    .select(
      "id, config_id, contract_id, service_id, model, currency, period_from, period_to, timezone, kind, status, revision, lines_hash, total_amount, total_seconds, blockers, gates, warnings, rules_snapshot, financial_entry_id, failure_reason, created_at, created_by, submitted_by, approved_by, closed_reason",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(billingError(error.message));
  if (!m) throw new Error("Medição não encontrada ou sem permissão.");
  const [linesRes, eventsRes, linksRes] = await Promise.all([
    db
      .from("project_measurement_lines")
      .select(
        "id, line_no, source_type, source_id, project_id, user_id, work_date, seconds, billed_seconds, quantity, unit, rate_amount, amount, included, active, issue, description, detail",
      )
      .eq("measurement_id", id)
      .order("line_no")
      .limit(5000),
    db
      .from("project_billing_events")
      .select("id, action, actor, reason, created_at")
      .eq("entity_type", "measurement")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("project_measurement_financial_links")
      .select("financial_entry_id, kind, active")
      .eq("measurement_id", id),
  ]);
  if (linesRes.error) throw new Error(billingError(linesRes.error.message));
  const lines: MeasurementLine[] = (linesRes.data ?? []).map((l) => {
    const d = (l.detail ?? {}) as Record<string, unknown>;
    const { detail: _d, ...rest } = l;
    return {
      ...(rest as Omit<MeasurementLine, "package_seconds" | "reason">),
      package_seconds: typeof d.package_seconds === "number" ? d.package_seconds : null,
      reason: typeof d.reason === "string" ? d.reason : null,
    };
  });
  const links = linksRes.data ?? [];
  // Valores do título: só aparecem se a pessoa também lê o Financeiro (RLS de financial_entries).
  const fe = links.length
    ? await db
        .from("financial_entries")
        .select("id, amount, paid_amount, status, due_date")
        .in(
          "id",
          links.map((x) => x.financial_entry_id),
        )
    : {
        data: [] as Array<{
          id: string;
          amount: number;
          paid_amount: number;
          status: string;
          due_date: string;
        }>,
      };
  const feMap = new Map((fe.data ?? []).map((x) => [x.id, x]));
  const projectIds = Array.from(
    new Set(lines.map((l) => l.project_id).filter(Boolean)),
  ) as string[];
  const [names, projects] = await Promise.all([
    namesFor(db, [
      ...lines.map((l) => l.user_id ?? ""),
      ...(eventsRes.data ?? []).map((e) => e.actor ?? ""),
      m.created_by,
      m.submitted_by ?? "",
      m.approved_by ?? "",
    ]),
    projectIds.length
      ? db.from("projects").select("id, name").in("id", projectIds.slice(0, 500))
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  for (const p of projects.data ?? []) names[p.id] = p.name;
  return {
    measurement: m as unknown as MeasurementDetail["measurement"],
    lines,
    events: (eventsRes.data ?? []).map((e) => ({
      ...e,
      actor_name: e.actor ? (names[e.actor] ?? null) : null,
    })),
    names,
    financial: links.map((x) => {
      const row = feMap.get(x.financial_entry_id);
      return {
        id: x.financial_entry_id,
        kind: x.kind,
        active: x.active,
        amount: row ? Number(row.amount) : null,
        paid_amount: row ? Number(row.paid_amount) : null,
        status: row?.status ?? null,
        due_date: row?.due_date ?? null,
      };
    }),
  };
}

export type { MeasurementRow };

export type RateTargetOptions = {
  projects: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string; currency: string }>;
  people: Array<{ id: string; name: string }>;
  allocations: Array<{ id: string; name: string }>;
  catalog: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string }>;
};

/** Opções de alvo para tarifas (lidas como o usuário; sem valores). */
export async function loadRateOptions(db: Db, ws: string): Promise<RateTargetOptions> {
  const [projects, services, people, allocations, catalog, members] = await Promise.all([
    db.from("projects").select("id, name").eq("workspace_id", ws).order("name").limit(1000),
    db
      .from("services")
      .select("id, name, currency")
      .eq("workspace_id", ws)
      .order("name")
      .limit(1000),
    db.from("people").select("id, full_name").eq("workspace_id", ws).order("full_name").limit(1000),
    db
      .from("people_allocations")
      .select("id, role_title, starts_at, people(full_name)")
      .eq("workspace_id", ws)
      .order("starts_at", { ascending: false })
      .limit(1000),
    db.from("service_catalog").select("id, name").eq("workspace_id", ws).order("name").limit(1000),
    db
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", ws)
      .eq("status", "active")
      .limit(1000),
  ]);
  const memberNames = await namesFor(
    db,
    (members.data ?? []).map((m) => m.user_id),
  );
  return {
    projects: (projects.data ?? []).map((p) => ({ id: p.id, name: p.name })),
    services: (services.data ?? []).map((s) => ({ id: s.id, name: s.name, currency: s.currency })),
    people: (people.data ?? []).map((p) => ({ id: p.id, name: p.full_name ?? "Sem nome" })),
    allocations: (
      (allocations.data ?? []) as Array<{
        id: string;
        role_title: string | null;
        starts_at: string;
        people: { full_name?: string } | null;
      }>
    ).map((a) => ({
      id: a.id,
      name: `${a.people?.full_name ?? "Pessoa"}${a.role_title ? ` · ${a.role_title}` : ""} (desde ${a.starts_at.split("-").reverse().join("/")})`,
    })),
    catalog: (catalog.data ?? []).map((c) => ({ id: c.id, name: c.name })),
    members: Object.entries(memberNames)
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  };
}

export type ContractServiceOption = {
  id: string;
  name: string;
  type: string;
  status: string;
  cadence: string | null;
  currency: string;
  billing_model: string | null;
};

export async function loadContractBillingContext(db: Db, contractId: string) {
  const [contract, services] = await Promise.all([
    db
      .from("contracts")
      .select("id, title, number, role, currency, monthly_value")
      .eq("id", contractId)
      .maybeSingle(),
    db
      .from("services")
      .select("id, name, type, status, cadence, currency, billing_model")
      .eq("contract_id", contractId)
      .order("name")
      .limit(200),
  ]);
  if (contract.error) throw new Error(billingError(contract.error.message));
  if (!contract.data) throw new Error("Contrato não encontrado.");
  return {
    contract: contract.data,
    services: (services.data ?? []) as ContractServiceOption[],
  };
}
