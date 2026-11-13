// Público das Campanhas de Ligação no mesmo formato do quadro do WhatsApp.
// Ligações discam para Leads: base e filas ficam restritas a Leads.
export type CallAudienceState = {
  mode: "queue" | "filter" | "manual";
  queueId: string;
  base: "leads" | "contacts";
  groups: unknown[];
  groupsLogic: "and" | "or";
  recentOverrides: string[];
  excludeCustomers: boolean;
  excludeOpenDeals: boolean;
  commercialOverrides: string[];
};
export type CallAudienceConfig = { state: CallAudienceState; manualRaw: string };

/** Primeiro campo de cada linha da lista manual, só dígitos com "+". */
export function parseManualPhones(raw: string): string[] {
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const first = line.split(/[,;\t]/)[0] ?? "";
    const d = first.replace(/\D/g, "");
    if (d.length < 10) continue;
    out.push(`+${d.length <= 11 ? `55${d}` : d}`);
  }
  return [...new Set(out)];
}

export function hasCallAudience(cfg: CallAudienceConfig | null | undefined): boolean {
  if (!cfg) return false;
  const s = cfg.state;
  if (s.mode === "queue") return !!s.queueId;
  if (s.mode === "filter") return true;
  return parseManualPhones(cfg.manualRaw).length > 0;
}
