// Catálogo de variáveis (tokens) disponíveis em modelos de contrato do TechContracts
// e o merge puro do corpo do modelo. Client-safe (sem I/O) para uso no editor e no preview.
import type { MessageToken } from "@/lib/message-tokens-catalog";
import { renderTokensWith, getPath } from "@/lib/message-tokens";

export const CONTRACT_TEMPLATE_TOKENS: MessageToken[] = [
  // Contrato
  { token: "{{contract.number}}", label: "Número", group: "Contrato" },
  { token: "{{contract.title}}", label: "Título", group: "Contrato" },
  { token: "{{contract.starts_at}}", label: "Início da vigência", group: "Contrato" },
  { token: "{{contract.ends_at}}", label: "Fim da vigência", group: "Contrato" },
  { token: "{{contract.notice_days}}", label: "Aviso prévio (dias)", group: "Contrato" },
  { token: "{{contract.total_value}}", label: "Valor total", group: "Contrato" },
  { token: "{{contract.monthly_value}}", label: "Valor mensal", group: "Contrato" },
  { token: "{{contract.currency}}", label: "Moeda", group: "Contrato" },
  { token: "{{contract.payment_day}}", label: "Dia de pagamento", group: "Contrato" },
  { token: "{{contract.validity_days}}", label: "Vigência (dias)", group: "Contrato" },
  { token: "{{contract.installments_count}}", label: "Quantidade de parcelas", group: "Contrato" },
  {
    token: "{{contract.installments_due_day}}",
    label: "Dia de vencimento das parcelas",
    group: "Contrato",
  },
  { token: "{{contract.payment_method}}", label: "Forma de pagamento", group: "Contrato" },
  { token: "{{contract.payment_schedule}}", label: "Condições de pagamento", group: "Contrato" },
  { token: "{{contract.readjustment_index}}", label: "Índice de reajuste", group: "Contrato" },
  { token: "{{contract.penalty_percent}}", label: "Multa (%)", group: "Contrato" },
  { token: "{{contract.service_type}}", label: "Tipo de serviço", group: "Contrato" },
  { token: "{{contract.service_scope}}", label: "Escopo do serviço", group: "Contrato" },
  { token: "{{contract.service_location}}", label: "Local de execução", group: "Contrato" },
  { token: "{{contract.jurisdiction}}", label: "Foro", group: "Contrato" },
  { token: "{{contract.governing_law}}", label: "Lei aplicável", group: "Contrato" },

  // Proposta Comercial aceita pelo cliente
  { token: "{{proposal.id}}", label: "Identificador", group: "Proposta Comercial" },
  { token: "{{proposal.title}}", label: "Título", group: "Proposta Comercial" },
  { token: "{{proposal.version}}", label: "Versão aceita", group: "Proposta Comercial" },
  { token: "{{proposal.decided_at}}", label: "Data do aceite", group: "Proposta Comercial" },

  // Contraparte (empresa do contrato)
  { token: "{{counterparty.name}}", label: "Razão social", group: "Contraparte" },
  { token: "{{counterparty.cnpj}}", label: "CNPJ", group: "Contraparte" },
  { token: "{{counterparty.address}}", label: "Endereço", group: "Contraparte" },
  { token: "{{counterparty.city}}", label: "Cidade", group: "Contraparte" },
  { token: "{{counterparty.state}}", label: "Estado", group: "Contraparte" },

  // Signatário legal da contraparte (contato marcado como signatário)
  { token: "{{signer.full_name}}", label: "Nome do signatário", group: "Signatário" },
  { token: "{{signer.cpf}}", label: "CPF do signatário", group: "Signatário" },
  { token: "{{signer.email}}", label: "E-mail do signatário", group: "Signatário" },

  // Contratante (nossa PJ)
  { token: "{{contracting.name}}", label: "Razão social", group: "Contratante" },
  { token: "{{contracting.cnpj}}", label: "CNPJ", group: "Contratante" },
  { token: "{{contracting.address}}", label: "Endereço", group: "Contratante" },

  // Contato principal
  { token: "{{contact.full_name}}", label: "Nome completo", group: "Contato" },
  { token: "{{contact.email}}", label: "E-mail", group: "Contato" },
  { token: "{{contact.phone}}", label: "Telefone", group: "Contato" },

  // Negócio
  { token: "{{deal.name}}", label: "Nome do negócio", group: "Negócio" },
  { token: "{{deal.value}}", label: "Valor do negócio", group: "Negócio" },

  // Serviço vinculado
  { token: "{{service.name}}", label: "Nome do serviço", group: "Serviço" },
  { token: "{{service.description}}", label: "Descrição do serviço", group: "Serviço" },
  { token: "{{service.unit}}", label: "Unidade", group: "Serviço" },
  { token: "{{service.base_price}}", label: "Preço base", group: "Serviço" },

  // Gerais
  { token: "{{today}}", label: "Data de hoje", group: "Gerais" },
  { token: "{{today_long}}", label: "Data por extenso", group: "Gerais" },
  { token: "{{agent.name}}", label: "Responsável", group: "Gerais" },
  { token: "{{agent.email}}", label: "E-mail do responsável", group: "Gerais" },
];

export const TEMPLATE_TOKEN_KEYS = CONTRACT_TEMPLATE_TOKENS.map((t) =>
  t.token.replace(/^\{\{\s*|\s*\}\}$/g, ""),
);

/** Substitui os tokens do modelo pelos valores do contexto. Tokens sem valor viram `[[label]]`. */
/** Mensagem em PT-BR com os rótulos das variáveis obrigatórias vazias. */
export function missingFieldsMessage(keys: string[]): string {
  const labels = keys.map(
    (k) => CONTRACT_TEMPLATE_TOKENS.find((t) => t.token === `{{${k}}}`)?.label ?? k,
  );
  const hint = keys.some((k) => k.startsWith("contract.installments_"))
    ? " Informe parcelas e vencimento na proposta ou no passo Dados do Novo contrato."
    : "";
  return `Preencha os dados obrigatórios do modelo: ${labels.join(", ")}.${hint}`;
}

export function mergeTemplateBody(
  html: string,
  ctx: Record<string, unknown>,
  options?: { keepUnknown?: boolean; strict?: boolean },
): string {
  if (options?.strict) {
    const missing = usedTokens(html).filter((key) => {
      const value = getPath(ctx, key);
      return !TEMPLATE_TOKEN_KEYS.includes(key) || value == null || String(value).trim() === "";
    });
    if (missing.length) throw new Error(missingFieldsMessage(missing));
  }
  return renderTokensWith(html, (key) => {
    const value = getPath(ctx, key);
    if (value == null || value === "") {
      if (options?.keepUnknown) return `{{${key}}}`;
      const label = CONTRACT_TEMPLATE_TOKENS.find((t) => t.token === `{{${key}}}`)?.label;
      return `[[${label ?? key}]]`;
    }
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  });
}

/** Lista os tokens usados em um corpo de modelo (na ordem de aparição, sem repetição). */
export function usedTokens(html: string | null | undefined): string[] {
  if (!html) return [];
  const found = new Set<string>();
  renderTokensWith(html, (key) => {
    found.add(key);
    return "";
  });
  return Array.from(found);
}

/** Tokens presentes no corpo que não fazem parte do catálogo conhecido. */
export function unknownTokens(html: string | null | undefined): string[] {
  return usedTokens(html).filter((k) => !TEMPLATE_TOKEN_KEYS.includes(k));
}
