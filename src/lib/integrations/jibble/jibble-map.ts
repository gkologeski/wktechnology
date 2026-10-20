// Mapeamentos e rótulos do importador Jibble. Puro e client-safe.
// Pessoas: reaproveita a regra do Clockify (e-mail normalizado + membro do workspace;
// decisões manuais preservadas; duplicidades para revisão). Clientes/projetos: só sugestão
// por nome, nunca vínculo automático.
import {
  planUserMappings,
  type ExistingMapping,
  type UserMappingPlan,
  type WorkspaceMember,
} from "../clockify/clockify-map";

export type JbPerson = {
  id: string;
  email?: string | null;
  fullName?: string | null;
  preferredName?: string | null;
  status?: string | null;
  role?: string | null;
  timeZone?: string | null;
  code?: string | null;
};

export type JbAccess = "owner" | "admin" | "not_admin" | "unknown";

/** Papel da pessoa dona das credenciais. Sem papel legível = desconhecido (bloqueia). */
export function classifyJibbleRole(role: string | null | undefined): JbAccess {
  const r = (role ?? "").trim().toLowerCase();
  if (!r) return "unknown";
  if (r === "owner") return "owner";
  if (r === "admin" || r === "administrator") return "admin";
  return "not_admin";
}

export function canReadWholeOrg(access: JbAccess | null | undefined): boolean {
  return access === "owner" || access === "admin";
}

export const JB_ACCESS_LABEL: Record<JbAccess, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  not_admin: "Sem acesso de administrador",
  unknown: "Papel não confirmado",
};

/**
 * Pessoas do Jibble → plano de mapeamento. Mapeamento anterior com o mesmo id externo é
 * preservado (idempotência). Nunca cria login, convite ou privilégio.
 */
export function planPersonMappings(
  people: JbPerson[],
  members: WorkspaceMember[],
  existing: ExistingMapping[],
): UserMappingPlan[] {
  return planUserMappings(
    people.map((p) => ({
      id: p.id,
      email: p.email ?? null,
      name: p.fullName?.trim() || p.preferredName?.trim() || p.code || null,
      status: p.status ?? null,
    })),
    members,
    existing,
  );
}

export const JB_REASON_LABEL: Record<string, string> = {
  open_interval: "Sem saída registrada (aberto)",
  long_interval: "Intervalo muito longo (saída provavelmente esquecida)",
  zero_length: "Duração zero",
  no_project: "Sem projeto no Jibble",
  offset_changed: "Fuso mudou entre entrada e saída",
  orphan_out: "Saída sem entrada",
  orphan_break: "Pausa sem entrada",
  duplicate_break: "Pausa repetida",
  unknown_event: "Tipo de evento desconhecido",
  invalid_time: "Horário inválido",
  unmapped_person: "Pessoa sem vínculo no ERP",
  project_not_mapped: "Projeto sem vínculo no ERP",
  cross_source_duplicate: "Possível duplicidade com outra fonte",
  write_error: "Erro ao gravar",
  archived_event: "Evento arquivado no Jibble",
};

export const JB_ENTITY_LABEL: Record<string, string> = {
  organization: "Organização",
  person: "Pessoas",
  position: "Cargos",
  group: "Grupos",
  client: "Clientes",
  project: "Projetos",
  activity: "Atividades",
  location: "Locais",
  schedule: "Jornadas",
  pay_period_definition: "Configuração de aprovação",
  pay_period: "Períodos de aprovação",
  time_entry: "Eventos de ponto (entrada/saída)",
  hour_entry: "Lançamentos de horas",
  timesheet_day: "Timesheets por dia",
  time_off_policy: "Políticas de ausência",
  time_off: "Ausências",
  calendar: "Calendários de feriados",
  calendar_day: "Feriados",
  screenshot: "Capturas de tela (só inventário)",
  interval: "Intervalos reconstruídos",
};

/** Itens sem equivalente ou fora do alcance desta versão — sempre exibidos no relatório. */
export const JB_NOT_IMPORTED: Array<{ entity: string; reason: string }> = [
  {
    entity: "Selfies e reconhecimento facial",
    reason:
      "A API pública não documenta exportação de selfies/biometria; nada é baixado nem ativado.",
  },
  {
    entity: "Arquivos de capturas de tela",
    reason:
      "Só inventário (quantidade e data). Download exige armazenamento privado aprovado; o link assinado não é guardado.",
  },
  {
    entity: "Geolocalização e endereço do ponto",
    reason: "Preservados no staging privado; o TechProjects não tem campo equivalente.",
  },
  {
    entity: "Horas extras, regulares e aprovações",
    reason:
      "Preservadas no staging e usadas na conciliação; o TechProjects não tem folha/ponto e nada é ativado.",
  },
  {
    entity: "Jornadas, feriados e ausências",
    reason: "Preservados no staging; não ativam ponto, folha ou ausências no ERP.",
  },
  {
    entity: "Tarifas e valores faturáveis",
    reason: "Preservados no staging; não geram cobrança nem fatura.",
  },
];
