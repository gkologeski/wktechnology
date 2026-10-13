// Regra pura do bloco "Aguardar resposta": decide entre seguir pelo ramo
// "respondeu", pelo ramo "sem resposta" (prazo esgotado) ou pausar de novo.
// A verificação é feita a cada `POLL_MS` pelo ciclo do motor (cron).

export const WAIT_POLL_MS = 10 * 60_000;

export type WaitState = { cursor: number; started_at: string; deadline: string };

export type WaitDecision =
  | { kind: "replied"; state: WaitState }
  | { kind: "timeout"; state: WaitState }
  | { kind: "suspend"; state: WaitState; runAtIso: string };

export function timeoutMs(amount: number, unit: "hours" | "days"): number {
  return Math.max(1, amount) * (unit === "days" ? 86_400_000 : 3_600_000);
}

/** Estado vindo do evento de retomada só vale para o mesmo passo. */
export function resolveWaitState(
  prior: unknown,
  cursor: number,
  now: Date,
  durationMs: number,
): WaitState {
  const p = prior as Partial<WaitState> | null | undefined;
  if (p && p.cursor === cursor && p.started_at && p.deadline) return p as WaitState;
  return {
    cursor,
    started_at: now.toISOString(),
    deadline: new Date(now.getTime() + durationMs).toISOString(),
  };
}

export function decideWait(state: WaitState, replied: boolean, now: Date): WaitDecision {
  if (replied) return { kind: "replied", state };
  const deadline = new Date(state.deadline).getTime();
  if (now.getTime() >= deadline) return { kind: "timeout", state };
  const next = Math.min(now.getTime() + WAIT_POLL_MS, deadline);
  return { kind: "suspend", state, runAtIso: new Date(next).toISOString() };
}
