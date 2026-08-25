// Cadastro de Cargos/Perfis (job_profiles).
// Um cargo descreve "o que a pessoa faz" (Assistente Financeiro, Coordenador de RH,
// Desenvolvedor Full Stack…) e aponta para a linha de serviço do catálogo
// (Outsourcing, Fábrica de Software, BPO…). Assim o catálogo continua enxuto e
// a variação de cargo/senioridade/stack vive aqui e no serviço do contrato.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";

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

export const SENIORITY_VALUES = [
  "estagio",
  "junior",
  "pleno",
  "senior",
  "especialista",
  "coordenacao",
  "gerencia",
] as const;

const seniorityEnum = z.enum(SENIORITY_VALUES);

const SELECT =
  "id, name, code, description, service_catalog_id, seniority, default_unit_price, currency, competencies, tags, active, created_at, updated_at";

export const listJobProfiles = createServerFn({ method: "POST" })
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

    let q = supabase.from("job_profiles").select(SELECT).order("name").limit(500);
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
  seniority: seniorityEnum.nullable().optional(),
  defaultUnitPrice: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  competencies: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export const createJobProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => upsertShape.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, CREATE);

    const { data: row, error } = await supabase
      .from("job_profiles")
      .insert({
        workspace_id: workspaceId,
        owner_id: userId,
        created_by: userId,
        name: data.name.trim(),
        code: data.code?.trim() || null,
        description: data.description ?? null,
        service_catalog_id: data.serviceCatalogId ?? null,
        seniority: data.seniority ?? null,
        default_unit_price: data.defaultUnitPrice ?? 0,
        currency: (data.currency || "BRL").toUpperCase(),
        competencies: data.competencies ?? [],
        tags: data.tags ?? [],
        active: data.active ?? true,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    return row;
  });

export const updateJobProfile = createServerFn({ method: "POST" })
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
      seniority: string | null;
      default_unit_price: number;
      currency: string;
      competencies: string[];
      tags: string[];
      active: boolean;
    }> = {};
    if (p.name !== undefined) patch["name"] = p.name.trim();
    if (p.code !== undefined) patch["code"] = p.code?.trim() || null;
    if (p.description !== undefined) patch["description"] = p.description ?? null;
    if (p.serviceCatalogId !== undefined) patch["service_catalog_id"] = p.serviceCatalogId ?? null;
    if (p.seniority !== undefined) patch["seniority"] = p.seniority ?? null;
    if (p.defaultUnitPrice !== undefined) patch["default_unit_price"] = p.defaultUnitPrice;
    if (p.currency !== undefined) patch["currency"] = (p.currency || "BRL").toUpperCase();
    if (p.competencies !== undefined) patch["competencies"] = p.competencies ?? [];
    if (p.tags !== undefined) patch["tags"] = p.tags ?? [];
    if (p.active !== undefined) patch["active"] = p.active;

    const { data: rows, error } = await supabase
      .from("job_profiles")
      .update(patch)
      .eq("id", data.id)
      .select(SELECT);
    if (error) throw error;
    if (!rows || rows.length === 0) {
      throw new Error("Você não tem permissão para alterar este cargo.");
    }
    return rows[0];
  });

export const deleteJobProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, DELETE);

    const { data: deleted, error } = await supabase
      .from("job_profiles")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (error) throw error;
    if (!deleted || deleted.length === 0) {
      throw new Error("Você não tem permissão para excluir este cargo.");
    }
    return { ok: true };
  });

// Opções para o seletor de cargo dentro do contrato (inclui a linha de serviço).
export const listJobProfileOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ search: z.string().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, VIEW);

    let q = supabase
      .from("job_profiles")
      .select(
        "id, name, code, seniority, default_unit_price, currency, competencies, service_catalog_id, service_catalog:service_catalog_id(id, name, unit, base_price, currency)",
      )
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
