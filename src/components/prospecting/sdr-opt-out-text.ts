/**
 * Texto das frases de saída na Configuração do agente. Só converte o que foi
 * digitado em lista; quem decide se uma mensagem é pedido de saída é
 * `detectOptOut` (policy.ts), no servidor. Sem acesso a dados.
 */

/**
 * Separa por vírgula ou quebra de linha, apara bordas, descarta vazias e
 * repetidas (sem diferenciar maiúsculas) e mantém a ordem. Até 50 frases de
 * 80 caracteres, os mesmos limites que o servidor aceita.
 */
export function parseOptOutPhrases(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[,\n]/)) {
    const phrase = raw.trim().slice(0, 80);
    const k = phrase.toLocaleLowerCase("pt-BR");
    if (!phrase || seen.has(k)) continue;
    seen.add(k);
    out.push(phrase);
    if (out.length === 50) break;
  }
  return out;
}
