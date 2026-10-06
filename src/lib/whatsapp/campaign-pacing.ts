// Ritmo de disparo do template das campanhas: intervalo aleatório entre X e Y
// segundos entre um destinatário e o próximo. Puro e testável.

export type PacingInterval = { min: number; max: number };

export const PACING_MAX_SECONDS = 3600;
/** Tempo máximo que uma execução da rotina espera entre envios. */
export const PACING_RUN_BUDGET_MS = 45_000;

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
