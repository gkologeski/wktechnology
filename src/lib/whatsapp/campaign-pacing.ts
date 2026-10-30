// Ritmo de disparo do template das campanhas: intervalo aleatório entre X e Y
// segundos entre um destinatário e o próximo. Puro e testável.

export type PacingInterval = { min: number; max: number };

export const PACING_MAX_SECONDS = 3600;
/**
 * Tempo máximo que uma execução da rotina espera entre envios. Fica abaixo do
 * tempo limite da chamada agendada (poucos segundos): esperas longas eram
 * cortadas no meio, sem enviar e sem liberar o lease.
 */
export const PACING_RUN_BUDGET_MS = 4_000;

/**
 * Rodadas encadeadas (acordadas pela rodada anterior, não pela tarefa
 * agendada) podem esperar mais: a chamada encadeada tem tempo limite próprio
 * (`PACING_CHAIN_TIMEOUT_MS`), com folga para o último envio terminar.
 */
export const PACING_CHAIN_BUDGET_MS = 25_000;
export const PACING_CHAIN_TIMEOUT_MS = 45_000;
/**
 * Só encadeia quando o próximo envio vence dentro deste horizonte. Acima disso
 * a tarefa agendada (a cada 2 min) reabre a cadeia; fica acima de 120 s para
 * não haver lacuna entre as duas.
 */
export const PACING_CHAIN_HORIZON_MS = 150_000;
/** Teto de rodadas por cadeia; a tarefa agendada inicia uma nova cadeia. */
export const PACING_CHAIN_MAX_HOPS = 1_000;

/** Por que a rodada parou: `budget` = acabou o tempo; `empty` = nada a fazer agora. */
export type PacedStop = "budget" | "empty";

/**
 * Decide se a rodada que terminou deve acordar a próxima. Nunca encadeia
 * quando a rodada parou sem trabalho (fila vazia, pausa, horário fora,
 * cota, limite por minuto): nesses casos a tarefa agendada retoma.
 */
export function shouldChainNextRun(p: {
  stop: PacedStop;
  status: string | null | undefined;
  pending: number;
  nextAt: number;
  now: number;
  hop: number;
}): boolean {
  if (p.stop !== "budget") return false;
  if (p.status !== "running" || p.pending <= 0) return false;
  if (p.hop >= PACING_CHAIN_MAX_HOPS) return false;
  return p.nextAt - p.now <= PACING_CHAIN_HORIZON_MS;
}

/** Intervalo efetivo: o da campanha quando definido, senão o padrão do workspace. */
export function resolveInterval(
  campaign: { send_interval_min_s: number | null; send_interval_max_s: number | null },
  workspace: {
    template_interval_min_s?: number | null;
    template_interval_max_s?: number | null;
  } | null,
): PacingInterval {
  const useCampaign = campaign.send_interval_min_s != null && campaign.send_interval_max_s != null;
  const min = Number(
    useCampaign ? campaign.send_interval_min_s : (workspace?.template_interval_min_s ?? 0),
  );
  const max = Number(
    useCampaign ? campaign.send_interval_max_s : (workspace?.template_interval_max_s ?? 0),
  );
  const lo = Math.max(0, Math.min(PACING_MAX_SECONDS, Number.isFinite(min) ? min : 0));
  const hi = Math.max(lo, Math.min(PACING_MAX_SECONDS, Number.isFinite(max) ? max : 0));
  return { min: lo, max: hi };
}

export function pacingEnabled(i: PacingInterval): boolean {
  return i.max > 0;
}

/** Sorteia um intervalo inteiro em segundos, entre min e max (inclusive). */
export function randomIntervalSeconds(min: number, max: number, rng: () => number = Math.random) {
  const lo = Math.max(0, Math.floor(min));
  const hi = Math.max(lo, Math.floor(max));
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Valida o par X–Y vindo da tela. */
export function validateInterval(min: number, max: number): string | null {
  if (!Number.isInteger(min) || !Number.isInteger(max)) return "Use segundos inteiros.";
  if (min < 0 || max < 0) return "Os valores não podem ser negativos.";
  if (min > max) return "O mínimo não pode ser maior que o máximo.";
  if (max > PACING_MAX_SECONDS) return `O máximo é ${PACING_MAX_SECONDS} segundos.`;
  return null;
}

/** Previsão de término (ms) usando a média do intervalo e o limite por minuto. */
export function estimateRemainingMs(pending: number, i: PacingInterval, ratePerMinute: number) {
  if (pending <= 0) return 0;
  const byRate = 60_000 / Math.max(1, ratePerMinute);
  const byPacing = pacingEnabled(i) ? ((i.min + i.max) / 2) * 1000 : 0;
  return pending * Math.max(byRate, byPacing);
}

/** Colunas da campanha para o intervalo (ambos nulos = padrão do workspace). */
export function campaignIntervalColumns(
  min: number | null | undefined,
  max: number | null | undefined,
) {
  if (min === undefined && max === undefined) return {};
  if (min == null || max == null) return { send_interval_min_s: null, send_interval_max_s: null };
  const err = validateInterval(min, max);
  if (err) throw new Error(err);
  return { send_interval_min_s: min, send_interval_max_s: max };
}

/**
 * Laço do disparo espaçado, sem banco: só envia quando `nextAt` venceu, sorteia
 * o próximo intervalo após cada tentativa (envio ou falha) e para no orçamento.
 */
export async function runPacedLoop(p: {
  interval: PacingInterval;
  nextAt: number;
  startedAt: number;
  budgetMs?: number;
  now?: () => number;
  sleep: (ms: number) => Promise<void>;
  sendOne: () => Promise<{ processed: number; attempted?: number }>;
  persistNextAt: (ms: number) => Promise<void>;
  rng?: () => number;
}): Promise<{ processed: number; nextAt: number }> {
  const now = p.now ?? Date.now;
  const budget = p.budgetMs ?? PACING_RUN_BUDGET_MS;
  let nextAt = p.nextAt;
  let processed = 0;
  while (now() - p.startedAt < budget) {
    const wait = nextAt - now();
    if (wait > 0) {
      if (now() + wait - p.startedAt > budget) break;
      await p.sleep(wait);
    }
    const res = await p.sendOne();
    if (!res.processed) break;
    processed += res.processed;
    // Ignorados (fixo, envio recente, cliente…) não gastam intervalo: segue direto.
    if (res.attempted === 0) continue;
    nextAt = now() + randomIntervalSeconds(p.interval.min, p.interval.max, p.rng) * 1000;
    await p.persistNextAt(nextAt);
  }
  return { processed, nextAt };
}
