// Valida que as TELAS (que disparam server functions reais) só mostram dados
// do workspace ativo. Complementa workspace-isolation.spec.ts (que cobre RLS
// direto). Aqui exercitamos o caminho completo: serverFn → handler → DB → UI.
import { test, expect, hasE2ECredentials } from "./helpers/auth";
import type { SupabaseClient } from "@supabase/supabase-js";

test.skip(
  !hasE2ECredentials,
  "Defina E2E_USER_EMAIL/E2E_USER_PASSWORD para rodar testes autenticados.",
);

type Supa = SupabaseClient;

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
    throw new Error(`workspace_members: ${mErr.message}`);
  }
  return wsId;
}

async function setActive(supa: Supa, userId: string, wsId: string) {
  const { error } = await supa
    .from("profiles")
    .update({ active_workspace_id: wsId })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

// Cada cenário: rota a visitar + payload do seed + texto único exibido na lista.
type Scenario = {
  label: string;
  route: string;
  table: string;
  payload: (uniq: string) => Record<string, unknown>;
  visibleText: (uniq: string) => string;
};

const SCENARIOS: Scenario[] = [
  {
    label: "contacts",
    route: "/contacts",
    table: "contacts",
    payload: (u) => ({ first_name: `WSISO${u}`, email: `wsiso+${u}@example.com` }),
    visibleText: (u) => `wsiso+${u}@example.com`,
  },
  {
    label: "companies",
    route: "/companies",
    table: "companies",
    payload: (u) => ({ name: `WSISO-CO-${u}` }),
    visibleText: (u) => `WSISO-CO-${u}`,
  },
  {
    label: "deals",
    route: "/deals",
    table: "deals",
    payload: (u) => ({ name: `WSISO-DEAL-${u}`, value: 1, currency: "BRL", stage: "new" }),
    visibleText: (u) => `WSISO-DEAL-${u}`,
  },
  {
    label: "leads",
    route: "/leads",
    table: "leads",
    payload: (u) => ({ first_name: `WSISO-LEAD-${u}`, status: "new" }),
    visibleText: (u) => `WSISO-LEAD-${u}`,
  },
  {
    label: "tickets",
    route: "/tickets",
    table: "tickets",
    payload: (u) => ({ subject: `WSISO-TKT-${u}`, status: "open", priority: "medium" }),
    visibleText: (u) => `WSISO-TKT-${u}`,
  },
];

test("Server-side: rotas autenticadas só renderizam dados do workspace ativo", async ({
  authedPage: page,
  supa,
  userId,
}) => {
  const ts = String(Date.now());
  const uniqA = `A${ts}`;
  const uniqB = `B${ts}`;

  // Preserva ativo original
  const { data: prof } = await supa
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  const originalActive =
    (prof as { active_workspace_id?: string | null } | null)?.active_workspace_id ?? null;

  const wsA = await createWorkspace(supa, userId, `UIISO-A-${ts}`);
  const wsB = await createWorkspace(supa, userId, `UIISO-B-${ts}`);
  const seededIds: Array<{ table: string; id: string; ws: string }> = [];

  // Seed em cada workspace (precisa estar ativo p/ RLS aceitar o insert)
  for (const [wsId, uniq] of [[wsA, uniqA], [wsB, uniqB]] as const) {
    await setActive(supa, userId, wsId);
    for (const sc of SCENARIOS) {
      const { data, error } = await supa
        .from(sc.table)
        .insert({ owner_id: userId, workspace_id: wsId, ...sc.payload(uniq) })
        .select("id")
        .single();
      if (error) throw new Error(`${sc.table} seed: ${error.message}`);
      seededIds.push({ table: sc.table, id: (data as { id: string }).id, ws: wsId });
    }
  }

  try {
    // --- Workspace A ativo ---
    await setActive(supa, userId, wsA);
    for (const sc of SCENARIOS) {
      await page.goto(sc.route);
      await page.waitForLoadState("networkidle").catch(() => {});
      const search = page
        .locator(
          'input[placeholder*="Buscar" i], input[placeholder*="Pesquisar" i], input[type="search"]',
        )
        .first();
      if (await search.isVisible().catch(() => false)) {
        await search.fill(uniqA);
      }
      await expect(
        page.getByText(sc.visibleText(uniqA), { exact: false }).first(),
        `${sc.label}: workspace A deve exibir seu seed`,
      ).toBeVisible({ timeout: 15_000 });

      if (await search.isVisible().catch(() => false)) {
        await search.fill(uniqB);
        await page.waitForTimeout(500);
      }
      await expect(
        page.getByText(sc.visibleText(uniqB), { exact: false }),
        `${sc.label}: workspace A NÃO pode exibir seed de B`,
      ).toHaveCount(0);
    }

    // --- Workspace B ativo ---
    await setActive(supa, userId, wsB);
    for (const sc of SCENARIOS) {
      await page.goto(sc.route);
      await page.waitForLoadState("networkidle").catch(() => {});
      const search = page
        .locator(
          'input[placeholder*="Buscar" i], input[placeholder*="Pesquisar" i], input[type="search"]',
        )
        .first();
      if (await search.isVisible().catch(() => false)) {
        await search.fill(uniqB);
      }
      await expect(
        page.getByText(sc.visibleText(uniqB), { exact: false }).first(),
        `${sc.label}: workspace B deve exibir seu seed`,
      ).toBeVisible({ timeout: 15_000 });

      if (await search.isVisible().catch(() => false)) {
        await search.fill(uniqA);
        await page.waitForTimeout(500);
      }
      await expect(
        page.getByText(sc.visibleText(uniqA), { exact: false }),
        `${sc.label}: workspace B NÃO pode exibir seed de A`,
      ).toHaveCount(0);
    }
  } finally {
    for (const s of seededIds) {
      await setActive(supa, userId, s.ws);
      await supa.from(s.table).delete().eq("id", s.id);
    }
    for (const wsId of [wsA, wsB]) {
      await supa.from("workspace_members").delete().eq("workspace_id", wsId).eq("user_id", userId);
      await supa.from("workspaces").delete().eq("id", wsId);
    }
    await supa.from("profiles").update({ active_workspace_id: originalActive }).eq("id", userId);
  }
});
