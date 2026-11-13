// Situação da campanha de ligação em PT-BR (lista e ficha).
export const CALL_CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  running: "Em andamento",
  paused: "Pausada",
  done: "Concluída",
};
export function callCampaignStatusLabel(s: string): string {
  return CALL_CAMPAIGN_STATUS_LABEL[s] ?? s;
}

export type CallCampaignChecklist = { key: string; label: string; ok: boolean; hint: string }[];

/** Itens obrigatórios para Iniciar; pós-ligação é opcional. */
export function callCampaignChecklist(i: {
  hasAudience: boolean;
  variants: { script_id: string; weight: number }[];
  weighted: boolean;
  days: number[];
  start: string;
  end: string;
}): CallCampaignChecklist {
  const withScript = i.variants.filter((v) => v.script_id);
  const sum = withScript.reduce((s, v) => s + v.weight, 0);
  return [
    {
      key: "audience",
      label: "Público definido",
      ok: i.hasAudience,
      hint: "Escolha quem vai receber as ligações no passo 1.",
    },
    {
      key: "scripts",
      label: i.weighted ? "Roteiros com pesos somando 100%" : "Ao menos um roteiro",
      ok: withScript.length > 0 && (!i.weighted || sum === 100),
      hint:
        withScript.length === 0
          ? "Adicione um roteiro no passo 2."
          : `Os pesos somam ${sum}%; ajuste para 100%.`,
    },
    {
      key: "schedule",
      label: "Agenda de discagem válida",
      ok: i.days.length > 0 && i.start < i.end,
      hint: "Escolha ao menos um dia e um horário de início antes do fim no passo 3.",
    },
  ];
}

/** Edição só em rascunho ou pausada. */
export function canEditCallCampaign(status: string): boolean {
  return status === "draft" || status === "paused";
}
/** Exclusão bloqueada enquanto em andamento. */
export function canDeleteCallCampaign(status: string): boolean {
  return status !== "running";
}
/** Encerrar (cancelar) vale para rascunho, em andamento ou pausada. */
export function canCancelCallCampaign(status: string): boolean {
  return status === "draft" || status === "running" || status === "paused";
}

export type CallCampaignStats = {
  done: number;
  failed: number;
  pending: number;
  total: number;
  startedAt: string | null;
};
const FAILED = new Set(["failed", "no_answer", "busy"]);
const PENDING = new Set(["queued", "ringing", "in_progress"]);

export function summarizeCallAttempts(
  rows: { campaign_id: string; status: string; created_at: string }[],
): Map<string, CallCampaignStats> {
  const out = new Map<string, CallCampaignStats>();
  for (const r of rows) {
    const s = out.get(r.campaign_id) ?? {
      done: 0,
      failed: 0,
      pending: 0,
      total: 0,
      startedAt: null,
    };
    s.total++;
    if (r.status === "completed") s.done++;
    else if (FAILED.has(r.status)) s.failed++;
    else if (PENDING.has(r.status)) s.pending++;
    if (!s.startedAt || r.created_at < s.startedAt) s.startedAt = r.created_at;
    out.set(r.campaign_id, s);
  }
  return out;
}
