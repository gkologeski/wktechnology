import { requireWorkPermission } from "@/lib/access-control/work-permission.middleware";
// Server functions for Services (Sprint 3 MVP).
// CRUD, ativação com cálculo de próxima cobrança, e disparo manual do motor de billing.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";

const typeEnum = z.enum(["one_time", "recurring", "usage_based", "milestone"]);
const statusEnum = z.enum(["pending", "active", "paused", "cancelled", "completed"]);
const cadenceEnum = z.enum(["monthly", "quarterly", "yearly", "on_delivery"]);
const roleEnum = z.enum(["provider", "client"]);

// ============= LIST =============

export const listServices = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techservice.services", "view")])
  .inputValidator((input) =>
    z
      .object({
        contractId: z.string().uuid().optional(),
        role: roleEnum.optional(),
        status: statusEnum.optional(),
        type: typeEnum.optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techservice.services.view.workspace",
      "techservice.services.view.own",
      "techservice.services.view.team",
    ]);
    let q = supabase
      .from("services")
      .select("*, contracts(id, number, title, counterparty_company_id)")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.contractId) q = q.eq("contract_id", data.contractId);
    if (data.role) q = q.eq("role", data.role);
    if (data.status) q = q.eq("status", data.status);
    if (data.type) q = q.eq("type", data.type);
    if (data.search && data.search.trim()) {
      q = q.ilike("name", `%${data.search.trim()}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    const serviceRows = rows ?? [];
    const sourceIds = serviceRows
      .map((row) => row.source_deal_line_item_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    const sourceNames = new Map<
      string,
      { service_name: string | null; preset_name: string | null }
    >();
    if (sourceIds.length > 0) {
      const { data: sources } = await supabase
        .from("deal_line_items")
        .select("id, service:service_catalog(name), preset:contracting_presets(name)")
        .in("id", sourceIds);
      for (const source of sources ?? []) {
        sourceNames.set(source.id, {
          service_name: source.service?.name ?? null,
          preset_name: source.preset?.name ?? null,
        });
      }
    }
    return serviceRows.map((row) => {
      const metadata =
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {};
      const source = row.source_deal_line_item_id
        ? sourceNames.get(row.source_deal_line_item_id)
        : undefined;
      return {
        ...row,
        service_name:
          (typeof metadata["service_name"] === "string" ? metadata["service_name"] : null) ??
          source?.service_name ??
          null,
        preset_name:
          (typeof metadata["preset_name"] === "string" ? metadata["preset_name"] : null) ??
          source?.preset_name ??
          null,
      };
    });
  });

export const listServiceIds = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techservice.services", "view")])
  .inputValidator((input) =>
    z
      .object({
        status: statusEnum.optional(),
        type: typeEnum.optional(),
        search: z.string().optional(),
        assigneeId: z.string().uuid().nullable().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techservice.services.view.workspace",
      "techservice.services.view.own",
      "techservice.services.view.team",
    ]);
    let q = supabase.from("services").select("id").order("id");
    if (data.status) q = q.eq("status", data.status);
    if (data.type) q = q.eq("type", data.type);
    if (data.search?.trim()) q = q.ilike("name", `%${data.search.trim()}%`);
    if (data.assigneeId === null) q = q.is("assigned_to", null);
    else if (data.assigneeId) q = q.eq("assigned_to", data.assigneeId);
    const { data: rows, error } = await q.limit(50_001);
    if (error) throw error;
    return (rows ?? []).map((row) => row.id);
  });

export const getService = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techservice.services", "view")])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techservice.services.view.workspace",
      "techservice.services.view.own",
      "techservice.services.view.team",
    ]);
    const { data: row, error } = await supabase
      .from("services")
      .select("*, contracts(id, number, title, counterparty_company_id, currency)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    return row;
  });

// ============= CREATE =============

const createInput = z.object({
  contractId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  type: typeEnum.default("recurring"),
  cadence: cadenceEnum.nullable().optional(),
  quantity: z.number().nonnegative().default(1),
  unitPrice: z.number().nonnegative().default(0),
  currency: z.string().default("BRL"),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  // Cobrança compartilhada com o catálogo e com os itens de linha do negócio.
  unit: z.string().max(40).nullable().optional(),
  billingModel: z
    .enum(["per_unit", "per_hour", "per_headcount_month", "percent_of_base", "fixed"])
    .nullable()
    .optional(),
  percent: z.number().nonnegative().nullable().optional(),
  percentBaseAmount: z.number().nonnegative().nullable().optional(),
});

export const createService = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techservice.services", "create")])
  .inputValidator((input) => createInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, ["techservice.services.create.own"]);

    // herda role e currency do contrato
    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .select("id, role, currency")
      .eq("id", data.contractId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!contract) throw new Error("Contrato não encontrado");

    const cadence =
      data.type === "recurring"
        ? (data.cadence ?? "monthly")
        : data.type === "milestone"
          ? "on_delivery"
          : null;

    const { data: row, error } = await supabase
      .from("services")
      .insert({
        workspace_id: workspaceId,
        owner_id: userId,
        contract_id: data.contractId,
        role: contract.role,
        name: data.name,
        description: data.description ?? null,
        type: data.type,
        cadence,
        quantity: data.quantity,
        unit_price: data.unitPrice,
        currency: data.currency || contract.currency || "BRL",
        starts_at: data.startsAt ?? null,
        ends_at: data.endsAt ?? null,
        unit: data.unit ?? null,
        billing_model: data.billingModel ?? null,
        percent: data.percent ?? null,
        percent_base_amount: data.percentBaseAmount ?? null,
        status: "pending",
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

// ============= UPDATE =============

const patchInput = z.object({
  id: z.string().uuid(),
  patch: z
    .object({
      name: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      type: typeEnum.optional(),
      status: statusEnum.optional(),
      cadence: cadenceEnum.nullable().optional(),
      quantity: z.number().nonnegative().optional(),
      unit_price: z.number().nonnegative().optional(),
      currency: z.string().optional(),
      starts_at: z.string().nullable().optional(),
      ends_at: z.string().nullable().optional(),
      next_billing_at: z.string().nullable().optional(),
      delivery_owner_id: z.string().uuid().nullable().optional(),
      job_profile_id: z.string().uuid().nullable().optional(),
      seniority: z.string().nullable().optional(),
      competencies: z.array(z.string()).optional(),
      unit: z.string().max(40).nullable().optional(),
      billing_model: z
        .enum(["per_unit", "per_hour", "per_headcount_month", "percent_of_base", "fixed"])
        .nullable()
        .optional(),
      percent: z.number().nonnegative().nullable().optional(),
      percent_base_amount: z.number().nonnegative().nullable().optional(),
    })
    .strict(),
});

export const updateService = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techservice.services", "update")])
  .inputValidator((input) => patchInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techservice.services.update.workspace",
      "techservice.services.update.own",
      "techservice.services.update.team",
    ]);
    const { data: row, error } = await supabase
      .from("services")
      .update(data.patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

// ============= DELETE =============

export const deleteService = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techservice.services", "delete")])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techservice.services.delete.workspace",
      "techservice.services.delete.own",
      "techservice.services.delete.team",
    ]);
    const { data: deleted, error } = await supabase
      .from("services")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (error) throw error;
    if (!deleted || deleted.length === 0) {
      // A política de acesso do banco recusou silenciosamente (0 linhas).
      throw new Error("Você não tem permissão para excluir este registro.");
    }
    return { ok: true, deleted: deleted.length };
  });

// ============= ACTIVATE =============
// Ativa um serviço: define starts_at, próximo faturamento e (para one_time) gera 1 entry imediatamente.

export const activateService = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techservice.services", "update")])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        startsAt: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    const result = await workRpc<{
      service: import("@/integrations/supabase/types").Database["public"]["Tables"]["services"]["Row"];
    }>(context.supabase, "service_bill_checked", {
      p_service: data.id,
      p_mode: "activate",
      p_starts: data.startsAt ?? null,
    });
    return result.service;
  });

// ============= BILLING TICK (manual) =============
// Executa o motor de billing para o workspace do usuário. Útil para testes.
// O tick automático roda via cron chamando /api/public/hooks/services-billing-tick.

export const runServicesBillingNow = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techservice.billing", "manage")])
  .handler(async ({ context }) => {
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    const { data, error } = await context.supabase
      .from("services")
      .select("id")
      .eq("status", "active")
      .eq("type", "recurring")
      .lte("next_billing_at", new Date().toISOString().slice(0, 10));
    if (error) throw error;
    let generated = 0,
      skippedOwned = 0;
    for (const service of data ?? []) {
      const result = await workRpc<{ generated: boolean; skippedOwned: boolean }>(
        context.supabase,
        "service_bill_checked",
        { p_service: service.id, p_mode: "tick" },
      );
      if (result.generated) generated++;
      if (result.skippedOwned) skippedOwned++;
    }
    return { ok: true, generated, skippedOwned };
  });

// ============= CATÁLOGO → CONTRATO =============
// Dentro de um contrato não se cria serviço livre: associa-se um serviço já
// existente no catálogo (public.service_catalog), definindo apenas os
// parâmetros comerciais daquela associação.

export const listCatalogServiceOptions = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techservice.services", "view")])
  .inputValidator((input) => z.object({ search: z.string().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techservice.services.view.workspace",
      "techservice.services.view.own",
      "techservice.services.view.team",
    ]);
    let q = supabase
      .from("service_catalog")
      .select("id, name, code, service_type, unit, base_price, currency, description")
      .eq("active", true)
      .order("name", { ascending: true })
      .limit(200);
    if (data.search && data.search.trim()) {
      q = q.ilike("name", `%${data.search.trim()}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

const linkCatalogInput = z.object({
  contractId: z.string().uuid(),
  serviceCatalogId: z.string().uuid(),
  type: typeEnum.default("recurring"),
  cadence: cadenceEnum.nullable().optional(),
  quantity: z.number().nonnegative().default(1),
  unitPrice: z.number().nonnegative().default(0),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  jobProfileId: z.string().uuid().nullable().optional(),
  seniority: z.string().nullable().optional(),
  competencies: z.array(z.string()).optional(),
});

export const linkCatalogServiceToContract = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techservice.services", "create")])
  .inputValidator((input) => linkCatalogInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, ["techservice.services.create.own"]);

    const { data: catalog, error: catErr } = await supabase
      .from("service_catalog")
      .select(
        "id, name, description, base_price, currency, active, unit, billing_model, default_percent, default_cadence",
      )
      .eq("id", data.serviceCatalogId)
      .maybeSingle();
    if (catErr) throw catErr;
    if (!catalog || catalog.active === false) {
      throw new Error("Serviço do catálogo não encontrado ou inativo");
    }

    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .select("id, role, currency")
      .eq("id", data.contractId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!contract) throw new Error("Contrato não encontrado");
    if (contract.role !== "provider") {
      throw new Error(
        "Serviços só podem ser associados a contratos de prestação de serviços (onde um dos nossos CNPJs é a CONTRATADA).",
      );
    }

    const cadence =
      data.type === "recurring"
        ? (data.cadence ?? "monthly")
        : data.type === "milestone"
          ? "on_delivery"
          : null;

    // valida o cargo (quando informado) e herda senioridade/competências dele
    let jobProfileId: string | null = null;
    let seniority: string | null = data.seniority ?? null;
    let competencies: string[] = data.competencies ?? [];
    if (data.jobProfileId) {
      const { data: jp, error: jpErr } = await supabase
        .from("job_profiles")
        .select("id, seniority, competencies, active")
        .eq("id", data.jobProfileId)
        .maybeSingle();
      if (jpErr) throw jpErr;
      if (!jp || jp.active === false) throw new Error("Cargo não encontrado ou inativo");
      jobProfileId = jp.id;
      if (!seniority) seniority = jp.seniority ?? null;
      if (competencies.length === 0) competencies = jp.competencies ?? [];
    }

    const { data: row, error } = await supabase
      .from("services")
      .insert({
        workspace_id: workspaceId,
        owner_id: userId,
        contract_id: data.contractId,
        role: contract.role,
        name: catalog.name,
        description: catalog.description ?? null,
        type: data.type,
        cadence,
        quantity: data.quantity,
        unit_price: data.unitPrice,
        currency: contract.currency || catalog.currency || "BRL",
        starts_at: data.startsAt ?? null,
        ends_at: data.endsAt ?? null,
        // A cobrança do serviço herda o modelo do catálogo e continua editável.
        unit: catalog.unit ?? null,
        billing_model: catalog.billing_model ?? null,
        percent: catalog.default_percent ?? null,
        status: "pending",
        job_profile_id: jobProfileId,
        seniority,
        competencies,
        metadata: { service_catalog_id: catalog.id },
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

// ============= DIVERGÊNCIAS COM O NEGÓCIO =============

/**
 * Compara os serviços do contrato com os itens de linha do negócio que os
 * originaram (quando o contrato foi criado por workflow a partir do negócio).
 * Só informa: não altera nada e não bloqueia o contrato.
 */
export const listServiceDealDivergences = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techservice.services", "view")])
  .inputValidator((input) => z.object({ contractId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techservice.services.view.workspace",
      "techservice.services.view.own",
      "techservice.services.view.team",
    ]);

    const { data: services, error } = await supabase
      .from("services")
      .select(
        "id, name, quantity, unit_price, unit, billing_model, percent, percent_base_amount, cadence, source_deal_line_item_id",
      )
      .eq("contract_id", data.contractId)
      .not("source_deal_line_item_id", "is", null);
    if (error) throw new Error(error.message);

    const rows = (services ?? []) as Array<Record<string, unknown>>;
    const ids = rows.map((s) => String(s.source_deal_line_item_id));
    if (ids.length === 0) return [] as Array<{ serviceId: string; fields: string[] }>;

    const { data: lineItems, error: liErr } = await supabase
      .from("deal_line_items")
      .select(
        "id, quantity, unit_price, unit, billing_model, percent, percent_base_amount, cadence",
      )
      .in("id", ids);
    if (liErr) throw new Error(liErr.message);
    const byId = new Map(
      ((lineItems ?? []) as Array<Record<string, unknown>>).map((li) => [String(li.id), li]),
    );

    const compare = [
      ["quantity", "quantidade"],
      ["unit_price", "valor"],
      ["unit", "unidade"],
      ["billing_model", "forma de cobrança"],
      ["percent", "percentual"],
      ["percent_base_amount", "base de cálculo"],
      ["cadence", "recorrência"],
    ] as const;

    const out: Array<{ serviceId: string; fields: string[] }> = [];
    for (const s of rows) {
      const li = byId.get(String(s.source_deal_line_item_id));
      if (!li) continue;
      const fields: string[] = [];
      for (const [key, label] of compare) {
        const a = s[key];
        const b = li[key];
        const norm = (v: unknown) =>
          v == null ? null : typeof v === "number" || !Number.isNaN(Number(v)) ? Number(v) : v;
        if (JSON.stringify(norm(a)) !== JSON.stringify(norm(b))) fields.push(label);
      }
      if (fields.length > 0) out.push({ serviceId: String(s.id), fields });
    }
    return out;
  });
