/**
 * Validadores técnicos sobre a conversa do Agente SDR (puros). Não decidem
 * texto nem estratégia: detectam efeito falso (material), laço de robô
 * (mensagem idêntica repetida) e o gatilho da automação opcional de
 * transferência após pergunta sobre IA (desligada por padrão).
 */
type Msg = { direction: string; body?: string | null };

function norm(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\n ]/gu, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

const inbound = (h: Msg[]) => h.filter((m) => m.direction === "inbound");

/** "Você é uma IA/robô/bot?" */
export function isAiIdentityQuestion(text: string): boolean {
  return /\b(voce|vc|e|eh|tu) (e |eh |esta )?(uma |um )?(ia|i a|inteligencia artificial|robo|bot|chatbot|maquina|gpt|chatgpt|automatic[oa])\b|\b(falando com|conversando com) (uma |um )?(ia|robo|bot|maquina|pessoa de verdade)\b|\b(e|eh) (uma )?pessoa (real|de verdade)\b/.test(
    norm(text),
  );
}

/** Lia afirma que enviou/vai enviar material. */
export function claimsMaterialSent(text: string): boolean {
  return /\b(material (enviado|segue|em anexo)|(estou|ja estou|vou|vou te|irei) (enviar|reenviar|encaminhar|mandar)( o| um)? (material|apresentacao|documento|portfolio)|segue (o |a )?(material|apresentacao)|enviando o material|enviei (o )?material)\b/.test(
    norm(text),
  );
}

/** Mesma mensagem recebida 2+ vezes: típico de robô repetindo o menu. */
export function repeatsIdenticalInbound(history: Msg[]): boolean {
  const seen = new Map<string, number>();
  for (const m of inbound(history)) {
    const k = norm(String(m.body ?? ""));
    if (k.length < 25) continue;
    const n = (seen.get(k) ?? 0) + 1;
    if (n >= 2) return true;
    seen.set(k, n);
  }
  return false;
}
