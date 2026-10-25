import { workRpc } from "@/lib/access-control/work-core.server";
import type { Database } from "@/integrations/supabase/types";
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
import { buildMergeContext } from "@/lib/contracts/template-merge.server";
import { deleteByIdGuarded } from "@/lib/db/delete-guarded";

const VIEW = [
  "techcontracts.contract_templates.view.own",
  "techcontracts.contract_templates.view.team",
  "techcontracts.contract_templates.view.team",
  "techcontracts.contract_templates.view.workspace",
];
const CREATE = [
  "techcontracts.contract_templates.create.own",
  "techcontracts.contract_templates.create.team",
  "techcontracts.contract_templates.create.workspace",
];
const UPDATE = [
  "techcontracts.contract_templates.update.own",
  "techcontracts.contract_templates.update.team",
  "techcontracts.contract_templates.update.team",
  "techcontracts.contract_templates.update.workspace",
];
const DELETE = [
  "techcontracts.contract_templates.delete.own",
  "techcontracts.contract_templates.delete.team",
  "techcontracts.contract_templates.delete.workspace",
];

const roleEnum = z.enum(["provider", "client"]);
const statusEnum = z.enum(["draft", "published", "archived"]);

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

export const createContractTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => upsertFields.parse(input))
  .handler(async ({ data, context }) => {
    const { serviceIds, ...fields } = data;
    return workRpc<Database["public"]["Tables"]["contract_templates"]["Row"]>(
      context.supabase,
      "contract_template_save_checked",
      { p_id: null, p_patch: fields, p_services: serviceIds ?? null, p_copy: null },
    );
  });

export const updateContractTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), patch: upsertFields.partial() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { serviceIds, ...fields } = data.patch;
    return workRpc<Database["public"]["Tables"]["contract_templates"]["Row"]>(
      context.supabase,
      "contract_template_save_checked",
      { p_id: data.id, p_patch: fields, p_services: serviceIds ?? null, p_copy: null },
    );
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
    return workRpc<Database["public"]["Tables"]["contract_templates"]["Row"]>(
      context.supabase,
      "contract_template_save_checked",
      { p_id: null, p_patch: {}, p_services: null, p_copy: data.id },
    );
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
