// Visibilidade por workspace/permissões: membros do MESMO workspace enxergam
// registros criados por outras pessoas, e registros de um workspace ao qual o
// usuário não pertence somem da leitura.
//
// Cobre Scorecards (ats_scorecards), Kits de entrevista (ats_interview_kits) e
// Dashboards (dashboards). Em `dashboards` a política de criação exige
// `owner_id = auth.uid()`, então lá validamos que a LEITURA não depende do
// criador (filtro apenas por workspace).
import { test, expect, hasE2ECredentials } from "./helpers/auth";
import type { SupabaseClient } from "@supabase/supabase-js";

test.skip(
  !hasE2ECredentials,
  "Defina E2E_USER_EMAIL/E2E_USER_PASSWORD para rodar testes autenticados.",
);

type Supa = SupabaseClient;

/** Outro membro do mesmo workspace (para semear registros de "outro criador"). */
async function otherMemberId(supa: Supa, workspaceId: string, selfId: string) {
  const { data, error } = await supa
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .neq("user_id", selfId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("workspace_members: " + error.message);
  return (data as { user_id?: string } | null)?.user_id ?? null;
}

async function insertRow(supa: Supa, table: string, payload: Record<string, unknown>) {
  const { data, error } = await supa.from(table).insert(payload).select("id").single();
  if (error) throw new Error(`${table} insert: ${error.message}`);
  return (data as { id: string }).id;
}

async function visible(supa: Supa, table: string, id: string) {
  const { data, error } = await supa.from(table).select("id").eq("id", id).maybeSingle();
  if (error) throw new Error(`${table} select: ${error.message}`);
  return Boolean((data as { id?: string } | null)?.id);
}

async function cleanup(supa: Supa, table: string, ids: string[]) {
  if (!ids.length) return;
  await supa.from(table).delete().in("id", ids);
}

test("Visibilidade — registros de outro criador do mesmo workspace aparecem", async ({
  supa,
  userId,
  workspaceId,
}) => {
  const tag = String(Date.now());
  const other = (await otherMemberId(supa, workspaceId, userId)) ?? userId;
  const created: Array<{ table: string; id: string }> = [];

  try {
    // Scorecards e Kits: owner_id de OUTRO membro (as políticas de inserção
    // exigem apenas workspace_id do workspace atual).
    const scorecardId = await insertRow(supa, "ats_scorecards", {
      workspace_id: workspaceId,
      owner_id: other,
      name: `PERM-SC-${tag}`,
      criteria: [],
    });
    created.push({ table: "ats_scorecards", id: scorecardId });

    const kitId = await insertRow(supa, "ats_interview_kits", {
      workspace_id: workspaceId,
      owner_id: other,
      name: `PERM-KIT-${tag}`,
      questions: [],
    });
    created.push({ table: "ats_interview_kits", id: kitId });

    // Dashboards: criação exige owner_id = usuário logado; a leitura precisa
    // ser por workspace, não por criador.
    const dashboardId = await insertRow(supa, "dashboards", {
      workspace_id: workspaceId,
      owner_id: userId,
      name: `PERM-DASH-${tag}`,
    });
    created.push({ table: "dashboards", id: dashboardId });

    expect(await visible(supa, "ats_scorecards", scorecardId)).toBe(true);
    expect(await visible(supa, "ats_interview_kits", kitId)).toBe(true);
    expect(await visible(supa, "dashboards", dashboardId)).toBe(true);

    // A leitura não pode estar presa ao criador: as linhas semeadas por outro
    // membro devem aparecer também na listagem filtrada só por workspace.
    const { data: list, error } = await supa
      .from("ats_scorecards")
      .select("id, owner_id")
      .eq("workspace_id", workspaceId)
      .neq("owner_id", userId)
      .limit(50);
    if (error) throw new Error("ats_scorecards list: " + error.message);
    if (other !== userId) {
      expect((list ?? []).some((r) => (r as { id: string }).id === scorecardId)).toBe(true);
    }
  } finally {
    for (const table of ["ats_scorecards", "ats_interview_kits", "dashboards"]) {
      await cleanup(
        supa,
        table,
        created.filter((c) => c.table === table).map((c) => c.id),
      );
    }
  }
});

test("Visibilidade — registros de workspace do qual o usuário saiu somem", async ({
  supa,
  userId,
}) => {
  const tag = String(Date.now());

  const { data: prof } = await supa
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  const originalActive =
    (prof as { active_workspace_id?: string | null } | null)?.active_workspace_id ?? null;

  const { data: ws, error: wsErr } = await supa
    .from("workspaces")
    .insert({ name: `PERM-WS-${tag}`, created_by: userId, status: "active" })
    .select("id")
    .single();
  if (wsErr) throw new Error("workspaces insert: " + wsErr.message);
  const tempWs = (ws as { id: string }).id;

  const { error: memberErr } = await supa
    .from("workspace_members")
    .insert({ workspace_id: tempWs, user_id: userId, role: "admin" });
  if (memberErr && !/duplicate|unique/i.test(memberErr.message)) {
    throw new Error("workspace_members insert: " + memberErr.message);
  }

  try {
    const scorecardId = await insertRow(supa, "ats_scorecards", {
      workspace_id: tempWs,
      owner_id: userId,
      name: `PERM-SC-OUT-${tag}`,
      criteria: [],
    });
    const kitId = await insertRow(supa, "ats_interview_kits", {
      workspace_id: tempWs,
      owner_id: userId,
      name: `PERM-KIT-OUT-${tag}`,
      questions: [],
    });
    const dashboardId = await insertRow(supa, "dashboards", {
      workspace_id: tempWs,
      owner_id: userId,
      name: `PERM-DASH-OUT-${tag}`,
    });

    // Enquanto é membro, enxerga.
    expect(await visible(supa, "ats_scorecards", scorecardId)).toBe(true);
    expect(await visible(supa, "ats_interview_kits", kitId)).toBe(true);
    expect(await visible(supa, "dashboards", dashboardId)).toBe(true);

    // Ao deixar de ser membro, as mesmas linhas desaparecem da leitura.
    if (originalActive) {
      await supa.from("profiles").update({ active_workspace_id: originalActive }).eq("id", userId);
    }
    const { error: delErr } = await supa
      .from("workspace_members")
      .delete()
      .eq("workspace_id", tempWs)
      .eq("user_id", userId);
    if (delErr) throw new Error("workspace_members delete: " + delErr.message);

    expect(await visible(supa, "ats_scorecards", scorecardId)).toBe(false);
    expect(await visible(supa, "ats_interview_kits", kitId)).toBe(false);
    expect(await visible(supa, "dashboards", dashboardId)).toBe(false);
  } finally {
    if (originalActive) {
      await supa.from("profiles").update({ active_workspace_id: originalActive }).eq("id", userId);
    }
    // Reentra no workspace temporário apenas para poder limpar os dados.
    await supa
      .from("workspace_members")
      .insert({ workspace_id: tempWs, user_id: userId, role: "admin" });
    await supa.from("ats_scorecards").delete().eq("workspace_id", tempWs);
    await supa.from("ats_interview_kits").delete().eq("workspace_id", tempWs);
    await supa.from("dashboards").delete().eq("workspace_id", tempWs);
    await supa.from("workspace_members").delete().eq("workspace_id", tempWs);
    await supa.from("workspaces").delete().eq("id", tempWs);
  }
});
