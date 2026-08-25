// Catálogo dinâmico de campos por entidade para o construtor de filtros.
// Retorna lista de colunas com tipo inferido e, quando aplicável,
// valores distintos (até 21) já escolhidos como opções.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { REF_COLUMNS, type RefKind } from "./entity-fields-refs";
import { isMoneyField } from "./format/money-fields";

import { toLabel, UUID_RE, LEGACY_SYSTEM_FIELDS } from "./entity-fields-meta";
import {
  CONTRACT_FIELD_OPTIONS,
  CONTRACT_FREE_TEXT_FIELDS,
  CONTRACT_SYSTEM_FIELDS,
} from "./contracts/workflow-field-meta";

export type EntityFieldType = "text" | "number" | "currency" | "date" | "select" | "boolean";

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
          "ats_offers",
          "projects",
          "project_tasks",
          "project_milestones",
          "contracts",
          "financial_entries",
          "bank_payments",
          "quotes",
          "proposals",
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
      // Identificação/título: sempre texto livre (com pills de variáveis).
      "name",
      "title",
      "subject",
      "full_name",
      "first_name",
      "last_name",
      "company_name",
      "label",
      "code",
      "slug",
      "email",
      "phone",
      "document",
      "cnpj",
      "cpf",
    ]);

    const isContracts = data.entity === "contracts";
    // Listas canônicas por entidade (substituem amostragem de valores distintos).
    const canonicalOptions: Record<string, { value: string; label: string }[]> = isContracts
      ? CONTRACT_FIELD_OPTIONS
      : {};
    const freeTextByEntity = isContracts ? CONTRACT_FREE_TEXT_FIELDS : new Set<string>();
    const systemFields = isContracts ? CONTRACT_SYSTEM_FIELDS : new Set<string>();
    // Colunas legadas que duplicam um campo oficial (associação real por ID):
    // ficam no bloco recolhido para não parecerem campos repetidos.
    const legacySystemFields = LEGACY_SYSTEM_FIELDS;

    const fields: EntityFieldDef[] = [];
    for (const r of allRows) {
      const isPipelineStageField =
        r.column_name === "stage_id" &&
        (data.entity === "deals" || data.entity === "leads" || data.entity === "tickets");
      if ((HIDDEN.has(r.column_name) && !isPipelineStageField) || isSyncColumn(r.column_name))
        continue;
      const inferred = inferType(r.data_type);
      // Colunas numéricas com nome de dinheiro viram "currency" (formatação BRL).
      const type: EntityFieldType =
        inferred === "number" && isMoneyField(r.column_name) ? "currency" : inferred;

      const def: EntityFieldDef = {
        name: r.column_name,
        label: toLabel(r.column_name, data.entity),
        type,
        required: r.is_nullable === "NO" && !r.has_default,
      };
      if (systemFields.has(r.column_name) || legacySystemFields.has(r.column_name))
        def.system = true;
      if (isContracts && r.column_name === "body_html") def.richText = true;

      const ref = REF_COLUMNS[r.column_name];
      if (ref) {
        // Referência: seletor com busca por nome; grava o ID e nunca lista hashes.
        def.ref = ref;
        def.type = "text";
      } else if (canonicalOptions[r.column_name]) {
        def.type = "select";
        def.options = canonicalOptions[r.column_name];
      } else if (
        pipelineStageOptions &&
        (r.column_name === "stage" || r.column_name === "stage_id")
      ) {
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
