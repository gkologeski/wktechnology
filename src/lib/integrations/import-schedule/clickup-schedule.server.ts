// Execução automática do importador ClickUp pelo agendador: cada etapa roda pela RPC
// `clickup_import_delegate` em nome do dono da agenda (a etapa reconfere a permissão dele).
// Todas as listas das origens explicitamente autorizadas são preservadas, inclusive novas e arquivadas.
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertClickUpImport } from "@/lib/integrations/clickup/clickup-import.server";

export type ClickUpJobState = {
  phase: "collect" | "apply" | "assignees";
  runId: string;
  cursor?: unknown;
  waitUntil?: number;
  heldLists?: number;
  coverageComplete?: boolean;
};
export type ClickUpTickResult =
  | { status: "running"; state: ClickUpJobState }
  | {
      status: "preview_ready" | "import_done" | "collection_incomplete";
      heldLists: number;
      error?: string;
    };

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

/** Compatibilidade: nenhuma lista autorizada é descartada por ainda não ter vínculo. */
export function groupsToHold(
  _groups: { id: string; list_ext_id: string; action: string }[],
  _linkedListIds: Set<string>,
): { id: string; list_ext_id: string; action: string }[] {
  return [];
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
      st.heldLists = 0;
      st.coverageComplete = r.coverageComplete;
      st.cursor = undefined;
      if (opts.mode === "preview")
        return {
          status: st.coverageComplete ? "preview_ready" : "collection_incomplete",
          heldLists: 0,
          ...(st.coverageComplete
            ? {}
            : { error: "Coleta incompleta: confira as lacunas registradas na execução." }),
        };
      st.phase = "apply";
    } else if (st.phase === "apply") {
      const r = await s.runStep(ctx, "apply", st.runId);
      if (r["done"]) st.phase = "assignees";
    } else {
      const r = await s.runStep(ctx, "assignees", st.runId);
      if (Number(r["updated"] ?? 0) === 0)
        return {
          status: st.coverageComplete ? "import_done" : "collection_incomplete",
          heldLists: 0,
          ...(st.coverageComplete
            ? {}
            : {
                error:
                  "Registros recebidos preservados; faltam capacidades ou arquivos da origem. Confira a execução.",
              }),
        };
    }
  }
  return { status: "running", state: st };
}
