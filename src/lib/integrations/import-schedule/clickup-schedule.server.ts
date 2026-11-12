// Execução automática do importador ClickUp pelo agendador: cada etapa roda pela RPC
// `clickup_import_delegate` em nome do dono da agenda (a etapa reconfere a permissão dele).
// Listas nunca importadas antes ficam fora (marcadas "não importar") e aguardam revisão humana.
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertClickUpImport } from "@/lib/integrations/clickup/clickup-import.server";

export type ClickUpJobState = {
  phase: "collect" | "apply" | "assignees";
  runId: string;
  cursor?: unknown;
  waitUntil?: number;
  heldLists?: number;
};
export type ClickUpTickResult =
  | { status: "running"; state: ClickUpJobState }
  | { status: "preview_ready" | "import_done"; heldLists: number };

/** Cliente que só encaminha as etapas oficiais e lê o staging já filtrado por execução. */
export function delegatingClient(admin: SupabaseClient, actor: string): SupabaseClient {
  return {
    rpc: (fn: string, args: Record<string, unknown>) =>
      admin.rpc(
        "clickup_import_delegate" as never,
        { p_actor: actor, p_fn: fn, p_args: args } as never,
      ),
    from: (t: string) => admin.from(t as never),
  } as unknown as SupabaseClient;
}

/** Regra pura: lista sem vínculo anterior não entra automaticamente. */
export function groupsToHold(
  groups: { id: string; list_ext_id: string; action: string }[],
  linkedListIds: Set<string>,
) {
  return groups.filter((g) => g.action === "import" && !linkedListIds.has(g.list_ext_id));
}

export async function advanceClickUpSchedule(
  opts: {
    admin: SupabaseClient;
    workspaceId: string;
    actor: string;
    mode: "preview" | "auto_import";
  },
  state: ClickUpJobState | null,
  budgetMs = 20_000,
): Promise<ClickUpTickResult> {
  const s = await import("@/lib/integrations/clickup/clickup-import.server");
  const ctx = {
    client: delegatingClient(opts.admin, opts.actor),
    workspaceId: opts.workspaceId,
    userId: opts.actor,
  };
  // Reconfere no banco, como o próprio dono: chave de gestão, membro ativo, deny prevalece.
  await assertClickUpImport(ctx.client, opts.workspaceId, opts.actor, "manage");
  const until = Date.now() + budgetMs;
  let st: ClickUpJobState;
  if (!state) {
    const r = await s.startCollect(ctx);
    st = { phase: "collect", runId: r.runId, cursor: r.cursor };
  } else st = { ...state };
  if (st.waitUntil && Date.now() < st.waitUntil) return { status: "running", state: st };

  while (Date.now() < until) {
    if (st.phase === "collect") {
      const r = await s.collectStep(ctx, st.runId, st.cursor as never);
      st.cursor = r.cursor;
      if (r.waitSeconds) {
        st.waitUntil = Date.now() + r.waitSeconds * 1000;
        return { status: "running", state: st };
      }
      if (!r.done) continue;
      await s.finishCollect(ctx, st.runId, r.cursor);
      st.heldLists = await holdNewLists(ctx, opts, st.runId);
      st.cursor = undefined;
      if (opts.mode === "preview") return { status: "preview_ready", heldLists: st.heldLists };
      st.phase = "apply";
    } else if (st.phase === "apply") {
      const r = await s.runStep(ctx, "apply", st.runId);
      if (r["done"]) st.phase = "assignees";
    } else {
      const r = await s.runStep(ctx, "assignees", st.runId);
      if (Number(r["updated"] ?? 0) === 0)
        return { status: "import_done", heldLists: st.heldLists ?? 0 };
    }
  }
  return { status: "running", state: st };
}

async function holdNewLists(
  ctx: { client: SupabaseClient; workspaceId: string; userId: string },
  opts: { admin: SupabaseClient; workspaceId: string },
  runId: string,
) {
  const { data: groups } = await opts.admin
    .from("clickup_import_groups" as never)
    .select("id, list_ext_id, action, erp_list_name")
    .eq("run_id", runId);
  const { data: links } = await opts.admin
    .from("clickup_import_links" as never)
    .select("external_id")
    .eq("workspace_id", opts.workspaceId)
    .eq("entity_type", "list");
  const linked = new Set(((links ?? []) as { external_id: string }[]).map((l) => l.external_id));
  const hold = groupsToHold((groups ?? []) as never, linked);
  const { setGroup } = await import("@/lib/integrations/clickup/clickup-import.server");
  for (const g of hold)
    await setGroup(ctx, {
      groupId: g.id,
      action: "skip",
      spaceId: null,
      newSpace: null,
      projectId: null,
      newProject: null,
      listName: null,
    });
  return hold.length;
}
