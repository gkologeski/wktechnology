// Helper server-only para resolver o workspace ATIVO do usuário logado.
// Toda server function que filtra dados por `owner_id` (= workspace_id)
// deve usar este resolver para garantir isolamento entre workspaces.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Retorna o id do workspace ativo do usuário. Regras:
 *  1. Se `profiles.active_workspace_id` está setado:
 *     - Platform admins podem usar qualquer workspace (mesmo sem serem membros).
 *     - Usuários comuns precisam ser membros do workspace para usá-lo.
 *  2. Sem seleção persistida, exige a escolha explícita no seletor de workspace.
 *  3. Se não houver nenhum, lança erro.
 */
export async function resolveActiveWorkspace(userId: string): Promise<string> {
  if (!userId) throw new Error("resolveActiveWorkspace: userId é obrigatório");

  const { data: pa, error: adminError } = await supabaseAdmin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (adminError) throw new Error(adminError.message);
  const isAdmin = !!pa;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  const activeId =
    (profile as { active_workspace_id?: string | null } | null)?.active_workspace_id ?? null;

  if (activeId) {
    if (isAdmin) return activeId;
    const { data: m, error: memberError } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", activeId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (memberError) throw new Error(memberError.message);
    if (m) return activeId;
    throw new Error("Acesso ao workspace ativo indisponível.");
  }

  throw new Error("Selecione um workspace ativo para continuar.");
}
