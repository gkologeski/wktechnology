import type { SupabaseClient } from "@supabase/supabase-js";

const FORM_EDIT_KEYS = ["create", "update"].flatMap((a) =>
  ["own", "team", "workspace"].map((s) => `techsales.marketing.forms.${a}.${s}`),
);

/**
 * Alterar a distribuição de um formulário: membro ativo do workspace do formulário
 * e ao menos uma chave efetiva de criar/editar formulários (deny prevalece em
 * `user_has_permission`). Formulário de outro workspace é recusado.
 */
export async function authorizeFormAssignment(
  client: SupabaseClient,
  userId: string,
  activeWorkspaceId: string,
  formWorkspaceId: string | null,
) {
  if (formWorkspaceId && formWorkspaceId !== activeWorkspaceId)
    throw new Error("Formulário de outro workspace.");
  const member = await client.rpc("is_workspace_member", {
    _workspace: activeWorkspaceId,
    _user: userId,
  });
  if (member.error || member.data !== true) throw new Error("Membro ativo obrigatório.");
  for (const key of FORM_EDIT_KEYS) {
    const { data, error } = await client.rpc("user_has_permission", {
      _user_id: userId,
      _workspace_id: activeWorkspaceId,
      _permission_key: key,
    });
    if (!error && data === true) return;
  }
  throw new Error("Sem permissão para alterar a distribuição do formulário.");
}
