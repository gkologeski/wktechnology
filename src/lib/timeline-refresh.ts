// Sinal explícito para a timeline de atividades recarregar imediatamente.
//
// A timeline já escuta realtime em `activities` / `activity_survey_responses`,
// mas fluxos cuja gravação acontece no servidor (ex.: qualificação de lead,
// pesquisas) disparam este evento como garantia caso o WebSocket esteja
// indisponível (aba sem realtime, rede bloqueada).
export function notifyTimelineRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("timeline:refresh"));
}
