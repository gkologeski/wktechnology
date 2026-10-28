// Complemento por IA (prompt) para detectar "não sou/não estou mais nesta empresa".
// Módulo puro: monta o pedido e interpreta a resposta; a chamada fica no servidor.

export const COMPANY_LEFT_MIN_CONFIDENCE = 0.7;

export const COMPANY_LEFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["saiu_ou_nao_pertence", "nova_empresa", "confianca"],
  properties: {
    saiu_ou_nao_pertence: { type: "boolean" },
    nova_empresa: { type: ["string", "null"] },
    confianca: { type: "number" },
  },
} as const;

export function buildCompanyLeftPrompt(companyName: string, message: string) {
  return [
    {
      role: "system",
      content:
        "Você analisa UMA mensagem de WhatsApp recebida de um contato comercial. " +
        "O cadastro diz que ele trabalha na empresa informada. Responda em JSON se a mensagem " +
        "afirma que a pessoa NÃO pertence (ou não pertence mais) a essa empresa — por exemplo: " +
        "'não sou da X', 'não faço parte da X', 'não trabalho mais aí', 'contato errado, não sou dessa empresa', " +
        "'saí da X', 'agora estou na Y'. Se citar a nova empresa, preencha nova_empresa; senão null. " +
        "NÃO marque verdadeiro para recusas de interesse, pedidos para parar, negações sobre outros assuntos " +
        "ou quando a empresa negada for diferente da informada. Em dúvida, falso com confiança baixa. " +
        "confianca vai de 0 a 1.",
    },
    {
      role: "user",
      content: `Empresa no cadastro: ${companyName}\nMensagem: ${message.slice(0, 1500)}`,
    },
  ];
}

export function parseCompanyLeftAnswer(
  text: string,
): { left: true; newCompany: string | null } | null {
  try {
    const outer = JSON.parse(text);
    const content = outer?.choices?.[0]?.message?.content ?? text;
    const j = typeof content === "string" ? JSON.parse(content) : content;
    if (j?.saiu_ou_nao_pertence !== true) return null;
    if (typeof j.confianca !== "number" || j.confianca < COMPANY_LEFT_MIN_CONFIDENCE) return null;
    const n = typeof j.nova_empresa === "string" ? j.nova_empresa.trim() : "";
    return { left: true, newCompany: n ? n.slice(0, 120) : null };
  } catch {
    return null;
  }
}
