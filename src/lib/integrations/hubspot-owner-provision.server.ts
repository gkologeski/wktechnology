// Cria/vincula usuários inativos para responsáveis do HubSpot. Server-only.
import { decideProvision, normalizePersonKey } from "./hubspot-owner-match";

const BAN_FOREVER = "876000h";

export type ProvisionSummary = {
  linked: number;
  created: number;
  skipped: { name: string; reason: string }[];
  failed: { name: string; reason: string }[];
};

export async function provisionHubspotOwners(workspaceId: string): Promise<ProvisionSummary> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const summary: ProvisionSummary = { linked: 0, created: 0, skipped: [], failed: [] };

  const { data: owners, error } = await supabaseAdmin
    .from("hubspot_owners")
    .select("id, email, first_name, last_name")
    .eq("workspace_id", workspaceId)
    .is("mapped_user_id", null);
  if (error) throw new Error(error.message);
  if (!owners?.length) return summary;

  const { data: members } = await supabaseAdmin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId);
  const memberIds = (members ?? []).map((m) => m.user_id as string);
  const { data: profiles } = memberIds.length
    ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", memberIds)
    : { data: [] };

  const byName = new Map<string, string>();
  for (const p of profiles ?? []) {
    const k = normalizePersonKey(p.full_name as string | null);
    if (k && !byName.has(k)) byName.set(k, p.id as string);
  }
  const byEmail = new Map<string, string>();
  await Promise.all(
    memberIds.map(async (id) => {
      const r = await supabaseAdmin.auth.admin.getUserById(id).catch(() => null);
      const email = r?.data?.user?.email?.toLowerCase();
      if (email) byEmail.set(email, id);
    }),
  );

  for (const o of owners) {
    const label = `${o.first_name ?? ""} ${o.last_name ?? ""}`.trim() || o.email || o.id;
    const d = decideProvision(o, { byEmail, byName });
    try {
      let userId: string;
      if (d.kind === "skip") {
        summary.skipped.push({ name: label, reason: d.reason });
        continue;
      }
      if (d.kind === "link") {
        userId = d.userId;
      } else {
        const created = await supabaseAdmin.auth.admin.createUser({
          email: d.email,
          email_confirm: true,
          ban_duration: BAN_FOREVER,
          user_metadata: { full_name: d.fullName, source: "hubspot" },
        });
        if (created.error || !created.data.user) {
          summary.failed.push({ name: label, reason: created.error?.message ?? "erro ao criar" });
          continue;
        }
        userId = created.data.user.id;
        await supabaseAdmin
          .from("profiles")
          .upsert({ id: userId, full_name: d.fullName }, { onConflict: "id" });
        const { error: mErr } = await supabaseAdmin.from("workspace_members").insert({
          workspace_id: workspaceId,
          user_id: userId,
          role: "member",
          status: "inactive",
        });
        if (mErr) {
          summary.failed.push({ name: label, reason: mErr.message });
          continue;
        }
        byEmail.set(d.email, userId);
        byName.set(normalizePersonKey(d.fullName), userId);
      }
      const { error: uErr } = await supabaseAdmin
        .from("hubspot_owners")
        .update({ mapped_user_id: userId })
        .eq("id", o.id)
        .eq("workspace_id", workspaceId);
      if (uErr) summary.failed.push({ name: label, reason: uErr.message });
      else if (d.kind === "link") summary.linked++;
      else summary.created++;
    } catch (e) {
      summary.failed.push({ name: label, reason: e instanceof Error ? e.message : "erro" });
    }
  }
  return summary;
}

export async function setMemberStatus(
  workspaceId: string,
  memberId: string,
  status: "active" | "inactive",
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("workspace_members")
    .update({ status })
    .eq("workspace_id", workspaceId)
    .eq("user_id", memberId);
  if (error) throw new Error(error.message);
  // Só bloqueia o login se a pessoa não estiver ativa em nenhum outro workspace.
  let ban = status === "active" ? "none" : BAN_FOREVER;
  if (status === "inactive") {
    const { count } = await supabaseAdmin
      .from("workspace_members")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", memberId)
      .eq("status", "active");
    if ((count ?? 0) > 0) ban = "none";
  }
  const { error: bErr } = await supabaseAdmin.auth.admin.updateUserById(memberId, {
    ban_duration: ban,
  });
  if (bErr) throw new Error(bErr.message);
}

export async function assertWorkspaceAdmin(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown }> },
  userId: string,
): Promise<string> {
  const { data: ws } = await supabase.rpc("default_workspace_for_user", { _user: userId });
  const workspaceId = ws as string | null;
  if (!workspaceId) throw new Error("Usuário sem workspace ativo");
  const { data: ok } = await supabase.rpc("is_workspace_admin_v2", {
    _workspace: workspaceId,
    _user: userId,
  });
  if (!ok) throw new Error("Somente administradores podem gerenciar usuários.");
  return workspaceId;
}

