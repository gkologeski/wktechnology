function validConnectionState(
  expected: string,
  actual: string,
  expires: string,
  now: number,
  consumed: boolean,
) {
  return (
    !consumed &&
    expected.length > 0 &&
    expected === actual &&
    Number.isFinite(Date.parse(expires)) &&
    Date.parse(expires) > now
  );
}
/** Pure verification of a callback pointer, against server-stored ownership and state. */
export function validateLinkedinCallback(input: {
  expectedStateHash: string;
  actualStateHash: string;
  expiresAt: string;
  consumed: boolean;
  expectedScope: string | null;
  expectedAccountId: string;
  account: Record<string, unknown>;
  now: number;
}) {
  if (
    !validConnectionState(
      input.expectedStateHash,
      input.actualStateHash,
      input.expiresAt,
      input.now,
      input.consumed,
    )
  )
    throw new Error("Conexão expirada ou já utilizada. Inicie uma nova autenticação.");
  if (
    input.account.id !== input.expectedAccountId ||
    input.account.provider !== "linkedin" ||
    (input.account.account_scope_id ?? null) !== input.expectedScope ||
    input.account.status !== "running"
  )
    throw new Error("A conta não pertence ao escopo pessoal ou ainda não está operacional.");
  return {
    id: input.expectedAccountId,
    name: typeof input.account.name === "string" ? input.account.name.slice(0, 120) : null,
  };
}
