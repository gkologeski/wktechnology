// Metadados dos campos de `public.contracts` para o construtor de Workflows.
// Vive fora de `*.functions.ts` porque módulos de server functions são
// divididos no build e perderiam constantes de runtime.
//
// Cobre: rótulos PT-BR, listas canônicas (combos), campos que nunca viram
// combo e campos de sistema/integração (mostrados em bloco colapsado).
import {
  PAYMENT_METHODS,
  READJUSTMENT_INDEXES,
  SERVICE_LOCATIONS,
  SERVICE_TYPES,
  SIGNATURE_PROVIDERS,
} from "./import-schemas";

/** Rótulos PT-BR de todas as colunas de contrato. */
export const CONTRACT_FIELD_LABELS: Record<string, string> = {
  role: "Papel na relação",
  status: "Status do contrato",
  title: "Título do contrato",
  number: "Número do contrato",
  counterparty_company_id: "Empresa contraparte",
  contracting_legal_entity_id: "Empresa contratante (CNPJ)",
  parent_contract_id: "Contrato principal (aditivo/renovação)",
  deal_id: "Negócio",
  assigned_to: "Responsável",
  starts_at: "Início da vigência",
  ends_at: "Fim da vigência",
  auto_renew: "Renovação automática",
  notice_days: "Aviso prévio (dias)",
  total_value: "Valor total",
  monthly_value: "Valor mensal",
  hours_per_month: "Horas por mês",
  currency: "Moeda",
  readjustment_index: "Índice de reajuste",
  readjustment_period: "Periodicidade do reajuste",
  payment_day: "Dia de pagamento",
  payment_method: "Forma de pagamento",
  payment_terms: "Condições de pagamento (dados técnicos)",
  late_fee_percent: "Multa por atraso (%)",
  late_interest_monthly_percent: "Juros mensais por atraso (%)",
  expense_reimbursement_days: "Reembolso de despesas (dias)",
  penalty_percent: "Multa rescisória (%)",
  cure_period_days: "Prazo de cura (dias)",
  trial_period_days: "Período de experiência (dias)",
  unilateral_termination_notice_days: "Aviso de rescisão unilateral (dias)",
  service_type: "Tipo de serviço",
  service_scope: "Escopo do serviço",
  service_location: "Local de execução",
  governing_law: "Lei aplicável",
  jurisdiction: "Foro",
  confidentiality_term_months: "Prazo de sigilo (meses)",
  body_html: "Corpo do contrato",
  signature_provider: "Provedor de assinatura",
  signature_document_id: "ID do documento no provedor de assinatura",
  signature_document_path: "Caminho do documento de assinatura",
  signature_operation_id: "ID da operação de assinatura",
  signed_at: "Assinado em",
  signed_pdf_path: "Caminho do PDF assinado",
  public_token: "Token do link público",
  source_file_path: "Arquivo de origem (importação)",
  imported_from: "Importado de",
  import_confidence: "Confiança da importação (IA)",
  metadata: "Metadados técnicos",
  witnesses: "Testemunhas",
  created_at: "Criado em",
  updated_at: "Atualizado em",
};

const label = <T extends readonly string[]>(
  values: T,
  labels: Partial<Record<T[number], string>>,
) =>
  values.map((v) => ({
    value: v,
    label: (labels as Record<string, string>)[v] ?? v,
  }));

/**
 * Listas canônicas por coluna. Substituem a amostragem de valores distintos
 * (que gerava combos gigantes ou em inglês).
 */
export const CONTRACT_FIELD_OPTIONS: Record<string, { value: string; label: string }[]> = {
  role: [
    { value: "provider", label: "Prestação (somos o prestador)" },
    { value: "client", label: "Compra (somos o cliente)" },
  ],
  status: [
    { value: "draft", label: "Rascunho" },
    { value: "in_review", label: "Em revisão" },
    { value: "in_negotiation", label: "Em negociação" },
    { value: "awaiting_signature", label: "Aguardando assinatura" },
    { value: "active", label: "Ativo" },
    { value: "renewing", label: "Renovando" },
    { value: "ended", label: "Encerrado" },
    { value: "terminated", label: "Rescindido" },
  ],
  currency: [
    { value: "BRL", label: "Real (BRL)" },
    { value: "USD", label: "Dólar (USD)" },
    { value: "EUR", label: "Euro (EUR)" },
  ],
  readjustment_index: label(READJUSTMENT_INDEXES, {
    IGPM: "IGP-M",
    IPCA: "IPCA",
    INPC: "INPC",
    SELIC: "SELIC",
    CDI: "CDI",
    outros: "Outros",
  }),
  readjustment_period: [
    { value: "anual", label: "Anual" },
    { value: "semestral", label: "Semestral" },
    { value: "trimestral", label: "Trimestral" },
    { value: "mensal", label: "Mensal" },
    { value: "sem_reajuste", label: "Sem reajuste" },
  ],
  service_type: label(SERVICE_TYPES, {
    outsourcing: "Outsourcing",
    desenvolvimento: "Desenvolvimento",
    manutencao: "Manutenção",
    consultoria: "Consultoria",
    licenciamento: "Licenciamento",
    outros: "Outros",
  }),
  service_location: label(SERVICE_LOCATIONS, {
    remoto: "Remoto",
    presencial: "Presencial",
    hibrido: "Híbrido",
  }),
  payment_method: label(PAYMENT_METHODS, {
    pix: "Pix",
    ted: "TED",
    boleto: "Boleto",
    transferencia: "Transferência",
    outros: "Outros",
  }),
  signature_provider: label(SIGNATURE_PROVIDERS, {
    forsign: "ForSign",
    docusign: "DocuSign",
    clicksign: "Clicksign",
    manual: "Assinatura manual",
    outros: "Outros",
  }),
  imported_from: [
    { value: "pdf", label: "PDF" },
    { value: "docx", label: "DOCX" },
  ],
};

/** Campos de digitação livre — nunca viram combo por amostragem de valores. */
export const CONTRACT_FREE_TEXT_FIELDS = new Set<string>([
  "title",
  "number",
  "service_scope",
  "governing_law",
  "jurisdiction",
  "body_html",
  "signature_document_id",
  "signature_document_path",
  "signature_operation_id",
  "signed_pdf_path",
  "source_file_path",
  "public_token",
]);

/**
 * Campos normalmente preenchidos pelo sistema ou pela integração de assinatura.
 * Continuam editáveis, mas em bloco colapsado ("Outros campos").
 */
export const CONTRACT_SYSTEM_FIELDS = new Set<string>([
  "number",
  "public_token",
  "signature_document_id",
  "signature_document_path",
  "signature_operation_id",
  "signed_pdf_path",
  "source_file_path",
  "imported_from",
  "import_confidence",
  "metadata",
  "payment_terms",
]);
