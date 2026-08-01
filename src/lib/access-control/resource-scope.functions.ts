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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveWorkspace(supabase: any, userId: string): Promise<string | null> {
  const m = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (m.data?.workspace_id) return m.data.workspace_id as string;
  const w = await supabase
    .from("workspaces")
    .select("id")
    .eq("created_by", userId)
    .limit(1)
    .maybeSingle();
  return (w.data?.id as string) ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function teamPeerIds(supabase: any, userId: string): Promise<string[]> {
  const { data: myGroups } = await supabase
    .from("user_group_members")
    .select("group_id")
    .eq("user_id", userId);
  const groupIds = ((myGroups ?? []) as Array<{ group_id: string }>).map((g) => g.group_id);
  const ids = new Set<string>([userId]);
  if (groupIds.length === 0) return Array.from(ids);
  const { data: peers } = await supabase
    .from("user_group_members")
    .select("user_id")
    .in("group_id", groupIds);
  for (const p of (peers ?? []) as Array<{ user_id: string }>) ids.add(p.user_id);
  return Array.from(ids);
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
    if (!workspaceId) return { scope: "own", owner_ids: [userId], workspace_id: null };

    const base = `${data.resource}.${data.action}`;
    const check = async (key: string): Promise<boolean> => {
      const { data: ok, error } = await supabase.rpc("user_has_permission", {
        _user_id: userId,
        _workspace_id: workspaceId,
        _permission_key: key,
      });
      return !error && Boolean(ok);
    };

    const { data: isAdmin } = await supabase.rpc("is_workspace_admin_of", {
      _owner: workspaceId,
      _user: userId,
    });
    if (isAdmin || (await check(`${base}.workspace`))) {
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
