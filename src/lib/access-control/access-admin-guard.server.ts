// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

// Guarda única de TODA mutação deste arquivo (várias gravam com supabaseAdmin,
// que não passa pelas políticas view_as_ro). Ordem:
// 1) sessão "Ver como" somente leitura é barrada (falha fechada se a checagem falhar);
// 2) workspace ativo pelo resolvedor canônico (perfil + membership ativa);
// 3) membership ATIVA com papel owner/admin nesse workspace — sem exceção de
//    platform_admin nem de criador inativo;
// 4) is_workspace_admin_v2 continua exigido como confirmação adicional.
export async function assertActiveWorkspaceAdmin(supabase: SB, userId: string): Promise<string> {
  const { error: roErr } = await supabase.rpc("is_read_only_view");
  if (roErr) throw new Error("Não foi possível confirmar o modo de acesso. Tente novamente.");
  const { assertNotReadOnlyView } = await import("@/lib/view-as-guard.server");
  await assertNotReadOnlyView(supabase);

  const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
  const workspaceId = await resolveActiveWorkspace(userId);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: member, error: mErr } = await supabaseAdmin
    .from("workspace_members")
    .select("role, status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (mErr) throw new Error(`Falha ao verificar administrador do workspace: ${mErr.message}`);
  const m = member as { role: string | null; status: string | null } | null;
  const activeAdmin = !!m && m.status === "active" && (m.role === "owner" || m.role === "admin");

  const { data, error } = await supabase.rpc("is_workspace_admin_v2", {
    _workspace: workspaceId,
    _user: userId,
  });
  if (error) throw new Error(`Falha ao verificar administrador do workspace: ${error.message}`);
  if (!data || !activeAdmin) {
    throw new Error("Apenas administradores do workspace ativo podem editar o controle de acesso.");
  }
  return workspaceId;
}

