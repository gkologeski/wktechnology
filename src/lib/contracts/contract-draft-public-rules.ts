// ACEITE-MINUTA Entrega 3: regra pura da resposta do cliente (espelho do RPC
// contract_draft_public_decide; a decisão real é no banco).
export type ClientDecision = "accept" | "changes";

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function clientDraftDecisionError(input: {
  token: string;
  status: string | null;
  decision: ClientDecision;
  name: string;
  note: string | null;
}): string | null {
  if (!TOKEN_RE.test(input.token)) return "Link inválido.";
  if (input.status == null) return "Minuta não encontrada.";
  if (input.status !== "sent") return "Esta minuta já foi respondida.";
  if (input.name.trim().length < 3) return "Informe seu nome.";
  if (input.decision === "changes" && (input.note ?? "").trim().length < 5)
    return "Descreva os ajustes desejados.";
  return null;
}
