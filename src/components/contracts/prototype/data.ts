// Dados demonstrativos do protótipo PROXIMO-PASSO-CONTRATO. Sem leitura/gravação real.
export type ProtoStage = "draft" | "in_review" | "awaiting_signature" | "active";

export const PROTO_STAGES: { id: ProtoStage | "closing"; label: string }[] = [
  { id: "draft", label: "Rascunho" },
  { id: "in_review", label: "Revisão e aprovação" },
  { id: "awaiting_signature", label: "Assinatura" },
  { id: "active", label: "Ativo" },
  { id: "closing", label: "Renovação ou encerramento" },
];

export type ProtoScenario = {
  stage: ProtoStage;
  statusLabel: string;
  headline: string;
  explanation: string;
  primary: string;
  secondary?: string[];
  checklist?: { label: string; done: boolean }[];
  people?: { name: string; role: string; state: string }[];
};

export const PROTO_CONTRACT = {
  title: "Consultoria - Pacote de Horas — ÓGEA",
  number: "CT-2026-0142",
  value: "R$ 45.000,00",
  counterparty: "OGEA SERVICOS LTDA",
  starts: "10/11/2026",
  ends: "08/02/2027",
  payment: "1x no boleto, vencimento dia 15",
};

export const PROTO_SCENARIOS: Record<ProtoStage, ProtoScenario> = {
  draft: {
    stage: "draft",
    statusLabel: "Rascunho",
    headline: "Revise os dados e envie para aprovação",
    explanation:
      "Falta 1 item antes de enviar. Depois da aprovação, o contrato segue para assinatura.",
    primary: "Enviar para aprovação",
    secondary: ["Pular aprovação e preparar assinatura"],
    checklist: [
      { label: "Vigência preenchida (90 dias)", done: true },
      { label: "Valor e parcelas", done: true },
      { label: "Signatário da contratante (Alan Marcos Gulfier)", done: true },
      { label: "Corpo do contrato revisado", done: false },
    ],
  },
  in_review: {
    stage: "in_review",
    statusLabel: "Em revisão",
    headline: "Aguardando 1 de 2 aprovações",
    explanation:
      "Você será avisado quando todos aprovarem. Ninguém precisa fazer nada nesta ficha agora.",
    primary: "Ver aprovações pendentes",
    secondary: ["Cobrar aprovador"],
    people: [
      { name: "Jurídico — Marina Souza", role: "Aprovador", state: "Aprovado" },
      { name: "Diretoria — Guilherme K.", role: "Aprovador", state: "Pendente" },
    ],
  },
  awaiting_signature: {
    stage: "awaiting_signature",
    statusLabel: "Aguardando assinatura",
    headline: "Enviado para assinatura há 2 dias",
    explanation: "Quando todos assinarem, você poderá ativar o contrato e os serviços.",
    primary: "Acompanhar assinatura",
    secondary: ["Reenviar convite"],
    people: [
      { name: "Alan Marcos Gulfier", role: "Contratante", state: "Pendente" },
      { name: "WK Technology", role: "Contratada", state: "Assinado" },
    ],
  },
  active: {
    stage: "active",
    statusLabel: "Ativo",
    headline: "Contrato em vigor até 08/02/2027",
    explanation: "Faltam 90 dias. Registre medições ou crie um aditivo se o escopo mudar.",
    primary: "Registrar medição",
    secondary: ["Adicionar aditivo", "Renovar"],
  },
};
