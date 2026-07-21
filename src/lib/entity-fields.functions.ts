// Catálogo dinâmico de campos por entidade para o construtor de filtros.
// Retorna lista de colunas com tipo inferido e, quando aplicável,
// valores distintos (até 21) já escolhidos como opções.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EntityFieldType = "text" | "number" | "date" | "select" | "boolean";

export type EntityFieldDef = {
  name: string;
  label: string;
  type: EntityFieldType;
  // Quando preenchido (≤20), o construtor renderiza Select.
  options?: { value: string; label: string }[];
  /** Campo é obrigatório no schema (NOT NULL sem default). */
  required?: boolean;
};

type RawRow = {
  column_name: string;
  data_type: string;
  distinct_values: string[] | null;
  distinct_count: number | null;
  is_nullable?: string | null;
  has_default?: boolean | null;
};

// Colunas internas/sistema escondidas do builder.
const HIDDEN = new Set<string>([
  "id",
  "owner_id",
  "workspace_id",
  "deleted_at",
  "portal_token",
  "hs_raw",
  "external_ids",
  "custom_fields",
  "hs_object_id",
  "hubspot_owner_id",
  "hs_lastmodifieddate",
  "hs_createdate",
  "converted_at",
  "converted_contact_id",
  "converted_deal_id",
]);

// Rótulos amigáveis (pt-BR) — fallback é snake_case → Title Case.
const LABELS: Record<string, string> = {
  first_name: "Nome",
  last_name: "Sobrenome",
  email: "Email",
  phone: "Telefone",
  mobile_phone: "Celular",
  company: "Empresa",
  company_name: "Empresa",
  company_id: "Empresa",
  source: "Origem",
  status: "Status",
  score: "Score",
  label: "Etiqueta",
  notes: "Notas",
  job_title: "Cargo",
  title: "Cargo",
  city: "Cidade",
  state: "UF",
  country: "País",
  cep: "CEP",
  address: "Endereço",
  website: "Site",
  domain: "Domínio",
  cnpj: "CNPJ",
  cnpj_enriched_at: "CNPJ enriquecido em",
  industry: "Setor",
  size: "Porte",
  annualrevenue: "Receita anual",
  is_target_account: "Target account",
  target_account_tier: "Tier de target",
  type: "Tipo",
  marketing_status: "Status de marketing",
  legal_basis: "Base legal",
  consent_date: "Data de consentimento",
  lifecyclestage: "Lifecycle stage",
  hs_lead_status: "Status (HubSpot)",
  linkedin_url: "LinkedIn",
  linkedin_company_page: "LinkedIn da empresa",
  twitter_handle: "Twitter",
  twitterhandle: "Twitter",
  facebook_company_page: "Facebook da empresa",
  portal_enabled: "Portal habilitado",
  assigned_user_id: "Responsável",
  pipeline_id: "Pipeline",
  stage: "Etapa",
  stage_id: "Etapa (ID)",
  name: "Nome",
  value: "Valor",
  currency: "Moeda",
  expected_close_date: "Fechamento esperado",
  dealtype: "Tipo de negócio",
  hs_priority: "Prioridade",
  hs_deal_stage_probability: "Probabilidade",
  closed_lost_reason: "Motivo de perda",
  closed_won_reason: "Motivo de ganho",
  num_associated_contacts: "Nº contatos associados",
  primary_contact_id: "Contato principal",
  parent_company_id: "Empresa-mãe",
  hubspot_owner_id_text: "Responsável (HubSpot)",
  hs_lead_source_detail: "Detalhe da origem",
  description: "Descrição",
  timezone: "Fuso horário",
  created_at: "Criado em",
  updated_at: "Atualizado em",
  // Tickets
  subject: "Assunto",
  priority: "Prioridade",
  assignee_id: "Responsável",
  due_at: "Vence em",
  sla_policy_id: "Política de SLA",
  first_response_at: "Primeira resposta em",
  resolved_at: "Resolvido em",
  closed_at: "Fechado em",
  reopened_at: "Reaberto em",
  contact_id: "Contato",
  deal_id: "Negócio",
  tags: "Tags",
  channel: "Canal",
  category: "Categoria",
  subcategory: "Subcategoria",
  resolution: "Resolução",
  satisfaction_score: "Nota de satisfação",
  ticket_number: "Número do chamado",
  sla_response_due_at: "SLA de resposta até",
  sla_resolution_due_at: "SLA de resolução até",
  sla_breached: "SLA violado",
  csat_rating: "Avaliação CSAT",
  csat_comment: "Comentário CSAT",
  kb_article_ids: "Artigos KB vinculados",
  is_public: "Público",
  external_id: "ID externo",
  form_id: "Formulário",
  // Atividades / tarefas
  body: "Descrição",
  activity_type: "Tipo de atividade",
  due_date: "Vence em",
  completed_at: "Concluída em",
  // Projects / tasks / milestones
  project_id: "Projeto",
  milestone_id: "Marco",
  parent_task_id: "Tarefa pai",
  start_date: "Início",
  end_date: "Término",
  estimated_hours: "Horas estimadas",
  actual_hours: "Horas realizadas",
  progress: "Progresso",
  // Finance
  amount: "Valor",
  net_amount: "Valor líquido",
  gross_amount: "Valor bruto",
  due_at_date: "Vence em",
  paid_at: "Pago em",
  category_id: "Categoria",
  cost_center_id: "Centro de custo",
  legal_entity_id: "Empresa (CNPJ)",
  bank_account_id: "Conta bancária",
  direction: "Direção",
  payment_method: "Método de pagamento",
  reference: "Referência",
  // Contracts / quotes / proposals
  contract_id: "Contrato",
  deal_id_ref: "Negócio",
  start_at: "Início da vigência",
  end_at: "Fim da vigência",
  total: "Total",
  subtotal: "Subtotal",
  discount: "Desconto",
  tax: "Imposto",
  valid_until: "Válido até",
  // Products / services / recurring plans
  sku: "SKU",
  unit_price: "Preço unitário",
  unit: "Unidade",
  billing_cycle: "Ciclo de cobrança",
  interval: "Intervalo",

};

function toLabel(col: string): string {
  if (LABELS[col]) return LABELS[col];
  return col.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function inferType(dataType: string): EntityFieldType {
  if (dataType === "boolean") return "boolean";
  if (
    dataType === "integer" ||
    dataType === "numeric" ||
    dataType === "bigint" ||
    dataType === "double precision" ||
    dataType === "real" ||
    dataType === "smallint"
  )
    return "number";
  if (dataType.startsWith("timestamp") || dataType === "date") return "date";
  return "text";
}

export const getEntityFieldCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        entity: z.enum([
          "leads",
          "contacts",
          "companies",
          "deals",
          "tickets",
          "activities",
          "ats_jobs",
          "ats_candidates",
          "ats_applications",
          "ats_interviews",
          "projects",
          "project_tasks",
          "project_milestones",
          "contracts",
          "financial_entries",
          "bank_payments",
          "quotes",
          "proposals",
          "products",
          "services",
          "recurring_plans",
          "subscription_invoices",
          "customer_invoices",
        ]),

      })
      .parse(input),

  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = (supabase as any).rpc.bind(supabase);
    const { data: rows, error } = await rpc("get_entity_field_catalog", {
      p_table: data.entity,
      p_owner_id: userId,
    });
    if (error) throw error;

    // Resolução de labels para FKs com valores legíveis.
    const allRows = (rows ?? []) as RawRow[];

    // Coleta UUIDs distintos para FKs conhecidas — buscaremos rótulos.
    const pipelineIds = new Set<string>();
    const companyIds = new Set<string>();
    const userIds = new Set<string>();
    for (const r of allRows) {
      if (!r.distinct_values) continue;
      if (r.column_name === "pipeline_id") r.distinct_values.forEach((v) => pipelineIds.add(v));
      else if (r.column_name === "company_id" || r.column_name === "parent_company_id")
        r.distinct_values.forEach((v) => companyIds.add(v));
      else if (r.column_name === "assigned_user_id" || r.column_name === "owner_id")
        r.distinct_values.forEach((v) => userIds.add(v));
    }

    const [pipelinesRes, companiesRes, usersRes] = await Promise.all([
      pipelineIds.size
        ? supabase
            .from("pipelines")
            .select("id, name")
            .in("id", [...pipelineIds])
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      companyIds.size
        ? supabase
            .from("companies")
            .select("id, name")
            .in("id", [...companyIds])
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      userIds.size
        ? supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", [...userIds])
        : Promise.resolve({
            data: [] as { id: string; full_name: string | null }[],
          }),
    ]);

    const pipelineMap = new Map(
      ((pipelinesRes.data ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]),
    );
    const companyMap = new Map(
      ((companiesRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]),
    );
    const userMap = new Map(
      (
        (usersRes.data ?? []) as {
          id: string;
          full_name: string | null;
        }[]
      ).map((u) => [u.id, u.full_name ?? u.id]),
    );

    // Para deals/leads, as etapas dependem do pipeline — buscamos a definição
    // canônica em pipelines.stages e usamos como opções do campo `stage` (e `stage_id`),
    // ignorando os valores distintos crus da coluna (que podem incluir lixo legado).
    let pipelineStageOptions: { value: string; label: string }[] | null = null;
    if (data.entity === "deals" || data.entity === "leads" || data.entity === "tickets") {
      const pipelineEntity =
        data.entity === "deals" ? "deal" : data.entity === "leads" ? "lead" : "ticket";
      const { data: pls } = await supabase
        .from("pipelines")
        .select("name, stages, entity")
        .eq("entity", pipelineEntity);
      const seen = new Set<string>();
      const opts: { value: string; label: string }[] = [];
      for (const p of (pls ?? []) as { name: string; stages: unknown }[]) {
        const stages = Array.isArray(p.stages)
          ? (p.stages as Array<{ value?: string; label?: string }>)
          : [];
        for (const s of stages) {
          if (!s?.value) continue;
          if (seen.has(s.value)) continue;
          seen.add(s.value);
          opts.push({
            value: s.value,
            label: `${p.name} · ${s.label ?? s.value}`,
          });
        }
      }
      if (opts.length) pipelineStageOptions = opts;
    }

    const fields: EntityFieldDef[] = [];
    for (const r of allRows) {
      if (HIDDEN.has(r.column_name)) continue;
      const type = inferType(r.data_type);
      const def: EntityFieldDef = {
        name: r.column_name,
        label: toLabel(r.column_name),
        type,
        required: r.is_nullable === "NO" && !r.has_default,
      };

      // Override: stage / stage_id usam catálogo do pipeline, não distinct values.
      if (pipelineStageOptions && (r.column_name === "stage" || r.column_name === "stage_id")) {
        def.type = "select";
        def.options = pipelineStageOptions;
      } else if (
        r.distinct_values &&
        r.distinct_count !== null &&
        r.distinct_count <= 20 &&
        r.distinct_count > 0 &&
        type !== "date" &&
        type !== "number"
      ) {
        const valuesOnly = r.distinct_values.slice(0, 20);
        def.type = "select";
        def.options = valuesOnly.map((v) => {
          let label = v;
          if (r.column_name === "pipeline_id") label = pipelineMap.get(v) ?? v;
          else if (r.column_name === "company_id" || r.column_name === "parent_company_id")
            label = companyMap.get(v) ?? v;
          else if (r.column_name === "assigned_user_id" || r.column_name === "owner_id")
            label = userMap.get(v) ?? v;
          else if (type === "boolean") label = v === "true" ? "Sim" : v === "false" ? "Não" : v;
          return { value: v, label };
        });
      }

      fields.push(def);
    }

    // Ordenação amigável: campos com valores listáveis primeiro,
    // depois datas, depois o resto alfabeticamente por label.
    fields.sort((a, b) => {
      const wa = a.type === "select" ? 0 : a.type === "date" ? 2 : 1;
      const wb = b.type === "select" ? 0 : b.type === "date" ? 2 : 1;
      if (wa !== wb) return wa - wb;
      return a.label.localeCompare(b.label, "pt-BR");
    });

    return { fields };
  });
