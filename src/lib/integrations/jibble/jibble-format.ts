// Rótulos e formatação do importador Jibble. Puro e client-safe.
import { DRY_PHASES, IMPORT_PHASES, ROLLBACK_PHASES } from "./jibble-specs";

export const JB_PHASE_LABEL: Record<string, string> = {
  start: "Preparando",
  organization: "Organização",
  collect: "Cadastros (pessoas, projetos, atividades…)",
  windows: "Eventos de ponto, horas e timesheets (mês a mês)",
  mappings: "Mapeamentos",
  intervals: "Reconstrução e conciliação por pessoa",
  projects_write: "Criando projetos",
  intervals_write: "Gravando horas por pessoa",
  rollback: "Desfazendo",
  report: "Relatório",
  done: "Concluído",
};

export const JB_RUN_KIND_LABEL: Record<string, string> = {
  dry_run: "Prévia (somente leitura)",
  import: "Importação",
  rollback: "Desfazer importação",
};

export const JB_CONN_LABEL: Record<string, string> = {
  not_configured: "Não configurado",
  configured: "Credenciais salvas, não testadas",
  connecting: "Testando…",
  connected: "Conectado",
  failed: "Falha na conexão",
  disabled: "Desativado",
};

export const JB_CAPABILITY_LABEL: Record<string, string> = {
  ok: "Lido",
  unavailable: "Indisponível no acesso/plano",
  rejected: "Consulta recusada pela API",
};

export const JB_STATUS_LABEL: Record<string, string> = {
  staged: "Em staging",
  ready: "Pronto",
  imported: "Importado",
  pending_review: "Revisão",
  unsupported: "Sem equivalente",
  rejected: "Recusado",
  skipped: "Ignorado",
};

export function jbPhaseProgress(kind: string, phase: string): number {
  const list: readonly string[] =
    kind === "dry_run" ? DRY_PHASES : kind === "import" ? IMPORT_PHASES : ROLLBACK_PHASES;
  const i = Math.max(0, list.indexOf(phase));
  return Math.round((i / Math.max(1, list.length - 1)) * 100);
}

export function hours(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(seconds ?? 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${h.toLocaleString("pt-BR")}h ${String(m).padStart(2, "0")}m ${String(r).padStart(2, "0")}s`;
}
