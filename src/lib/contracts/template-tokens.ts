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
  { token: "{{contract.payment_method}}", label: "Forma de pagamento", group: "Contrato" },
  { token: "{{contract.readjustment_index}}", label: "Índice de reajuste", group: "Contrato" },
  { token: "{{contract.penalty_percent}}", label: "Multa (%)", group: "Contrato" },
  { token: "{{contract.service_type}}", label: "Tipo de serviço", group: "Contrato" },
  { token: "{{contract.service_scope}}", label: "Escopo do serviço", group: "Contrato" },
  { token: "{{contract.service_location}}", label: "Local de execução", group: "Contrato" },
  { token: "{{contract.jurisdiction}}", label: "Foro", group: "Contrato" },
  { token: "{{contract.governing_law}}", label: "Lei aplicável", group: "Contrato" },

  // Contraparte (empresa do contrato)
  { token: "{{counterparty.name}}", label: "Razão social", group: "Contraparte" },
  { token: "{{counterparty.cnpj}}", label: "CNPJ", group: "Contraparte" },
  { token: "{{counterparty.address}}", label: "Endereço", group: "Contraparte" },
  { token: "{{counterparty.city}}", label: "Cidade", group: "Contraparte" },
  { token: "{{counterparty.state}}", label: "Estado", group: "Contraparte" },

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
export function mergeTemplateBody(
  html: string,
  ctx: Record<string, unknown>,
  options?: { keepUnknown?: boolean },
): string {
  return renderTokensWith(html, (key) => {
    const value = getPath(ctx, key);
    if (value == null || value === "") {
      if (options?.keepUnknown) return `{{${key}}}`;
      const label = CONTRACT_TEMPLATE_TOKENS.find((t) => t.token === `{{${key}}}`)?.label;
      return `[[${label ?? key}]]`;
    }
    return String(value);
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
