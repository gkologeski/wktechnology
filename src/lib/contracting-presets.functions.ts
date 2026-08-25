// Presets de contratação (contracting_presets).
// Um preset é um pacote pronto por tecnologia/perfil ("Dev React Sênior") que
// combina linha de serviço do catálogo + cargo + senioridade + stack + valores
// sugeridos. Serve para preencher rapidamente a associação de serviço no
// contrato, sem travar nada: todos os campos continuam editáveis depois.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";
import { SENIORITY_VALUES } from "@/lib/job-profiles.functions";

const VIEW = ["techsales.catalog.services.view.workspace", "techsales.catalog.services.view.own"];
const CREATE = [
  "techsales.catalog.services.create.own",
  "techsales.catalog.services.create.workspace",
];
const UPDATE = [
  "techsales.catalog.services.update.own",
  "techsales.catalog.services.update.workspace",
];
const DELETE = [
  "techsales.catalog.services.delete.own",
  "techsales.catalog.services.delete.workspace",
];

const seniorityEnum = z.enum(SENIORITY_VALUES);

const SELECT =
  "id, name, code, description, service_catalog_id, job_profile_id, seniority, competencies, unit, default_unit_price, default_unit_cost, currency, notes, active, created_at, updated_at";

const OPTION_SELECT =
  "id, name, code, service_catalog_id, job_profile_id, seniority, competencies, unit, default_unit_price, default_unit_cost, currency, service_catalog:service_catalog_id(id, name, unit, base_price, currency), job_profile:job_profile_id(id, name)";

export const listContractingPresets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        search: z.string().optional(),
        onlyActive: z.boolean().optional(),
        serviceCatalogId: z.string().uuid().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, VIEW);

    let q = supabase.from("contracting_presets").select(SELECT).order("name").limit(500);
    if (data.onlyActive) q = q.eq("active", true);
    if (data.serviceCatalogId) q = q.eq("service_catalog_id", data.serviceCatalogId);
    if (data.search && data.search.trim()) {
      const t = `%${data.search.trim()}%`;
      q = q.or(`name.ilike.${t},code.ilike.${t}`);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

const upsertShape = z.object({
  name: z.string().min(1),
  code: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  serviceCatalogId: z.string().uuid().nullable().optional(),
  jobProfileId: z.string().uuid().nullable().optional(),
  seniority: seniorityEnum.nullable().optional(),
  competencies: z.array(z.string()).optional(),
  unit: z.string().optional(),
  defaultUnitPrice: z.number().nonnegative().optional(),
  defaultUnitCost: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  notes: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export const createContractingPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => upsertShape.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, CREATE);

    const { data: row, error } = await supabase
      .from("contracting_presets")
      .insert({
        workspace_id: workspaceId,
        owner_id: userId,
        name: data.name.trim(),
        code: data.code?.trim() || null,
        description: data.description ?? null,
        service_catalog_id: data.serviceCatalogId ?? null,
        job_profile_id: data.jobProfileId ?? null,
        seniority: data.seniority ?? null,
        competencies: data.competencies ?? [],
        unit: data.unit || "mes",
        default_unit_price: data.defaultUnitPrice ?? 0,
        default_unit_cost: data.defaultUnitCost ?? 0,
        currency: (data.currency || "BRL").toUpperCase(),
        notes: data.notes ?? null,
        active: data.active ?? true,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    return row;
  });

export const updateContractingPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), patch: upsertShape.partial() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, UPDATE);

    const p = data.patch;
    const patch: Partial<{
      name: string;
      code: string | null;
      description: string | null;
      service_catalog_id: string | null;
      job_profile_id: string | null;
      seniority: string | null;
      competencies: string[];
      unit: string;
      default_unit_price: number;
      default_unit_cost: number;
      currency: string;
      notes: string | null;
      active: boolean;
    }> = {};
    if (p.name !== undefined) patch["name"] = p.name.trim();
    if (p.code !== undefined) patch["code"] = p.code?.trim() || null;
    if (p.description !== undefined) patch["description"] = p.description ?? null;
    if (p.serviceCatalogId !== undefined) patch["service_catalog_id"] = p.serviceCatalogId ?? null;
    if (p.jobProfileId !== undefined) patch["job_profile_id"] = p.jobProfileId ?? null;
    if (p.seniority !== undefined) patch["seniority"] = p.seniority ?? null;
    if (p.competencies !== undefined) patch["competencies"] = p.competencies ?? [];
    if (p.unit !== undefined) patch["unit"] = p.unit || "mes";
    if (p.defaultUnitPrice !== undefined) patch["default_unit_price"] = p.defaultUnitPrice;
    if (p.defaultUnitCost !== undefined) patch["default_unit_cost"] = p.defaultUnitCost;
    if (p.currency !== undefined) patch["currency"] = (p.currency || "BRL").toUpperCase();
    if (p.notes !== undefined) patch["notes"] = p.notes ?? null;
    if (p.active !== undefined) patch["active"] = p.active;

    const { data: rows, error } = await supabase
      .from("contracting_presets")
      .update(patch)
      .eq("id", data.id)
      .select(SELECT);
    if (error) throw error;
    if (!rows || rows.length === 0) {
      throw new Error("Você não tem permissão para alterar este preset.");
    }
    return rows[0];
  });

export const deleteContractingPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, DELETE);

    const { data: deleted, error } = await supabase
      .from("contracting_presets")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (error) throw error;
    if (!deleted || deleted.length === 0) {
      throw new Error("Você não tem permissão para excluir este preset.");
    }
    return { ok: true };
  });

export const duplicateContractingPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, VIEW);
    await assertAnyPermission(supabase, userId, workspaceId, CREATE);

    const { data: src, error } = await supabase
      .from("contracting_presets")
      .select(SELECT)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!src) throw new Error("Preset não encontrado.");

    const { data: row, error: iErr } = await supabase
      .from("contracting_presets")
      .insert({
        workspace_id: workspaceId,
        owner_id: userId,
        name: `${src.name} (cópia)`,
        code: src.code ? `${src.code}-copia` : null,
        description: src.description,
        service_catalog_id: src.service_catalog_id,
        job_profile_id: src.job_profile_id,
        seniority: src.seniority,
        competencies: src.competencies ?? [],
        unit: src.unit || "mes",
        default_unit_price: src.default_unit_price ?? 0,
        default_unit_cost: src.default_unit_cost ?? 0,
        currency: (src.currency || "BRL").toUpperCase(),
        notes: src.notes,
        active: true,
      })
      .select(SELECT)
      .single();
    if (iErr) throw iErr;
    return row;
  });

// Opções para o seletor de preset dentro do contrato (apenas presets ativos).
export const listContractingPresetOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ search: z.string().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, VIEW);

    let q = supabase
      .from("contracting_presets")
      .select(OPTION_SELECT)
      .eq("active", true)
      .order("name")
      .limit(300);
    if (data.search && data.search.trim()) {
      const t = `%${data.search.trim()}%`;
      q = q.or(`name.ilike.${t},code.ilike.${t}`);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

// Presets aplicáveis a uma linha de serviço do catálogo. Usado para
// pré-preencher itens de linha (negócios/propostas/cotações) e sugestões de
// alocação de pessoas.
export const listPresetsForService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ serviceCatalogId: z.string().uuid().nullable().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, VIEW);
    if (!data.serviceCatalogId) return [];

    const { data: rows, error } = await supabase
      .from("contracting_presets")
      .select(OPTION_SELECT)
      .eq("active", true)
      .eq("service_catalog_id", data.serviceCatalogId)
      .order("name")
      .limit(100);
    if (error) throw error;
    return rows ?? [];
  });
