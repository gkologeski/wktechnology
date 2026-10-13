// Regras de ação sobre campanhas de WhatsApp (puras, usadas na tela e no servidor).

export function canEditCampaign(status: string): boolean {
  return status === "draft" || status === "paused";
}

/** Campanha em envio precisa ser pausada antes de excluir. */
export function canDeleteCampaign(status: string): boolean {
  return status !== "running";
}

export function duplicateName(name: string): string {
  return `Cópia de ${name}`.slice(0, 120);
}

type SourceCampaign = Record<string, unknown> & { name: string };

/** Colunas copiadas para a nova campanha: sempre rascunho, contadores zerados. */
export function duplicateCampaignRow(src: SourceCampaign, total: number) {
  return {
    name: duplicateName(src.name),
    body_template: src["body_template"] ?? null,
    template_name: src["template_name"] ?? null,
    template_language: src["template_language"] ?? null,
    content_variables_template: src["content_variables_template"] ?? {},
    media_url: src["media_url"] ?? null,
    media_content_type: src["media_content_type"] ?? null,
    rate_per_minute: src["rate_per_minute"] ?? 10,
    sdr_enabled: src["sdr_enabled"] ?? false,
    sdr_playbook_id: src["sdr_playbook_id"] ?? null,
    send_interval_min_s: src["send_interval_min_s"] ?? null,
    send_interval_max_s: src["send_interval_max_s"] ?? null,
    status: "draft" as const,
    total,
    sent: 0,
    failed: 0,
    started_at: null,
    finished_at: null,
    next_send_at: null,
  };
}
