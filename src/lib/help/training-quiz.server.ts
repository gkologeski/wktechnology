// Questões dos quizzes de módulo com o gabarito. Somente servidor: o navegador
// recebe as questões sem a resposta e a nota é calculada no servidor.
import type { HelpModuleKey } from "./help-access";

export type QuizQuestion = { q: string; options: string[]; answer: number };

export const QUIZZES: Partial<Record<HelpModuleKey, QuizQuestion[]>> = {
  core: [
    {
      q: "O Core ERP é um módulo vertical?",
      options: ["Sim", "Não, reúne recursos compartilhados"],
      answer: 1,
    },
    {
      q: "Ser admin do workspace dá acesso à administração da plataforma?",
      options: ["Sim, automaticamente", "Não, a plataforma tem validação própria"],
      answer: 1,
    },
    {
      q: "A Ajuda e Treinamento fica disponível para clientes?",
      options: ["Sim", "Não, é material interno"],
      answer: 1,
    },
    {
      q: "Salvar uma configuração garante o resultado no provedor externo?",
      options: ["Sim", "Não, é preciso verificar conexão e execução"],
      answer: 1,
    },
    {
      q: "Configurações de NFS-e pertencem a qual área?",
      options: ["Core ERP", "TechFinance", "TechSales"],
      answer: 1,
    },
  ],
  crm: [
    {
      q: "Quando posso mandar WhatsApp com texto livre?",
      options: [
        "A qualquer momento",
        "Até 24 horas após a última mensagem do cliente",
        "Só em horário comercial",
      ],
      answer: 1,
    },
    {
      q: "Reservar público de uma sequência já envia mensagens?",
      options: ["Sim", "Não, o envio começa ao iniciar a inscrição"],
      answer: 1,
    },
    {
      q: 'O que significa um campo exibido como "•••"?',
      options: ["Campo vazio", "Campo mascarado para o seu cargo", "Erro de carregamento"],
      answer: 1,
    },
    {
      q: "Como gerar uma proposta a partir de uma cotação?",
      options: ["Redigitando os dados", 'Em Cotações, clicando em "Gerar proposta"'],
      answer: 1,
    },
    {
      q: "O agente de IA precisa de aprovação manual para cada mensagem?",
      options: [
        "Sim",
        "Não, cada mensagem é auditada e, se não houver conserto, vai para um humano",
      ],
      answer: 1,
    },
  ],
  ats: [
    { q: "A IA decide quem contratar?", options: ["Sim", "Não, ela só sugere"], answer: 1 },
    {
      q: "Como a pessoa contratada chega ao TechPeople?",
      options: ["Cadastro manual obrigatório", 'Pela ação "Contratar" na ficha do candidato'],
      answer: 1,
    },
    { q: "Anonimizar um candidato pode ser desfeito?", options: ["Sim", "Não"], answer: 1 },
    {
      q: "Indeed e Vagas.com já publicam vagas de verdade pelo multi-posting?",
      options: ["Sim", "Não, ainda usam retorno simulado"],
      answer: 1,
    },
    {
      q: "Antes de considerar a vaga publicada, o que fazer?",
      options: ["Nada", "Conferir o destino externo"],
      answer: 1,
    },
  ],
  people: [
    {
      q: "Onde cadastro benefícios, documentos e incidentes?",
      options: ["Nas telas de lista", "Na ficha da pessoa, na aba correspondente"],
      answer: 1,
    },
    {
      q: "Arquivar e excluir são a mesma coisa?",
      options: ["Sim", "Não, excluir apaga o cadastro"],
      answer: 1,
    },
    {
      q: "Reimportar o Google Forms duplica pessoas?",
      options: ["Sim", "Não, a chave é o CPF"],
      answer: 1,
    },
    {
      q: "O convite de acesso é enviado por e-mail automaticamente?",
      options: ["Sim", "Não, é gerado um link para você enviar"],
      answer: 1,
    },
    {
      q: 'Para ver liderados em "Meu time", o que é preciso?',
      options: ["Ser admin", 'Ser definido como "Gestor" na alocação de cada pessoa'],
      answer: 1,
    },
  ],
  contracts: [
    {
      q: "Concluir a cadeia de aprovação torna o contrato ativo?",
      options: ["Sim", "Não, leva a Aguardando assinatura"],
      answer: 1,
    },
    {
      q: "Preparar assinatura já envia o documento?",
      options: ["Sim", "Não, são etapas separadas"],
      answer: 1,
    },
    {
      q: "Selecionar DocuSign ou Clicksign conecta o provedor?",
      options: ["Sim", "Não, credenciais e integração são configuradas à parte"],
      answer: 1,
    },
    {
      q: "Medição ou provisão gera cobrança automaticamente?",
      options: ["Sim", "Não, preparação, aprovação e geração financeira são distintas"],
      answer: 1,
    },
    {
      q: "Serviços em execução pertencem a qual módulo?",
      options: ["Um módulo TechServices", "TechContracts"],
      answer: 1,
    },
  ],
  projects: [
    {
      q: "Apontamento marcado como faturável já foi cobrado?",
      options: ["Sim", "Não, faturável é só uma marca"],
      answer: 1,
    },
    { q: "Horas importadas travadas contam como aprovadas?", options: ["Sim", "Não"], answer: 1 },
    {
      q: "Sem jornada configurada no People, a meta de horas é:",
      options: ["Zero", "Desconhecida"],
      answer: 1,
    },
    {
      q: "Sem tarifa vigente, o custo da hora é:",
      options: ["Zero", "Falta de cobertura de custo"],
      answer: 1,
    },
    {
      q: "O assistente do Dashboard altera projetos?",
      options: ["Sim", "Não, só consulta indicadores autorizados"],
      answer: 1,
    },
  ],
  finance: [
    {
      q: "Criar um título emite nota ou boleto?",
      options: ["Sim", "Não, é cadastro interno"],
      answer: 1,
    },
    {
      q: "Dar baixa manual transfere dinheiro?",
      options: ["Sim", "Não, só registra o fato financeiro"],
      answer: 1,
    },
    {
      q: "Posso quitar um título arrastando no Kanban?",
      options: ["Sim", "Não, o status deriva dos pagamentos"],
      answer: 1,
    },
    {
      q: "Por que a DRE muda entre Competência e Caixa?",
      options: ["Erro do sistema", "O critério temporal muda: competência ou data de pagamento"],
      answer: 1,
    },
    {
      q: "Aprovar um pagamento significa executá-lo?",
      options: ["Sim", "Não, a execução é ação separada"],
      answer: 1,
    },
  ],
};

export function publicQuiz(module: HelpModuleKey) {
  return (QUIZZES[module] ?? []).map(({ q, options }) => ({ q, options }));
}
