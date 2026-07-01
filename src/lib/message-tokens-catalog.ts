// Catálogo central de variáveis de personalização usadas em campos de mensagem
// (e-mail, WhatsApp, LinkedIn, sequências, workflows, macros, etc.).
// Mantém labels amigáveis e agrupamento para renderização como pills clicáveis.

export type MessageToken = {
  token: string;
  label: string;
  group?: string;
};

const CONTACT: MessageToken[] = [
  { token: "{{first_name}}", label: "Nome", group: "Contato" },
  { token: "{{last_name}}", label: "Sobrenome", group: "Contato" },
  { token: "{{full_name}}", label: "Nome completo", group: "Contato" },
  { token: "{{email}}", label: "E-mail", group: "Contato" },
  { token: "{{company}}", label: "Empresa", group: "Contato" },
];

const AGENT: MessageToken[] = [
  { token: "{{agent.name}}", label: "Vendedor", group: "Remetente" },
  { token: "{{agent.email}}", label: "E-mail do vendedor", group: "Remetente" },
];

export const EMAIL_TOKENS: MessageToken[] = [...CONTACT, ...AGENT];

export const WHATSAPP_TOKENS: MessageToken[] = [
  { token: "{{first_name}}", label: "Nome", group: "Contato" },
  { token: "{{full_name}}", label: "Nome completo", group: "Contato" },
  { token: "{{company}}", label: "Empresa", group: "Contato" },
];

export const LINKEDIN_TOKENS: MessageToken[] = [
  { token: "{{first_name}}", label: "Nome", group: "Contato" },
  { token: "{{full_name}}", label: "Nome completo", group: "Contato" },
  { token: "{{company}}", label: "Empresa", group: "Contato" },
  { token: "{{headline}}", label: "Headline", group: "Contato" },
];

export const ATS_CANDIDATE_TOKENS: MessageToken[] = [
  { token: "{{candidate.first_name}}", label: "Nome", group: "Candidato" },
  { token: "{{candidate.full_name}}", label: "Nome completo", group: "Candidato" },
  { token: "{{candidate.email}}", label: "E-mail", group: "Candidato" },
  { token: "{{job.title}}", label: "Vaga", group: "Vaga" },
  { token: "{{job.department}}", label: "Departamento", group: "Vaga" },
  { token: "{{company.name}}", label: "Empresa", group: "Empresa" },
];

export const SEQUENCE_TOKENS: MessageToken[] = [...CONTACT, ...AGENT];

export const WORKFLOW_TOKENS: MessageToken[] = [
  { token: "{{first_name}}", label: "Nome", group: "Registro" },
  { token: "{{last_name}}", label: "Sobrenome", group: "Registro" },
  { token: "{{full_name}}", label: "Nome completo", group: "Registro" },
  { token: "{{email}}", label: "E-mail", group: "Registro" },
  { token: "{{company}}", label: "Empresa", group: "Registro" },
  { token: "{{title}}", label: "Título", group: "Registro" },
];

export const MACRO_TOKENS: MessageToken[] = [
  { token: "{{contact_first_name}}", label: "Nome do contato", group: "Contato" },
  { token: "{{contact_name}}", label: "Nome completo", group: "Contato" },
  { token: "{{company_name}}", label: "Empresa", group: "Contato" },
  { token: "{{ticket_subject}}", label: "Assunto do ticket", group: "Ticket" },
  { token: "{{agent_name}}", label: "Agente", group: "Remetente" },
];

