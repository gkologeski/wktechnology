// Caminhos em paralelo com junção. O motor é sequencial: cada caminho roda até
// terminar ou pausar; pausas ficam no estado durável do run e o passo volta a
// ser executado na menor data de retomada, só para os caminhos pendentes.
// - join "all": segue quando todos terminam (erro em um não derruba os outros;
//   só falha se todos falharem).
// - join "any": segue no primeiro que terminar e cancela os demais.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkflowAction } from "../types";
import type { LogStep } from "../engine-shared.server";
import type { ResumeFrame, RunCtx } from "./run-context";
import type { ControlOpts, ControlOutcome } from "./actions-control.server";

type ParallelAction = Extract<WorkflowAction, { type: "parallel" }>;

export type BranchStatus = "pending" | "waiting" | "done" | "error" | "cancelled";
export type BranchState = {
  status: BranchStatus;
  cursor: number;
  path?: ResumeFrame[];
  runAt?: string;
};
export type ParallelState = { branches: BranchState[] };

export function initialParallelState(count: number): ParallelState {
  return { branches: Array.from({ length: count }, () => ({ status: "pending", cursor: 0 })) };
}

/** Decide o resultado da junção a partir do estado dos caminhos. */
export function decideJoin(
  join: "all" | "any",
  st: ParallelState,
): { kind: "continue" } | { kind: "fail" } | { kind: "wait"; runAtIso: string } {
  const b = st.branches;
  const done = b.filter((x) => x.status === "done").length;
  const waiting = b.filter((x) => x.status === "waiting");
  if (join === "any" && done > 0) return { kind: "continue" };
  if (waiting.length > 0) {
    const next = waiting.map((w) => w.runAt ?? new Date().toISOString()).sort()[0] as string;
    return { kind: "wait", runAtIso: next };
  }
  return done > 0 ? { kind: "continue" } : { kind: "fail" };
}

export async function runParallel(
  supabase: SupabaseClient,
  action: ParallelAction,
  ctx: RunCtx,
  { index, stepPath, annotate, runActions }: Omit<ControlOpts, "resume">,
): Promise<ControlOutcome> {
  const logs: LogStep[] = [];
  const key = `par:${stepPath}`;
  const store = (ctx.state = ctx.state ?? {});
  const prior = store[key] as ParallelState | undefined;
  const st: ParallelState =
    prior && prior.branches?.length === action.branches.length
      ? prior
      : initialParallelState(action.branches.length);
  const now = Date.now();

  for (let i = 0; i < action.branches.length; i++) {
    const b = st.branches[i]!;
    if (b.status === "done" || b.status === "error" || b.status === "cancelled") continue;
    if (b.status === "waiting" && b.runAt && new Date(b.runAt).getTime() > now) continue;
    ctx.resumeFrames = b.path ? [...b.path] : [];
    const res = await runActions(
      supabase,
      action.branches[i]!.actions ?? [],
      ctx,
      b.cursor,
      `${stepPath}.p${i + 1}`,
    );
    ctx.resumeFrames = [];
    logs.push(...res.log);
    if (res.hadError) st.branches[i] = { status: "error", cursor: b.cursor };
    else if (res.waitingApproval) {
      st.branches[i] = { status: "error", cursor: b.cursor };
      logs.push(
        annotate({
          at: new Date().toISOString(),
          ok: false,
          action: "parallel",
          error: "Aprovação humana não pode ficar dentro de caminhos em paralelo.",
        }),
      );
    } else if (res.suspendedAt) {
      st.branches[i] = {
        status: "waiting",
        cursor: res.suspendedAt.resumeCursor,
        path: res.suspendedAt.resumePath,
        runAt: res.suspendedAt.runAtIso,
      };
    } else st.branches[i] = { status: "done", cursor: (action.branches[i]!.actions ?? []).length };

    if (action.join === "any" && st.branches[i]!.status === "done") {
      st.branches.forEach((x, j) => {
        if (j !== i && (x.status === "pending" || x.status === "waiting")) x.status = "cancelled";
      });
      break;
    }
  }

  const decision = decideJoin(action.join, st);
  const summary = st.branches.map((x, i) => ({
    caminho: action.branches[i]?.label || `Caminho ${i + 1}`,
    status: x.status,
  }));
  if (decision.kind === "wait") {
    store[key] = st;
    logs.push(
      annotate({
        at: new Date().toISOString(),
        ok: true,
        action: "parallel",
        detail: {
          join: action.join,
          waiting: true,
          next_check: decision.runAtIso,
          caminhos: summary,
        },
      }),
    );
    return {
      logs,
      done: { hadError: false, suspendedAt: { runAtIso: decision.runAtIso, resumeCursor: index } },
    };
  }
  // Junção resolvida: limpa estado deste passo e das esperas dos caminhos.
  delete store[key];
  for (const k of Object.keys(store)) {
    const path = k.slice(k.indexOf(":") + 1);
    if (path.startsWith(`${stepPath}.p`)) delete store[k];
  }
  const ok = decision.kind === "continue";
  logs.push(
    annotate({
      at: new Date().toISOString(),
      ok,
      action: "parallel",
      ...(ok
        ? { detail: { join: action.join, caminhos: summary } }
        : { error: "Todos os caminhos em paralelo falharam.", detail: { caminhos: summary } }),
    }),
  );
  return ok ? { logs } : { logs, done: { hadError: true } };
}
