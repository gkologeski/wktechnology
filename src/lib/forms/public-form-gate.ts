/** Porta do envio público: formulário existente e ativo, e no máximo 5 envios por IP em 10 min. */
export function publicFormGate(
  form: { active: boolean | null } | null,
  recentFromIp: number,
): { status: 404 | 429; error: string } | null {
  if (!form || !form.active) return { status: 404, error: "Not found" };
  if (recentFromIp >= 5) return { status: 429, error: "Too many submissions, try again later." };
  return null;
}
