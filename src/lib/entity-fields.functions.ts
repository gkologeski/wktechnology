// Catálogo dinâmico de campos por entidade para o construtor de filtros.
// Retorna lista de colunas com tipo inferido e, quando aplicável,
// valores distintos (até 21) já escolhidos como opções.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { REF_COLUMNS, type RefKind } from "./entity-fields-refs";
import {
  CONTRACT_FIELD_LABELS,
  CONTRACT_FIELD_OPTIONS,
  CONTRACT_FREE_TEXT_FIELDS,
  CONTRACT_SYSTEM_FIELDS,
} from "./contracts/workflow-field-meta";

export type EntityFieldType = "text" | "number" | "date" | "select" | "boolean";

export type EntityFieldDef = {
  name: string;
  label: string;
  type: EntityFieldType;
  // Quando preenchido (≤20), o construtor renderiza Select.
  options?: { value: string; label: string }[];
  /** Campo é obrigatório no schema (NOT NULL sem default). */
  required?: boolean;
  /** Quando presente, o construtor renderiza seletor com busca por nome. */
  ref?: RefKind;
  /** Campo normalmente preenchido pelo sistema/integração — vai em bloco colapsado. */
  system?: boolean;
  /** Campo de texto rico (HTML) — renderiza editor WYSIWYG. */
  richText?: boolean;
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
  // Colunas técnicas/redundantes: já existe equivalente amigável ou são IDs
  // de sincronização que não fazem sentido em condições de workflow.
  "stage_id",
  "external_id",
  "hs_pipeline",
  "hs_pipeline_stage",
  "hs_deal_stage_probability_raw",
  "hubspot_id",
  "hubspot_owner_id_text",
  "sync_state_id",
  "import_batch_id",
]);

/** Esconde qualquer coluna `hs_*`/`hubspot_*` remanescente de sincronização. */
function isSyncColumn(col: string): boolean {
  return /^(hs_|hubspot_)/.test(col) && col !== "hs_lead_status" && col !== "hs_priority";
}

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

/**
 * Rótulos que dependem da entidade — evita traduções erradas do dicionário
 * global (ex.: `title` = "Cargo" em contatos, mas "Título" em contratos).
 */
const ENTITY_LABEL_OVERRIDES: Record<string, Record<string, string>> = {
  contracts: CONTRACT_FIELD_LABELS,
  quotes: { title: "Título da cotação" },
  proposals: { title: "Título da proposta" },
  ats_jobs: { title: "Título da vaga" },
  project_tasks: { title: "Título da tarefa" },
  project_milestones: { title: "Título do marco" },
  tickets: { title: "Título do chamado" },
  activities: { title: "Título da atividade" },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toLabel(col: string, entity?: string): string {
  const override = entity ? ENTITY_LABEL_OVERRIDES[entity]?.[col] : undefined;
  if (override) return override;
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

    const allRows = (rows ?? []) as RawRow[];

    // Para deals/leads/tickets, as etapas dependem do pipeline — buscamos a definição
    // canônica em pipelines.stages e usamos como opções do campo `stage`,
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

    // Campos com cadastro auxiliar: o construtor espelha o cadastro de origem.
    // Se o cadastro tem itens, é combo com esses itens; se está vazio, é texto livre.
    const registryOptions: Record<string, { value: string; label: string }[]> = {};
    const hasColumn = (col: string) => allRows.some((r) => r.column_name === col);
    if (hasColumn("closed_lost_reason")) {
      const { data: reasons } = await supabase
        .from("deal_loss_reasons")
        .select("value, label, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      const opts = ((reasons ?? []) as { value: string; label: string }[]).map((r) => ({
        value: r.label || r.value,
        label: r.label || r.value,
      }));
      if (opts.length) registryOptions["closed_lost_reason"] = opts;
    }
    if (hasColumn("source") || hasColumn("lead_source")) {
      const { data: sources } = await supabase.from("lead_sources").select("name").order("name");
      const opts = ((sources ?? []) as { name: string }[])
        .filter((s) => !!s.name)
        .map((s) => ({ value: s.name, label: s.name }));
      if (opts.length) {
        registryOptions["source"] = opts;
        registryOptions["lead_source"] = opts;
      }
    }

    // Campos cujo cadastro de entrada é digitação livre — nunca viram combo
    // a partir de amostragem de valores já existentes.
    const FREE_TEXT = new Set<string>([
      "dealtype",
      "closed_won_reason",
      "resolution",
      "reference",
      "notes",
      "description",
      "subcategory",
    ]);

    const isContracts = data.entity === "contracts";
    // Listas canônicas por entidade (substituem amostragem de valores distintos).
    const canonicalOptions: Record<string, { value: string; label: string }[]> = isContracts
      ? CONTRACT_FIELD_OPTIONS
      : {};
    const freeTextByEntity = isContracts ? CONTRACT_FREE_TEXT_FIELDS : new Set<string>();
    const systemFields = isContracts ? CONTRACT_SYSTEM_FIELDS : new Set<string>();

    const fields: EntityFieldDef[] = [];
    for (const r of allRows) {
      if (HIDDEN.has(r.column_name) || isSyncColumn(r.column_name)) continue;
      const type = inferType(r.data_type);
      const def: EntityFieldDef = {
        name: r.column_name,
        label: toLabel(r.column_name, data.entity),
        type,
        required: r.is_nullable === "NO" && !r.has_default,
      };
      if (systemFields.has(r.column_name)) def.system = true;
      if (isContracts && r.column_name === "body_html") def.richText = true;

      const ref = REF_COLUMNS[r.column_name];
      if (ref) {
        // Referência: seletor com busca por nome; grava o ID e nunca lista hashes.
        def.ref = ref;
        def.type = "text";
      } else if (canonicalOptions[r.column_name]) {
        def.type = "select";
        def.options = canonicalOptions[r.column_name];
      } else if (pipelineStageOptions && r.column_name === "stage") {
        def.type = "select";
        def.options = pipelineStageOptions;
      } else if (registryOptions[r.column_name]) {
        def.type = "select";
        def.options = registryOptions[r.column_name];
      } else if (FREE_TEXT.has(r.column_name) || freeTextByEntity.has(r.column_name)) {
        def.type = type === "boolean" ? "boolean" : "text";
      } else if (
        r.distinct_values &&
        r.distinct_count !== null &&
        r.distinct_count <= 20 &&
        r.distinct_count > 0 &&
        type !== "date" &&
        type !== "number" &&
        // Nunca transformar UUID cru em opção de combo.
        !r.distinct_values.some((v) => UUID_RE.test(v))
      ) {
        const valuesOnly = r.distinct_values.slice(0, 20);
        def.type = "select";
        def.options = valuesOnly.map((v) => ({
          value: v,
          label: type === "boolean" ? (v === "true" ? "Sim" : v === "false" ? "Não" : v) : v,
        }));
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
