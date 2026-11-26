import type { ImportProvider } from "@/lib/projects/imports/import-journey";

export type ImportQueryScope = readonly [string, string, string];

export const PROVIDER_LABEL: Record<ImportProvider, string> = {
  clockify: "Clockify",
  jibble: "Jibble",
  clickup: "ClickUp",
};

export const SOURCE_ROUTE = {
  clockify: "/projects/settings/imports/clockify",
  jibble: "/projects/settings/imports/jibble",
  clickup: "/projects/settings/imports/clickup",
} as const;

export const count = (value: number) => new Intl.NumberFormat("pt-BR").format(value);
export const timestamp = (value: string | null | undefined) => {
  if (!value) return "Não informada";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? value
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(parsed);
};

const entityLabels: Record<string, string> = {
  user: "Pessoa",
  person: "Pessoa",
  project: "Projeto",
  client: "Cliente",
  activity: "Atividade",
  time_entry: "Lançamento de horas",
  interval: "Intervalo de ponto",
  hour_entry: "Ajuste de horas",
  timesheet_day: "Total diário",
  task: "Tarefa",
  subtask: "Subtarefa",
  space: "Espaço",
  folder: "Pasta",
  list: "Lista",
  comment: "Comentário",
  attachment: "Anexo",
  document: "Documento",
  tag: "Etiqueta",
  group: "Grupo",
  workspace: "Organização",
  organization: "Organização",
  team: "Organização",
  task_detail: "Detalhe da tarefa",
};
const issueLabels: Record<string, string> = {
  missing_external_id: "Identificação incompleta",
  missing_id: "Identificação incompleta",
  invalid_interval: "Intervalo inválido",
  invalid_time: "Horário inválido",
  negative_duration: "Intervalo negativo",
  zero_duration: "Duração zero",
  open_interval: "Saída não informada",
  running: "Cronômetro aberto",
  unmapped_person: "Pessoa sem vínculo",
  unmatched_user: "Pessoa sem vínculo",
  missing_person: "Pessoa não informada",
  unmapped_project: "Projeto sem vínculo",
  no_project: "Projeto não informado",
  overlap: "Possível sobreposição",
  duplicate: "Possível duplicidade",
  manual_adjustment: "Ajuste a conferir",
  source_archived: "Registro arquivado",
  source_changed: "Origem alterada; conferir nova versão",
  reprocess_required: "Vínculo salvo; reprocessamento pendente",
  legacy_snapshot_only: "Registro de importação anterior",
  invalid_source_date: "Data inválida na origem",
  task_missing_title: "Tarefa sem título",
  invalid_source_assignees: "Responsáveis inválidos na origem",
};
export function importEntityLabel(entity: string) {
  return entityLabels[entity] ?? entity.replaceAll("_", " ");
}
export function importIssueLabel(issue: string) {
  return issueLabels[issue] ?? issue.replaceAll("_", " ");
}
