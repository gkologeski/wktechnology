// Server functions for Services (Sprint 3 MVP).
// CRUD, ativação com cálculo de próxima cobrança, e disparo manual do motor de billing.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";

const typeEnum = z.enum(["one_time", "recurring", "usage_based", "milestone"]);
const statusEnum = z.enum(["pending", "active", "paused", "cancelled", "completed"]);
const cadenceEnum = z.enum(["monthly", "quarterly", "yearly", "on_delivery"]);
const roleEnum = z.enum(["provider", "client"]);

function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  const target = new Date(d);
  target.setMonth(target.getMonth() + months);
  return target.toISOString().slice(0, 10);
}

function computeNextBilling(fromDate: string, cadence: z.infer<typeof cadenceEnum> | null | undefined): string | null {
  if (!cadence) return null;
  if (cadence === "monthly") return addMonths(fromDate, 1);
  if (cadence === "quarterly") return addMonths(fromDate, 3);
  if (cadence === "yearly") return addMonths(fromDate, 12);
  return null; // on_delivery — sem cadência automática
}

// ============= LIST =============

export const listServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
    return rows ?? [];
  });

export const getService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techservice.services.view.workspace",
      "techservice.services.view.own",
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
});

export const createService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techservice.services.create.own",
    ]);



    // herda role e currency do contrato
    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .select("id, role, currency")
      .eq("id", data.contractId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!contract) throw new Error("Contrato não encontrado");

    const cadence =
      data.type === "recurring" ? (data.cadence ?? "monthly") : data.type === "milestone" ? "on_delivery" : null;

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
    })
    .strict(),
});

export const updateService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => patchInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techservice.services.update.workspace",
      "techservice.services.update.own",
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techservice.services.delete.workspace",
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        startsAt: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techservice.services.update.workspace",
      "techservice.services.update.own",
    ]);

    const { data: svc, error: sErr } = await supabase
      .from("services")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!svc) throw new Error("Serviço não encontrado");

    const today = new Date().toISOString().slice(0, 10);
    const startsAt = data.startsAt ?? svc.starts_at ?? today;
    const amount = Number(svc.quantity) * Number(svc.unit_price);

    let nextBilling: string | null = null;
    let newStatus: "active" | "completed" = "active";

    if (svc.type === "one_time") {
      // gera 1 entry imediatamente e marca serviço como concluído
      newStatus = "completed";
      const { error: fErr } = await supabase.from("financial_entries").insert({
        workspace_id: workspaceId,
        owner_id: userId,
        direction: svc.role === "provider" ? "receivable" : "payable",
        origin_type: "service",
        origin_id: svc.id,
        service_id: svc.id,
        contract_id: svc.contract_id,
        description: svc.name,
        amount,
        currency: svc.currency,
        competence_date: startsAt,
        due_date: startsAt,
        status: "open",
      });
      if (fErr) throw fErr;
    } else if (svc.type === "recurring") {
      nextBilling = startsAt;
    }

    const { data: row, error } = await supabase
      .from("services")
      .update({
        status: newStatus,
        starts_at: startsAt,
        next_billing_at: nextBilling,
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

// ============= BILLING TICK (manual) =============
// Executa o motor de billing para o workspace do usuário. Útil para testes.
// O tick automático roda via cron chamando /api/public/hooks/services-billing-tick.

export const runServicesBillingNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techservice.services.update.workspace",
    ]);
    const today = new Date().toISOString().slice(0, 10);

    const { data: due, error: dErr } = await supabase
      .from("services")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .eq("type", "recurring")
      .not("next_billing_at", "is", null)
      .lte("next_billing_at", today);
    if (dErr) throw dErr;

    let generated = 0;
    for (const svc of due ?? []) {
      const amount = Number(svc.quantity) * Number(svc.unit_price);
      const next = computeNextBilling(svc.next_billing_at as string, svc.cadence as any);
      const stops = svc.ends_at && (next && next > (svc.ends_at as string));

      const { error: fErr } = await supabase.from("financial_entries").insert({
        workspace_id: workspaceId,
        owner_id: userId,
        direction: svc.role === "provider" ? "receivable" : "payable",
        origin_type: "service",
        origin_id: svc.id,
        service_id: svc.id,
        contract_id: svc.contract_id,
        counterparty_company_id: null,
        description: svc.name,
        amount,
        currency: svc.currency,
        competence_date: svc.next_billing_at as string,
        due_date: svc.next_billing_at as string,
        status: "open",
      });
      if (fErr) throw fErr;
      generated += 1;

      await supabase
        .from("services")
        .update({
          next_billing_at: stops ? null : next,
          status: stops ? "completed" : "active",
        })
        .eq("id", svc.id);
    }

    return { ok: true, generated };
  });

// ============= CATÁLOGO → CONTRATO =============
// Dentro de um contrato não se cria serviço livre: associa-se um serviço já
// existente no catálogo (public.service_catalog), definindo apenas os
// parâmetros comerciais daquela associação.

export const listCatalogServiceOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ search: z.string().optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techservice.services.view.workspace",
      "techservice.services.view.own",
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => linkCatalogInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techservice.services.create.own",
    ]);

    const { data: catalog, error: catErr } = await supabase
      .from("service_catalog")
      .select("id, name, description, base_price, currency, active")
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
