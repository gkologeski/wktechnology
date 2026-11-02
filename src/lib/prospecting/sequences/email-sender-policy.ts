/**
 * Regra do remetente de e-mail das sequências: quem não é administrador
 * envia sempre pela própria conta; administradores escolhem qualquer conta.
 */
export type EmailSenderPolicy = { isAdmin: boolean; ownAccountId: string | null };

export function applyEmailSenderPolicy<T extends { type: string; accountId?: string | null }>(
  steps: T[],
  policy: EmailSenderPolicy,
): T[] {
  if (policy.isAdmin) return steps;
  const hasEmail = steps.some((s) => s.type === "email");
  if (hasEmail && !policy.ownAccountId)
    throw new Error("Conecte sua conta de e-mail em Canais para usar passos de e-mail.");
  return steps.map((s) => (s.type === "email" ? { ...s, accountId: policy.ownAccountId } : s));
}
