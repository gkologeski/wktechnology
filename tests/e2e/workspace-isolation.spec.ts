// Garante que, ao alternar o workspace ativo, NENHUMA query de tabela
// principal retorne registros de outro workspace. Cobre a base do refactor
// de isolamento (RLS via current_user_workspaces()) — se isso passar,
// qualquer server function que filtre por workspace_id ativo herda a garantia.
import { test, expect, hasE2ECredentials } from "./helpers/auth";

test.skip(
  !hasE2ECredentials,
  "Defina E2E_USER_EMAIL/E2E_USER_PASSWORD para rodar testes autenticados.",
);

// Tabelas com isolamento por workspace_id (RLS = current_user_workspaces()).
const ISOLATED_TABLES = [
  "contacts",
  "companies",
  "deals",
  "leads",
  "tickets",
] as const;

type Supa = Parameters<Parameters<typeof test>[1]>[0]["supa"];

async function createWorkspace(supa: Supa, userId: string, name: string) {
  const { data: ws, error } = await supa
    .from("workspaces")
    .insert({ name, created_by: userId, status: "active" })
    .select("id")
    .single();
  if (error) throw new Error(`workspaces insert: ${error.message}`);
  const wsId = (ws as { id: string }).id;

  const { error: mErr } = await supa
    .from("workspace_members")
    .insert({ workspace_id: wsId, user_id: userId, role: "admin" });
  if (mErr && !/duplicate|unique/i.test(mErr.message)) {
    throw new Error(`workspace_members insert: ${mErr.message}`);
  }
  return wsId;
}

async function setActive(supa: Supa, userId: string, wsId: string) {
  const { error } = await supa
    .from("profiles")
    .update({ active_workspace_id: wsId })
    .eq("id", userId);
  if (error) throw new Error(`set active: ${error.message}`);
}

async function seedAll(supa: Supa, userId: string, wsId: string, tag: string) {
  const ids: Record<string, string> = {};
  const ins = async (table: string, payload: Record<string, unknown>) => {
    const { data, error } = await supa
      .from(table)
      .insert({ owner_id: userId, workspace_id: wsId, ...payload })
      .select("id")
      .single();
    if (error) throw new Error(`${table} seed: ${error.message}`);
    ids[table] = (data as { id: string }).id;
  };
  await ins("contacts", { first_name: `ISO-${tag}`, email: `iso+${tag}@example.com` });
  await ins("companies", { name: `ISO-CO-${tag}` });
  await ins("deals", { name: `ISO-DEAL-${tag}`, value: 100, currency: "BRL", stage: "new" });
  await ins("leads", { first_name: `ISO-LEAD-${tag}`, status: "new" });
  await ins("tickets", { subject: `ISO-TKT-${tag}`, status: "open", priority: "medium" });
  return ids;
}

test("Workspace isolation — alternar workspace ativo não vaza dados de outro", async ({
  supa,
  userId,
}) => {
  const tag = String(Date.now());
  // Salva workspace ativo original para restaurar no final
  const { data: prof } = await supa
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  const originalActive = (prof as { active_workspace_id?: string | null } | null)
    ?.active_workspace_id ?? null;

  const wsA = await createWorkspace(supa, userId, `ISO-A-${tag}`);
  const wsB = await createWorkspace(supa, userId, `ISO-B-${tag}`);

  await setActive(supa, userId, wsA);
  const idsA = await seedAll(supa, userId, wsA, `A-${tag}`);
  await setActive(supa, userId, wsB);
  const idsB = await seedAll(supa, userId, wsB, `B-${tag}`);

  try {
    // --- Workspace A ativo: nada de B deve aparecer ---
    await setActive(supa, userId, wsA);
    for (const table of ISOLATED_TABLES) {
      const { data, error } = await supa
        .from(table)
        .select("id, workspace_id")
        .in("id", [idsA[table], idsB[table]]);
      expect(error, `${table} A query erro`).toBeNull();
      const rows = (data ?? []) as Array<{ id: string; workspace_id: string }>;
      const ids = rows.map((r) => r.id);
      expect(ids, `${table}: workspace A não deve ver row de B`).toContain(idsA[table]);
      expect(ids, `${table}: workspace A NÃO pode ver row de B`).not.toContain(idsB[table]);
      for (const r of rows) {
        expect(r.workspace_id, `${table}: vazou workspace ${r.workspace_id}`).toBe(wsA);
      }
    }

    // --- Workspace B ativo: nada de A deve aparecer ---
    await setActive(supa, userId, wsB);
    for (const table of ISOLATED_TABLES) {
      const { data, error } = await supa
        .from(table)
        .select("id, workspace_id")
        .in("id", [idsA[table], idsB[table]]);
      expect(error, `${table} B query erro`).toBeNull();
      const rows = (data ?? []) as Array<{ id: string; workspace_id: string }>;
      const ids = rows.map((r) => r.id);
      expect(ids, `${table}: workspace B não deve ver row de A`).not.toContain(idsA[table]);
      expect(ids, `${table}: workspace B deve ver sua própria row`).toContain(idsB[table]);
      for (const r of rows) {
        expect(r.workspace_id, `${table}: vazou workspace ${r.workspace_id}`).toBe(wsB);
      }
    }

    // --- current_user_workspaces() deve refletir o ativo ---
    await setActive(supa, userId, wsA);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpcA = await (supa as any).rpc("current_user_workspaces");
    expect(rpcA.error, "rpc A erro").toBeNull();
    const listA = ((rpcA.data ?? []) as Array<string | { current_user_workspaces: string }>)
      .map((r) => (typeof r === "string" ? r : r.current_user_workspaces));
    expect(listA, "ativo=A deve restringir ao A").toEqual([wsA]);

    await setActive(supa, userId, wsB);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpcB = await (supa as any).rpc("current_user_workspaces");
    const listB = ((rpcB.data ?? []) as Array<string | { current_user_workspaces: string }>)
      .map((r) => (typeof r === "string" ? r : r.current_user_workspaces));
    expect(listB, "ativo=B deve restringir ao B").toEqual([wsB]);
  } finally {
    // Cleanup — apaga seeds dos dois lados (RLS scoping pode esconder; itera por workspace)
    for (const [wsId, ids] of [[wsA, idsA], [wsB, idsB]] as const) {
      await setActive(supa, userId, wsId);
      for (const table of ISOLATED_TABLES) {
        if (ids[table]) await supa.from(table).delete().eq("id", ids[table]);
      }
    }
    // Remove memberships e workspaces
    for (const wsId of [wsA, wsB]) {
      await supa.from("workspace_members").delete().eq("workspace_id", wsId).eq("user_id", userId);
      await supa.from("workspaces").delete().eq("id", wsId);
    }
    // Restaura active_workspace_id original
    await supa
      .from("profiles")
      .update({ active_workspace_id: originalActive })
      .eq("id", userId);
  }
});
