// Server functions de pipelines (CRM): garantia idempotente do pipeline padrão.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_PIPELINE_NAMES, defaultStagesFor } from "@/lib/pipelines-defaults";

const EntitySchema = z.object({ entity: z.enum(["deal", "lead", "ticket"]) });

/**
 * Garante um único pipeline padrão visível para o workspace/entidade.
 * Idempotente: reaproveita o padrão existente, promove o primeiro visível
 * quando nenhum está marcado como padrão e só cria quando não há nenhum.
 * Retorna null quando o usuário não pode ver nem criar pipelines.
 */
export const ensureDefaultPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => EntitySchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { entity } = data;

    // Visibilidade decidida pelas políticas do banco (workspace/RBAC).
    const { data: rows, error } = await supabase
      .from("pipelines")
      .select("id, name, is_default, created_at")
      .eq("entity", entity)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const existing = rows ?? [];
    const current = existing.find((p) => p.is_default);
    if (current) return { id: current.id as string, created: false };

    if (existing.length > 0) {
      const first = existing[0];
      const { data: promoted } = await supabase
        .from("pipelines")
        .update({ is_default: true } as never)
        .eq("id", first.id)
        .select("id")
        .maybeSingle();
      return {
        id: ((promoted as { id?: string } | null)?.id ?? first.id) as string,
        created: false,
      };
    }

    // Sem nenhum pipeline visível: cria o padrão no workspace ativo.
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_workspace_id")
      .eq("id", userId)
      .maybeSingle();
    const workspaceId =
      (profile as { active_workspace_id?: string | null } | null)?.active_workspace_id ?? null;
    if (!workspaceId) return null;

    const { data: created, error: insErr } = await supabase
      .from("pipelines")
      .insert({
        owner_id: userId,
        workspace_id: workspaceId,
        entity,
        name: DEFAULT_PIPELINE_NAMES[entity],
        is_default: true,
        stages: defaultStagesFor(entity) as never,
      } as never)
      .select("id")
      .maybeSingle();
    if (insErr) return null;
    return created ? { id: created.id as string, created: true } : null;
  });
