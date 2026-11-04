/**
 * Mensagem do cliente que chegou enquanto a IA escrevia: a resposta é
 * descartada e o turno volta à fila para ler a conversa completa. Limite
 * de refações evita laço em rajadas longas. Pura.
 */
export const NEWER_INBOUND_MAX_REQUEUES = 2;

export function shouldRequeueForNewerInbound(p: {
  kind: string;
  lastReadInboundAt: string | null;
  latestInboundAt: string | null;
  requeues: number;
  hadEffects: boolean;
}): boolean {
  if (p.kind !== "reply" || p.hadEffects) return false;
  if (p.requeues >= NEWER_INBOUND_MAX_REQUEUES) return false;
  if (!p.latestInboundAt) return false;
  if (!p.lastReadInboundAt) return true;
  return new Date(p.latestInboundAt).getTime() > new Date(p.lastReadInboundAt).getTime();
}
