/**
 * Rodízio de números remetentes em campanhas de WhatsApp (ROTACAO-NUMEROS).
 * Regra pura: número principal da campanha + até 4 adicionais (todos oficiais da Meta).
 * O número escolhido é fixado no destinatário no primeiro envio e nunca troca.
 */
export const MAX_ROTATION_SENDERS = 5;

export type SenderRotationMode = "sequential" | "random";

/** Principal + adicionais, sem duplicar, só ids numéricos, limitado a 5. */
export function buildSenderRotation(primary: string | null | undefined, extras: unknown): string[] {
  if (!primary) return [];
  const out: string[] = [];
  const push = (v: unknown) => {
    const id = typeof v === "string" ? v.trim() : "";
    if (!/^\d{5,30}$/.test(id) || out.includes(id) || out.length >= MAX_ROTATION_SENDERS) return;
    out.push(id);
  };
  push(primary);
  if (Array.isArray(extras)) for (const e of extras) push(e);
  return out;
}

export type SenderPick =
  | { kind: "ok"; sender: string; fixedNow: boolean }
  /** Destinatário já preso a um número indisponível: fica pendente, sem trocar. */
  | { kind: "fixed_unavailable"; sender: string }
  | { kind: "none" };

/**
 * Escolhe o número do destinatário.
 * - Já fixado: mantém (mesmo fora da lista atual); se indisponível, aguarda.
 * - Sequencial: posição `seq % n` entre os disponíveis; aleatório usa `rand` em [0,1).
 */
export function pickSender(
  list: string[],
  available: ReadonlySet<string>,
  mode: SenderRotationMode,
  seq: number,
  rand: number,
  fixed?: string | null,
): SenderPick {
  if (fixed) {
    return available.has(fixed)
      ? { kind: "ok", sender: fixed, fixedNow: false }
      : { kind: "fixed_unavailable", sender: fixed };
  }
  const usable = list.filter((s) => available.has(s));
  if (usable.length === 0) return { kind: "none" };
  if (usable.length === 1) return { kind: "ok", sender: usable[0], fixedNow: true };
  if (mode === "random") {
    const i = Math.min(usable.length - 1, Math.floor(Math.max(0, rand) * usable.length));
    return { kind: "ok", sender: usable[i], fixedNow: true };
  }
  const i = ((Math.floor(seq) % usable.length) + usable.length) % usable.length;
  return { kind: "ok", sender: usable[i], fixedNow: true };
}
