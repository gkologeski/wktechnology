// Formas equivalentes de um celular brasileiro: a Meta pode entregar o número
// sem o nono dígito (+55 DD XXXXXXXX) enquanto o cadastro tem +55 DD 9XXXXXXXX.
export function brPhoneVariants(phoneE164: string): string[] {
  const d = phoneE164.replace(/\D/g, "");
  const out = new Set<string>([`+${d}`]);
  if (d.startsWith("55")) {
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    if (rest.length === 9 && rest.startsWith("9")) out.add(`+55${ddd}${rest.slice(1)}`);
    if (rest.length === 8 && /^[6-9]/.test(rest)) out.add(`+55${ddd}9${rest}`);
  }
  return [...out];
}

/** Escolhe a conversa com o recebimento mais recente (a que define a janela). */
export function pickWindowConversation<
  T extends { last_inbound_at: string | null; last_message_at?: string | null },
>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  const ts = (v: string | null | undefined) => (v ? new Date(v).getTime() : 0);
  return [...rows].sort(
    (a, b) =>
      ts(b.last_inbound_at) - ts(a.last_inbound_at) || ts(b.last_message_at) - ts(a.last_message_at),
  )[0]!;
}
