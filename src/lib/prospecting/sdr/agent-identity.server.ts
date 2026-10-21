// Perfil da Lia (Agente SDR): usuário sem login (banido), membro ativo do
// workspace que espelha papel, cargos e pacotes de permissão de quem o criou.
// Só o servidor escreve; quem chama já foi validado como admin do workspace.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

const BAN_FOREVER = "876000h";
export const SDR_AGENT_NAME = "Lia (Agente SDR)";

/** ID do usuário da Lia no workspace, ou null quando o perfil não foi criado. */
export async function loadSdrAgentUserId(
  admin: Admin,
  workspaceId: string,
): Promise<string | null> {
  try {
    const { data, error } = await admin
      .from("sdr_agent_identities")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) {
      console.error("[sdr] perfil da Lia indisponível", error.message);
      return null;
    }
    return (data as { user_id?: string } | null)?.user_id ?? null;
  } catch (e) {
    console.error("[sdr] perfil da Lia indisponível", (e as Error).message);
    return null;
  }
}

export async function getSdrAgentIdentity(admin: Admin, workspaceId: string) {
  const { data, error } = await admin
    .from("sdr_agent_identities")
    .select("user_id, display_name, mirrored_from, created_at")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as {
    user_id: string;
    display_name: string;
    mirrored_from: string | null;
    created_at: string;
  } | null;
}

/** Cria (idempotente) o perfil da Lia espelhando `sourceUserId` no workspace. */
export async function provisionSdrAgentIdentity(
  admin: Admin,
  p: { workspaceId: string; sourceUserId: string },
) {
  const existing = await getSdrAgentIdentity(admin, p.workspaceId);
  if (existing) return { created: false, userId: existing.user_id };

  const { data: src, error: sErr } = await admin
    .from("workspace_members")
    .select("role, status")
    .eq("workspace_id", p.workspaceId)
    .eq("user_id", p.sourceUserId)
    .maybeSingle();
  if (sErr) throw new Error(sErr.message);
  if (!src || src.status !== "active")
    throw new Error("Seu acesso a este workspace não está ativo.");
  // Nunca dona do workspace: owner vira admin.
  const role = src.role === "owner" ? "admin" : src.role;

  const email = `lia-sdr+${p.workspaceId.slice(0, 8)}@agentes.wktechnology.invalid`;
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    ban_duration: BAN_FOREVER,
    user_metadata: { full_name: SDR_AGENT_NAME, source: "sdr_agent", workspace_id: p.workspaceId },
  });
  if (created.error || !created.data?.user) {
    throw new Error("Não foi possível criar o perfil da Lia: " + (created.error?.message ?? ""));
  }
  const uid = created.data.user.id as string;
  const fail = (e: { message: string } | null) => {
    if (e) throw new Error(e.message);
  };
  fail(
    (
      await admin
        .from("profiles")
        .upsert({ id: uid, full_name: SDR_AGENT_NAME }, { onConflict: "id" })
    ).error,
  );
  fail(
    (
      await admin.from("workspace_members").insert({
        workspace_id: p.workspaceId,
        user_id: uid,
        role,
        status: "active",
        invited_by: p.sourceUserId,
      })
    ).error,
  );
  const { data: jobRoles } = await admin
    .from("user_job_roles")
    .select("role_id, is_primary, owner_id")
    .eq("workspace_id", p.workspaceId)
    .eq("user_id", p.sourceUserId);
  if (jobRoles?.length)
    fail(
      (
        await admin.from("user_job_roles").insert(
          jobRoles.map((r: { role_id: string; is_primary: boolean; owner_id: string }) => ({
            ...r,
            user_id: uid,
            workspace_id: p.workspaceId,
          })),
        )
      ).error,
    );
  const { data: sets } = await admin
    .from("user_permission_sets")
    .select("set_id, owner_id")
    .eq("workspace_id", p.workspaceId)
    .eq("user_id", p.sourceUserId);
  if (sets?.length)
    fail(
      (
        await admin.from("user_permission_sets").insert(
          sets.map((s: { set_id: string; owner_id: string }) => ({
            ...s,
            user_id: uid,
            workspace_id: p.workspaceId,
          })),
        )
      ).error,
    );
  fail(
    (
      await admin.from("sdr_agent_identities").insert({
        workspace_id: p.workspaceId,
        user_id: uid,
        display_name: SDR_AGENT_NAME,
        mirrored_from: p.sourceUserId,
        created_by: p.sourceUserId,
      })
    ).error,
  );
  await admin.from("access_audit_log").insert({
    workspace_id: p.workspaceId,
    actor_id: p.sourceUserId,
    action: "sdr_agent_identity_created",
    entity_type: "sdr_agent",
    target_user_id: uid,
    details: { role, job_roles: jobRoles?.length ?? 0, permission_sets: sets?.length ?? 0 },
  });
  return { created: true, userId: uid };
}

export async function reassignSdrHistory(admin: Admin, workspaceId: string, apply: boolean) {
  const { data, error } = await admin.rpc("sdr_agent_reassign_history", {
    p_workspace: workspaceId,
    p_apply: apply,
  });
  if (error) throw new Error(error.message);
  return data as { run_id?: string; activities: number; sdr_actions: number };
}

export async function undoSdrHistory(admin: Admin, workspaceId: string, runId: string) {
  const { data, error } = await admin.rpc("sdr_agent_reassign_undo", {
    p_workspace: workspaceId,
    p_run: runId,
  });
  if (error) throw new Error(error.message);
  return data as { restored: number };
}
