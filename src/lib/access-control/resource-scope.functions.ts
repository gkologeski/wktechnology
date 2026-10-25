import { workRpc } from "./work-core.server";
// TechERP Access Control — escopo efetivo de leitura por recurso.
// Resolve, para o usuário autenticado, se ele enxerga todos os registros do
// workspace, apenas os da sua equipe (grupos de usuários) ou somente os seus,
// a partir das chaves granulares `<recurso>.<ação>.{own,team,workspace}`.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ResourceScope = "none" | "own" | "team" | "workspace";

export type ResourceScopeResult = {
  scope: ResourceScope;
  /** Lista de responsáveis visíveis. `null` = sem restrição (escopo workspace). */
  owner_ids: string[] | null;
  workspace_id: string | null;
};

async function resolveWorkspace(
  supabase: Parameters<typeof workRpc>[0],
  _userId: string,
): Promise<string | null> {
  const c = await workRpc<{ workspace?: string }>(supabase, "work_access_context", {});
  return c?.workspace ?? null;
}

async function teamPeerIds(
  supabase: Parameters<typeof workRpc>[0],
  userId: string,
): Promise<string[]> {
  const c = await workRpc<{ team?: Record<string, boolean> }>(supabase, "work_access_context", {});
  return [...new Set([userId, ...Object.keys(c?.team ?? {})])];
}

const INPUT = z.object({
  /** Prefixo do recurso, ex.: "techsales.activities". */
  resource: z.string().min(3).max(120),
  action: z.string().min(2).max(30).default("view"),
});

export const getResourceScope = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => INPUT.parse(i))
  .handler(async ({ data, context }): Promise<ResourceScopeResult> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveWorkspace(supabase, userId);
    if (!workspaceId) return { scope: "none", owner_ids: [], workspace_id: null };

    const base = `${data.resource}.${data.action}`;
    const check = async (key: string): Promise<boolean> => {
      const { data: ok, error } = await supabase.rpc("user_has_permission", {
        _user_id: userId,
        _workspace_id: workspaceId,
        _permission_key: key,
      });
      return !error && Boolean(ok);
    };

    if (await check(`${base}.workspace`)) {
      return { scope: "workspace", owner_ids: null, workspace_id: workspaceId };
    }
    if (await check(`${base}.team`)) {
      return {
        scope: "team",
        owner_ids: await teamPeerIds(supabase, userId),
        workspace_id: workspaceId,
      };
    }
    if (await check(`${base}.own`)) {
      return { scope: "own", owner_ids: [userId], workspace_id: workspaceId };
    }
    return { scope: "none", owner_ids: [], workspace_id: workspaceId };
  });
