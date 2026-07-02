// TechERP Access Control — Fase 5: escopo de dados.
// Server functions para leitura do escopo efetivo do usuário e checagem de dono.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DataScope = "own" | "team" | "workspace" | "custom";

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

export const getMyDataScope = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ scope: DataScope; workspace_id: string | null }> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveWorkspace(supabase, userId);
    if (!workspaceId) return { scope: "own", workspace_id: null };
    const { data, error } = await supabase.rpc("user_data_scope", {
      _user_id: userId,
      _workspace_id: workspaceId,
    });
    if (error) return { scope: "own", workspace_id: workspaceId };
    return { scope: (data as DataScope) ?? "own", workspace_id: workspaceId };
  });

export const canViewOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ owner_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ allowed: boolean }> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveWorkspace(supabase, userId);
    if (!workspaceId) return { allowed: userId === data.owner_id };
    const { data: ok, error } = await supabase.rpc("user_can_view_owner", {
      _user_id: userId,
      _workspace_id: workspaceId,
      _owner_id: data.owner_id,
    });
    if (error) return { allowed: false };
    return { allowed: Boolean(ok) };
  });
