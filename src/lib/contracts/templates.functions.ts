// Server functions dos Modelos de Contrato (TechContracts).
// Um modelo é um corpo Rich Text com variáveis ({{...}}) que pode ser aplicado
// para gerar contratos reais — inclusive a partir do TechSales.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";
import { mergeTemplateBody } from "@/lib/contracts/template-tokens";
import type { Json } from "@/integrations/supabase/types";
import { deleteByIdGuarded } from "@/lib/db/delete-guarded";

const VIEW = [
  "techcontracts.contract_templates.view.own",
  "techcontracts.contract_templates.view.team",
  "techcontracts.contract_templates.view.workspace",
];
const CREATE = [
  "techcontracts.contract_templates.create.own",
  "techcontracts.contract_templates.create.workspace",
];
const UPDATE = [
  "techcontracts.contract_templates.update.own",
  "techcontracts.contract_templates.update.team",
  "techcontracts.contract_templates.update.workspace",
];
const DELETE = [
  "techcontracts.contract_templates.delete.own",
  "techcontracts.contract_templates.delete.workspace",
];

const roleEnum = z.enum(["provider", "client"]);
const statusEnum = z.enum(["draft", "published", "archived"]);

function generateNumber() {
  const yearMonth = new Date().toISOString().slice(0, 7).replace("-", "");
  return `C-${yearMonth}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

// ============= LIST =============

export const listContractTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        status: statusEnum.optional(),
        role: roleEnum.optional(),
        serviceCatalogId: z.string().uuid().optional(),
        search: z.string().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, VIEW);

    let q = supabase
      .from("contract_templates")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    if (data.role) q = q.eq("role", data.role);
    if (data.search?.trim()) q = q.ilike("name", `%${data.search.trim()}%`);
    const { data: rows, error } = await q;
    if (error) throw error;

    const ids = (rows ?? []).map((r) => r.id);
    let links: { template_id: string; service_catalog_id: string }[] = [];
    if (ids.length) {
      const { data: l } = await supabase
        .from("contract_template_services")
        .select("template_id, service_catalog_id")
        .in("template_id", ids);
      links = l ?? [];
    }
    const svcIds = Array.from(new Set(links.map((l) => l.service_catalog_id)));
    let services: { id: string; name: string }[] = [];
    if (svcIds.length) {
      const { data: s } = await supabase
        .from("service_catalog")
        .select("id, name")
        .in("id", svcIds);
      services = s ?? [];
    }
    const nameById = new Map(services.map((s) => [s.id, s.name]));

    let filtered = rows ?? [];
    if (data.serviceCatalogId) {
      const allowed = new Set(
        links
          .filter((l) => l.service_catalog_id === data.serviceCatalogId)
          .map((l) => l.template_id),
      );
      filtered = filtered.filter((r) => allowed.has(r.id));
    }

    return filtered.map((r) => ({
      ...r,
      services: links
        .filter((l) => l.template_id === r.id)
        .map((l) => ({
          id: l.service_catalog_id,
          name: nameById.get(l.service_catalog_id) ?? "—",
        })),
    }));
  });

export const getContractTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, VIEW);

    const { data: row, error } = await supabase
      .from("contract_templates")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;

    const { data: links } = await supabase
      .from("contract_template_services")
      .select("service_catalog_id")
      .eq("template_id", data.id);
    return { ...row, serviceIds: (links ?? []).map((l) => l.service_catalog_id) };
  });

// ============= CREATE / UPDATE / DELETE =============

const upsertFields = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  role: roleEnum.optional(),
  service_type: z.string().max(60).nullable().optional(),
  body_html: z.string().max(400_000).nullable().optional(),
  defaults: z.record(z.string(), z.unknown()).nullable().optional(),
  status: statusEnum.optional(),
  is_default: z.boolean().optional(),
  source_file_path: z.string().nullable().optional(),
  imported_from: z.enum(["pdf", "docx"]).nullable().optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
});

async function syncServices(
  supabase: { from: (t: string) => any },
  workspaceId: string,
  templateId: string,
  serviceIds: string[],
) {
  // Sincronização de filhos: limpeza idempotente antes de reinserir o vínculo.
  // 0 linhas afetadas é resultado válido (modelo sem serviços), por isso não há
  // guarda de permissão aqui — o gate está no upsert do modelo.
  await supabase.from("contract_template_services").delete().eq("template_id", templateId);
  if (!serviceIds.length) return;
  const { error } = await supabase.from("contract_template_services").insert(
    serviceIds.map((id) => ({
      workspace_id: workspaceId,
      template_id: templateId,
      service_catalog_id: id,
    })),
  );
  if (error) throw error;
}

export const createContractTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => upsertFields.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, CREATE);

    const { serviceIds, ...fields } = data;
    const { data: row, error } = await supabase
      .from("contract_templates")
      .insert({
        workspace_id: workspaceId,
        owner_id: userId,
        assigned_to: userId,
        name: fields.name,
        description: fields.description ?? null,
        role: fields.role ?? "provider",
        service_type: fields.service_type ?? null,
        body_html: fields.body_html ?? null,
        defaults: (fields.defaults ?? {}) as Json,
        status: fields.status ?? "draft",
        is_default: fields.is_default ?? false,
        source_file_path: fields.source_file_path ?? null,
        imported_from: fields.imported_from ?? undefined,
      })
      .select("*")
      .single();
    if (error) throw error;
    if (serviceIds?.length) await syncServices(supabase, workspaceId, row.id, serviceIds);
    return row;
  });

export const updateContractTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), patch: upsertFields.partial() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, UPDATE);

    const { serviceIds, ...patch } = data.patch;
    if (Object.keys(patch).length) {
      const { error } = await supabase
        .from("contract_templates")
        .update(patch as never)
        .eq("id", data.id);
      if (error) throw error;
    }
    if (serviceIds) await syncServices(supabase, workspaceId, data.id, serviceIds);

    const { data: row, error: rErr } = await supabase
      .from("contract_templates")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (rErr) throw rErr;
    return row;
  });

export const deleteContractTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, DELETE);
    await deleteByIdGuarded(supabase, "contract_templates", data.id);
    return { ok: true };
  });

export const duplicateContractTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, CREATE);

    const { data: src, error } = await supabase
      .from("contract_templates")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!src) throw new Error("Modelo não encontrado");

    const { data: row, error: iErr } = await supabase
      .from("contract_templates")
      .insert({
        workspace_id: workspaceId,
        owner_id: userId,
        assigned_to: userId,
        name: `${src.name} (cópia)`,
        description: src.description,
        role: src.role,
        service_type: src.service_type,
        body_html: src.body_html,
        variables: src.variables,
        defaults: src.defaults,
        status: "draft",
        is_default: false,
      })
      .select("*")
      .single();
    if (iErr) throw iErr;

    const { data: links } = await supabase
      .from("contract_template_services")
      .select("service_catalog_id")
      .eq("template_id", data.id);
    const ids = (links ?? []).map((l) => l.service_catalog_id);
    if (ids.length) await syncServices(supabase, workspaceId, row.id, ids);
    return row;
  });

// ============= SERVIÇOS DO CATÁLOGO (para vincular) =============

export const listTemplateServiceOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("service_catalog")
      .select("id, name, code, service_type, unit, base_price, currency, description, active")
      .eq("active", true)
      .order("name", { ascending: true })
      .limit(500);
    if (error) throw error;
    return data ?? [];
  });

// ============= CONTEXTO DE MERGE =============

type MergeInput = {
  templateId: string;
  dealId?: string;
  companyId?: string;
  serviceCatalogId?: string;
  title?: string;
};

async function buildMergeContext(
  supabase: any,
  workspaceId: string,
  userId: string,
  input: MergeInput,
  template: Record<string, any>,
) {
  const defaults = (template.defaults ?? {}) as Record<string, unknown>;

  let deal: any = null;
  if (input.dealId) {
    const { data } = await supabase
      .from("deals")
      .select("id, name, value, currency, company_id")
      .eq("id", input.dealId)
      .maybeSingle();
    deal = data;
  }

  const companyId = input.companyId ?? deal?.company_id ?? null;
  let company: any = null;
  if (companyId) {
    const { data } = await supabase
      .from("companies")
      .select("id, name, cnpj, address, city, state, phone")
      .eq("id", companyId)
      .maybeSingle();
    company = data;
  }

  let contact: any = null;
  if (companyId) {
    const { data } = await supabase
      .from("contacts")
      .select("first_name, last_name, email, phone")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true })
      .limit(1);
    contact = data?.[0] ?? null;
  }

  const { data: entity } = await supabase
    .from("legal_entities")
    .select("id, name, cnpj")
    .eq("workspace_id", workspaceId)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  let service: any = null;
  if (input.serviceCatalogId) {
    const { data } = await supabase
      .from("service_catalog")
      .select("name, description, unit, base_price, currency, service_type")
      .eq("id", input.serviceCatalogId)
      .maybeSingle();
    service = data;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();

  const now = new Date();
  const title =
    input.title?.trim() ||
    (deal?.name
      ? `${template.name} — ${deal.name}`
      : company?.name
        ? `${template.name} — ${company.name}`
        : template.name);

  const contract = {
    number: generateNumber(),
    title,
    starts_at: (defaults.starts_at as string) ?? null,
    ends_at: (defaults.ends_at as string) ?? null,
    notice_days: (defaults.notice_days as number) ?? 30,
    total_value: (defaults.total_value as number) ?? deal?.value ?? service?.base_price ?? 0,
    monthly_value: (defaults.monthly_value as number) ?? null,
    currency: (defaults.currency as string) ?? deal?.currency ?? service?.currency ?? "BRL",
    payment_day: (defaults.payment_day as number) ?? null,
    payment_method: (defaults.payment_method as string) ?? null,
    readjustment_index: (defaults.readjustment_index as string) ?? null,
    penalty_percent: (defaults.penalty_percent as number) ?? null,
    service_type: template.service_type ?? service?.service_type ?? null,
    service_scope: (defaults.service_scope as string) ?? service?.description ?? null,
    service_location: (defaults.service_location as string) ?? null,
    jurisdiction: (defaults.jurisdiction as string) ?? null,
    governing_law: (defaults.governing_law as string) ?? null,
  };

  const ctx = {
    contract,
    counterparty: {
      name: company?.name ?? null,
      cnpj: company?.cnpj ?? null,
      address: company?.address ?? null,
      city: company?.city ?? null,
      state: company?.state ?? null,
    },
    contracting: { name: entity?.name ?? null, cnpj: entity?.cnpj ?? null, address: null },
    contact: {
      full_name: contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") : null,
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
    },
    deal: { name: deal?.name ?? null, value: deal?.value ?? null },
    service: {
      name: service?.name ?? null,
      description: service?.description ?? null,
      unit: service?.unit ?? null,
      base_price: service?.base_price ?? null,
    },
    today: now.toLocaleDateString("pt-BR"),
    today_long: now.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }),
    agent: { name: profile?.full_name ?? null, email: profile?.email ?? null },
  };

  return { ctx, contract, company, deal, entity };
}

const applyInput = z.object({
  templateId: z.string().uuid(),
  dealId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  serviceCatalogId: z.string().uuid().optional(),
  title: z.string().max(200).optional(),
});

/** Pré-visualização: devolve o corpo já mesclado sem criar contrato. */
export const previewContractFromTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => applyInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, VIEW);

    const { data: template, error } = await supabase
      .from("contract_templates")
      .select("*")
      .eq("id", data.templateId)
      .maybeSingle();
    if (error) throw error;
    if (!template) throw new Error("Modelo não encontrado");

    const { ctx, contract } = await buildMergeContext(
      supabase,
      workspaceId,
      userId,
      data,
      template,
    );
    return {
      title: contract.title,
      body_html: mergeTemplateBody(template.body_html ?? "", ctx),
      template_name: template.name,
    };
  });

/** Gera um contrato em rascunho a partir do modelo. */
export const createContractFromTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => applyInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techcontracts.contracts.create.own",
      "techcontracts.contracts.create.workspace",
    ]);

    const { data: template, error } = await supabase
      .from("contract_templates")
      .select("*")
      .eq("id", data.templateId)
      .maybeSingle();
    if (error) throw error;
    if (!template) throw new Error("Modelo não encontrado");

    const { ctx, contract, company, deal } = await buildMergeContext(
      supabase,
      workspaceId,
      userId,
      data,
      template,
    );

    const { data: row, error: iErr } = await supabase
      .from("contracts")
      .insert({
        workspace_id: workspaceId,
        owner_id: userId,
        assigned_to: userId,
        role: template.role ?? "provider",
        title: contract.title,
        counterparty_company_id: company?.id ?? null,
        deal_id: deal?.id ?? data.dealId ?? null,
        number: contract.number,
        public_token: randomBytes(24).toString("hex"),
        status: "draft",
        starts_at: contract.starts_at,
        ends_at: contract.ends_at,
        notice_days: contract.notice_days,
        total_value: contract.total_value ?? 0,
        monthly_value: contract.monthly_value,
        currency: contract.currency,
        payment_day: contract.payment_day,
        payment_method: contract.payment_method,
        readjustment_index: contract.readjustment_index,
        penalty_percent: contract.penalty_percent,
        service_type: contract.service_type,
        service_scope: contract.service_scope,
        service_location: contract.service_location,
        jurisdiction: contract.jurisdiction,
        governing_law: contract.governing_law,
        body_html: mergeTemplateBody(template.body_html ?? "", ctx),
        metadata: { contract_template_id: template.id, contract_template_name: template.name },
      })
      .select("id, title, number")
      .single();
    if (iErr) throw iErr;
    return row;
  });
