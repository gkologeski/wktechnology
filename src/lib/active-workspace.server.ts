// Helper server-only para resolver o workspace ATIVO do usuário logado.
// Toda server function que filtra dados por `owner_id` (= workspace_id)
// deve usar este resolver para garantir isolamento entre workspaces.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Retorna o id do workspace ativo do usuário. Regras:
 *  1. Se `profiles.active_workspace_id` está setado:
 *     - Platform admins podem usar qualquer workspace (mesmo sem serem membros).
 *     - Usuários comuns precisam ser membros do workspace para usá-lo.
 *  2. Caso contrário, retorna o workspace mais antigo do qual é membro.
 *  3. Se não houver nenhum, lança erro.
 */
export async function resolveActiveWorkspace(userId: string): Promise<string> {
  if (!userId) throw new Error("resolveActiveWorkspace: userId é obrigatório");

  const { data: pa } = await supabaseAdmin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  const isAdmin = !!pa;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();

  const activeId =
    (profile as { active_workspace_id?: string | null } | null)?.active_workspace_id ?? null;

  if (activeId) {
    if (isAdmin) return activeId;
    const { data: m } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", activeId)
      .eq("user_id", userId)
      .maybeSingle();
    if (m) return activeId;
  }

  const { data: first, error } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const fallback = (first as { workspace_id?: string | null } | null)?.workspace_id ?? null;
  if (fallback) return fallback;

  throw new Error("Nenhum workspace ativo encontrado para o usuário.");
}
