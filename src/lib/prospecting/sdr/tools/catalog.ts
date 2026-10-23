import { emailSchema } from "@/lib/email-schema";
import { windowsError } from "./scheduling";
// Catálogo de ferramentas e habilidades do Agente SDR (puro). Cada ferramenta
// tem schema tipado (JSON para a IA, zod para o servidor), efeito, requisitos
// de prontidão e exigência de confirmação. Habilidade = grupo de ferramentas.
import { z } from "zod";

export const SKILLS = {
  agenda: {
    name: "Agendamento direto",
    description: "Consulta a agenda do anfitrião e marca, remarca ou cancela reuniões na conversa.",
  },
  crm: {
    name: "CRM",
    description:
      "Identifica o cliente, lê o contexto autorizado e registra qualificação, tarefas, resumo e etiquetas.",
  },
  conhecimento: {
    name: "Conhecimento",
    description: "Responde com base no catálogo ativo e nas fontes aprovadas, com citação.",
  },
  materiais: {
    name: "Materiais",
    description: "Encontra e envia materiais aprovados quando o cliente pede.",
  },
  atendimento: {
    name: "Atendimento",
    description: "Passa a conversa para uma pessoa e registra descadastro.",
  },
  web: { name: "Web", description: "Busca e leitura de páginas externas." },
} as const;
export type SkillId = keyof typeof SKILLS;

export type Requirement =
  | "calendar"
  | "crm_link"
  | "questionnaire"
  | "materials"
  | "assignee"
  | "connector";

type Json = Record<string, unknown>;
const str = { type: "string" };
const nstr = { type: ["string", "null"] };
const obj = (properties: Record<string, Json>): Json => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const confirmProps = {
  confirmation_message_id: {
    ...str,
    description: "message_id da mensagem ATUAL do cliente em que ele confirmou explicitamente.",
  },
};

export type ToolDef = {
  id: string;
  skill: SkillId;
  name: string;
  description: string;
  effect: "read" | "write";
  confirmation: boolean;
  requires: Requirement[];
  /** Ferramenta catalogada mas sem execução disponível neste ambiente. */
  available: boolean;
  unavailableReason?: string;
  parameters: Json;
  input: z.ZodTypeAny;
};

const option = z.number().int().min(1).max(3);
const confirm = { confirmation_message_id: z.string().min(1) };

export const TOOL_DEFS: ToolDef[] = [
  {
    id: "calendar.availability",
    skill: "agenda",
    name: "Consultar horários",
    description:
      "Consulta a agenda REAL do anfitrião deste agente a partir de agora. Sem data: devolve até 3 opções livres em ordem cronológica, variando dias e turnos quando houver. Com date (YYYY-MM-DD com ano) e opcionalmente time (HH:MM): verifica exatamente esse pedido e, se ocupado, devolve alternativas. rejected_previous=true registra que o cliente recusou as opções vigentes e devolve outras, sem repetir as recusadas. Devolve apenas horários reais; status sem opções significa que não há alternativa no filtro pedido.",
    effect: "read",
    confirmation: false,
    requires: ["calendar"],
    available: true,
    parameters: obj({
      date: {
        ...nstr,
        description: "Data pedida pelo cliente, YYYY-MM-DD com ano. null se não pediu data.",
      },
      time: { ...nstr, description: "Hora pedida, HH:MM. null se não pediu hora." },
      timezone: {
        ...nstr,
        description: "Fuso IANA apenas se o cliente informou; null usa o do anfitrião.",
      },
      part_of_day: { type: ["string", "null"], enum: ["morning", "afternoon", null] },
      rejected_previous: { type: "boolean" },
    }),
    input: z.object({
      date: z.string().nullable(),
      time: z.string().nullable(),
      timezone: z.string().nullable(),
      part_of_day: z.enum(["morning", "afternoon"]).nullable(),
      rejected_previous: z.boolean(),
    }),
  },
  {
    id: "calendar.book",
    skill: "agenda",
    name: "Marcar reunião",
    description:
      "Marca a reunião numa das opções VIGENTES (número 1–3 da última consulta já apresentada ao cliente). Revalida a agenda antes. Exige o e-mail escrito pelo cliente e a mensagem atual de confirmação.",
    effect: "write",
    confirmation: true,
    requires: ["calendar"],
    available: true,
    parameters: obj({
      option: { type: "integer", minimum: 1, maximum: 3 },
      attendee_email: {
        ...nstr,
        description:
          "E-mail que o cliente escreveu na conversa para receber o convite; sem ele a reserva é recusada.",
      },
      ...confirmProps,
    }),
    input: z.object({ option, attendee_email: emailSchema().nullable(), ...confirm }),
  },
  {
    id: "calendar.reschedule",
    skill: "agenda",
    name: "Remarcar reunião",
    description:
      "Move a reunião desta conversa para uma opção vigente, após confirmação explícita do cliente.",
    effect: "write",
    confirmation: true,
    requires: ["calendar"],
    available: true,
    parameters: obj({ option: { type: "integer", minimum: 1, maximum: 3 }, ...confirmProps }),
    input: z.object({ option, ...confirm }),
  },
  {
    id: "calendar.cancel",
    skill: "agenda",
    name: "Cancelar reunião",
    description: "Cancela a reunião marcada NESTA conversa, após confirmação explícita do cliente.",
    effect: "write",
    confirmation: true,
    requires: ["calendar"],
    available: true,
    parameters: obj({ reason: nstr, ...confirmProps }),
    input: z.object({ reason: z.string().max(300).nullable(), ...confirm }),
  },
  {
    id: "calendar.lookup",
    skill: "agenda",
    name: "Ver reunião desta conversa",
    description: "Mostra a reunião marcada nesta conversa (somente desta conversa).",
    effect: "read",
    confirmation: false,
    requires: ["calendar"],
    available: true,
    parameters: obj({}),
    input: z.object({}),
  },
  {
    id: "crm.customer.lookup",
    skill: "crm",
    name: "Identificar cliente",
    description:
      "Procura o cliente por nome completo, e-mail ou telefone informados por ele. Devolve só se houve correspondência única e se ela é deste número; nunca dados de outras pessoas.",
    effect: "read",
    confirmation: false,
    requires: [],
    available: true,
    parameters: obj({ full_name: nstr, email: nstr, phone: nstr }),
    input: z.object({
      full_name: z.string().max(160).nullable(),
      email: z.string().max(200).nullable(),
      phone: z.string().max(40).nullable(),
    }),
  },
  {
    id: "crm.context.read",
    skill: "crm",
    name: "Ler contexto do cliente",
    description: "Lê empresa, negócio e últimas atividades vinculadas a ESTA conversa.",
    effect: "read",
    confirmation: false,
    requires: ["crm_link"],
    available: true,
    parameters: obj({}),
    input: z.object({}),
  },
  {
    id: "crm.qualification.update",
    skill: "crm",
    name: "Registrar qualificação",
    description:
      "Registra respostas do questionário oficial com trecho literal da mensagem. A nota é calculada pelo sistema.",
    effect: "write",
    confirmation: false,
    requires: ["questionnaire"],
    available: true,
    parameters: obj({
      answers: {
        type: "array",
        items: obj({ question_id: str, value: str, message_id: str, excerpt: str }),
      },
    }),
    input: z.object({
      answers: z
        .array(
          z.object({
            question_id: z.string(),
            value: z.string(),
            message_id: z.string(),
            excerpt: z.string(),
          }),
        )
        .max(20),
    }),
  },
  {
    id: "knowledge.search",
    skill: "conhecimento",
    name: "Pesquisar conhecimento",
    description:
      "Pesquisa no catálogo ativo, nas fontes do agente e na base de conhecimento publicada. Devolve trechos com a fonte; sem resultado, devolve no_results.",
    effect: "read",
    confirmation: false,
    requires: [],
    available: true,
    parameters: obj({ query: str }),
    input: z.object({ query: z.string().min(2).max(200) }),
  },
  {
    id: "catalog.services.lookup",
    skill: "conhecimento",
    name: "Consultar catálogo",
    description: "Lista ofertas ativas deste agente, com resumo e fatos aprovados.",
    effect: "read",
    confirmation: false,
    requires: [],
    available: true,
    parameters: obj({ query: nstr }),
    input: z.object({ query: z.string().max(200).nullable() }),
  },
  {
    id: "materials.find",
    skill: "materiais",
    name: "Encontrar material",
    description: "Lista materiais aprovados pertinentes. Não envia nada.",
    effect: "read",
    confirmation: false,
    requires: ["materials"],
    available: true,
    parameters: obj({ query: nstr }),
    input: z.object({ query: z.string().max(200).nullable() }),
  },
  {
    id: "materials.send",
    skill: "materiais",
    name: "Enviar material",
    description:
      "Anexa um material aprovado à resposta. Só quando o cliente pediu ou aceitou (informe a mensagem).",
    effect: "write",
    confirmation: true,
    requires: ["materials"],
    available: true,
    parameters: obj({ material_id: str, confirmation_message_id: str }),
    input: z.object({ material_id: z.string(), ...confirm }),
  },
  {
    id: "human.handoff",
    skill: "atendimento",
    name: "Passar para uma pessoa",
    description:
      "Solicita a transferência da conversa ao responsável, com motivo e contexto. A transferência é efetivada pelo sistema ao final do turno.",
    effect: "write",
    confirmation: false,
    requires: ["assignee"],
    available: true,
    parameters: obj({ reason: str }),
    input: z.object({ reason: z.string().min(3).max(300) }),
  },
  {
    id: "optout.register",
    skill: "atendimento",
    name: "Registrar descadastro",
    description: "Registra que o cliente não quer mais receber mensagens.",
    effect: "write",
    confirmation: true,
    requires: [],
    available: true,
    parameters: obj({ confirmation_message_id: str }),
    input: z.object(confirm),
  },
  {
    id: "tasks.create",
    skill: "crm",
    name: "Criar tarefa",
    description: "Cria tarefa para o responsável do agente, ligada ao cliente desta conversa.",
    effect: "write",
    confirmation: false,
    requires: ["assignee"],
    available: true,
    parameters: obj({ title: str, due_in_hours: { type: ["integer", "null"] }, note: nstr }),
    input: z.object({
      title: z.string().min(3).max(160),
      due_in_hours: z.number().int().min(1).max(720).nullable(),
      note: z.string().max(1000).nullable(),
    }),
  },
  {
    id: "conversation.summarize",
    skill: "crm",
    name: "Registrar resumo",
    description: "Grava um resumo objetivo da conversa como nota interna no cliente.",
    effect: "write",
    confirmation: false,
    requires: ["crm_link"],
    available: true,
    parameters: obj({ summary: str }),
    input: z.object({ summary: z.string().min(10).max(2000) }),
  },
  {
    id: "tags.update",
    skill: "crm",
    name: "Atualizar etiquetas",
    description: "Adiciona ou remove etiquetas da lista permitida deste agente no atendimento.",
    effect: "write",
    confirmation: false,
    requires: [],
    available: true,
    parameters: obj({ add: { type: "array", items: str }, remove: { type: "array", items: str } }),
    input: z.object({
      add: z.array(z.string().max(60)).max(10),
      remove: z.array(z.string().max(60)).max(10),
    }),
  },
  {
    id: "web.search",
    skill: "web",
    name: "Buscar na web",
    description: "Busca externa.",
    effect: "read",
    confirmation: false,
    requires: ["connector"],
    available: false,
    unavailableReason:
      "Nenhum conector de busca ligado ao projeto; execução não habilitada para clientes externos.",
    parameters: obj({ query: str }),
    input: z.object({ query: z.string() }),
  },
  {
    id: "web.fetch",
    skill: "web",
    name: "Ler página",
    description: "Leitura de página externa por lista permitida.",
    effect: "read",
    confirmation: false,
    requires: ["connector"],
    available: false,
    unavailableReason:
      "Nenhum conector de leitura ligado; sem lista de endereços permitidos configurada.",
    parameters: obj({ url: str }),
    input: z.object({ url: z.string() }),
  },
];

export const TOOL_IDS = TOOL_DEFS.map((t) => t.id);
export const toolDef = (id: string) => TOOL_DEFS.find((t) => t.id === id) ?? null;
/** Nome compatível com a API de funções (sem ponto). */
export const fnName = (id: string) => id.replace(/\./g, "__");
export const fromFnName = (n: string) => n.replace(/__/g, ".");

const HHMM = /^\d{2}:\d{2}$/;
export const ScheduleConfigSchema = z.object({
  host_user_id: z.string().uuid(),
  calendar_account_id: z.string().uuid(),
  duration_minutes: z.number().int().min(15).max(240).default(30),
  timezone: z.string().min(3).default("America/Sao_Paulo"),
  working_hours: z
    .record(
      z.enum(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]),
      z
        .array(z.object({ start: z.string().regex(HHMM), end: z.string().regex(HHMM) }))
        .max(2)
        .superRefine((ws, c) => {
          const e = windowsError(ws);
          if (e) c.addIssue({ code: "custom", message: e });
        }),
    )
    .default({}),
  buffer_before_minutes: z.number().int().min(0).max(120).default(0),
  buffer_after_minutes: z.number().int().min(0).max(120).default(0),
  min_notice_hours: z.number().int().min(0).max(168).default(2),
  horizon_days: z.number().int().min(1).max(90).default(21),
  holidays: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .max(60)
    .default([]),
  video: z.enum(["google_meet", "none"]).default("google_meet"),
  meeting_title: z.string().max(120).default("Reunião {empresa} <> WK Technology"),
  /**
   * Estratégia após o cliente recusar as opções: offer_new = nova consulta com
   * até 3 horários diferentes; ask_preference = registrar a recusa e devolver
   * sem opções para a conversa perguntar a preferência.
   */
  after_rejection: z.enum(["offer_new", "ask_preference"]).default("offer_new"),
});
export type ScheduleConfig = z.infer<typeof ScheduleConfigSchema>;

/**
 * Automações versionadas com a configuração do agente. Todas DESLIGADAS por
 * padrão: nenhuma ação automática não solicitada sem configuração explícita.
 */
export const AutomationsSchema = z.object({
  /** Passa para uma pessoa quando o cliente pergunta se fala com IA e silencia. */
  ai_question_silence_handoff: z
    .object({
      enabled: z.boolean().default(false),
      minutes: z.number().int().min(5).max(1440).default(30),
    })
    .default({}),
});
export type Automations = z.infer<typeof AutomationsSchema>;

export const ToolConfigSchema = z.object({
  enabled_tools: z.array(z.string()).default([]),
  scheduling: ScheduleConfigSchema.nullable().default(null),
  allowed_tags: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
  automations: AutomationsSchema.default({}),
});
export type ToolConfig = z.infer<typeof ToolConfigSchema>;

export function parseToolConfig(raw: unknown): ToolConfig | null {
  if (raw == null) return null;
  const r = ToolConfigSchema.safeParse(raw);
  if (!r.success) return null;
  return { ...r.data, enabled_tools: r.data.enabled_tools.filter((t) => TOOL_IDS.includes(t)) };
}

export type ReadinessFacts = {
  calendar: { ok: boolean; reason?: string };
  crmLinked: boolean;
  questionnaire: boolean;
  materials: boolean;
  assignee: boolean;
};
export type ToolReadiness = { ready: boolean; reason: string | null };

export function toolReadiness(def: ToolDef, f: ReadinessFacts): ToolReadiness {
  if (!def.available) return { ready: false, reason: def.unavailableReason ?? "Indisponível" };
  for (const r of def.requires) {
    if (r === "calendar" && !f.calendar.ok)
      return { ready: false, reason: f.calendar.reason ?? "Agenda do anfitrião não configurada" };
    if (r === "questionnaire" && !f.questionnaire)
      return { ready: false, reason: "Agente sem questionário de qualificação" };
    if (r === "materials" && !f.materials)
      return { ready: false, reason: "Nenhum material aprovado para este agente" };
    if (r === "assignee" && !f.assignee)
      return { ready: false, reason: "Agente sem responsável definido" };
  }
  // crm_link é verificado por conversa no momento da execução.
  return { ready: true, reason: null };
}

/** Ferramentas que a IA recebe: ligadas na versão, disponíveis e prontas. */
export function exposedTools(cfg: ToolConfig | null, f: ReadinessFacts): ToolDef[] {
  if (!cfg) return [];
  return TOOL_DEFS.filter((d) => cfg.enabled_tools.includes(d.id) && toolReadiness(d, f).ready);
}
