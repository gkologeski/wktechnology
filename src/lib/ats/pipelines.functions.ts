// CRUD de pipelines do ATS (editor visual).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_ATS_STAGES, type AtsStage } from "./stages";

const StageSchema = z.object({
  value: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9_]+$/, "use apenas letras minúsculas, números e _"),
  label: z.string().min(1).max(80),
  color: z.string().max(80).optional().nullable(),
  type: z.enum(["open", "won", "lost"]).default("open"),
});

const PipelineSaveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  is_default: z.boolean().default(false),
  stages: z.array(StageSchema).min(2).max(20),
});

export const listAtsPipelines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    // Visibilidade é decidida pelas políticas do banco (workspace/RBAC),
    // não por filtro manual de owner_id. A listagem não cria registros:
    // a criação do pipeline padrão é feita por ensureDefaultAtsPipeline.
    const { data, error } = await supabase
      .from("ats_pipelines")
      .select("id, name, is_default, stages, created_at, updated_at")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/**
 * Garante um único pipeline padrão visível para o workspace.
 * Idempotente: reaproveita o padrão existente, promove o primeiro visível
 * quando nenhum é padrão e só cria "Pipeline padrão" quando não há nenhum.
 * Retorna null quando o usuário não pode ver nem criar pipelines.
 */
export const ensureDefaultAtsPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("ats_pipelines")
      .select("id, name, is_default, stages, created_at, updated_at")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const existing = rows ?? [];
    const current = existing.find((p) => p.is_default);
    if (current) return current;

    if (existing.length > 0) {
      const first = existing[0];
      const { data: promoted } = await supabase
        .from("ats_pipelines")
        .update({ is_default: true } as never)
        .eq("id", first.id)
        .select("id, name, is_default, stages, created_at, updated_at")
        .maybeSingle();
      // sem permissão de update: devolve o primeiro visível como está
      return promoted ?? first;
    }

    const { data: created, error: insErr } = await supabase
      .from("ats_pipelines")
      .insert({
        owner_id: userId,
        name: "Pipeline padrão",
        is_default: true,
        stages: DEFAULT_ATS_STAGES as never,
      } as never)
      .select("id, name, is_default, stages, created_at, updated_at")
      .maybeSingle();
    if (insErr) return null;
    return created ?? null;
  });

export const savePipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PipelineSaveSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // valores únicos dentro do pipeline
    const values = new Set<string>();
    for (const s of data.stages) {
      if (values.has(s.value)) throw new Error(`Etapa duplicada: ${s.value}`);
      values.add(s.value);
    }

    const basePayload = {
      name: data.name,
      is_default: data.is_default,
      stages: data.stages as unknown as AtsStage[],
    };

    let row;
    if (data.id) {
      // não sobrescreve owner_id: preserva a autoria original ao editar
      const { data: u, error } = await supabase
        .from("ats_pipelines")
        .update(basePayload as never)
        .eq("id", data.id)
        .select("id, is_default")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!u) throw new Error("Você não tem permissão para editar este pipeline.");
      row = u;
    } else {
      const { data: ins, error } = await supabase
        .from("ats_pipelines")
        .insert({ ...basePayload, owner_id: userId } as never)
        .select("id, is_default")
        .single();
      if (error) throw new Error(error.message);
      row = ins;
    }

    // exclusividade do padrão por workspace é garantida por gatilho no banco
    return row;
  });

export const deletePipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;

    // não permitir apagar se há vagas usando
    const { count } = await supabase
      .from("ats_jobs")
      .select("id", { count: "exact", head: true })
      .eq("pipeline_id", data.id);
    if ((count ?? 0) > 0) {
      throw new Error(`Existem ${count} vaga(s) usando este pipeline. Migre-as antes de excluir.`);
    }

    const { data: row } = await supabase
      .from("ats_pipelines")
      .select("is_default")
      .eq("id", data.id)
      .maybeSingle();
    if ((row as { is_default?: boolean } | null)?.is_default) {
      throw new Error("Não é possível excluir o pipeline padrão.");
    }

    const { data: deleted, error } = await supabase
      .from("ats_pipelines")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!deleted || deleted.length === 0) {
      throw new Error("Você não tem permissão para excluir este pipeline.");
    }
    return { ok: true };
  });

export const setDefaultPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    // o gatilho do banco desmarca os outros padrões do mesmo workspace
    const { data: updated, error } = await supabase
      .from("ats_pipelines")
      .update({ is_default: true } as never)
      .eq("id", data.id)
      .select("id");

    if (error) throw new Error(error.message);
    if (!updated || updated.length === 0) {
      throw new Error("Você não tem permissão para alterar este pipeline.");
    }
    return { ok: true };
  });
