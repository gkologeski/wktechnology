function requireProviderKey(service: boolean) {
  const key =
    (service ? process.env.UNIPILE_SERVICE_KEY : undefined) || process.env.UNIPILE_API_KEY;
  if (!key) throw new Error("Configure a chave Unipile no formulário seguro da integração.");
  return key;
}
/** Provider credentials never leave this server module. No redirects with API keys. */
export async function unipileAuthRequest(path: string, body?: unknown, service = false) {
  const key = requireProviderKey(service);
  const base = (process.env.UNIPILE_API_BASE_URL || "https://api.unipile.com/v2").replace(
    /\/$/,
    "",
  );
  const response = await fetch(`${base}${path}`, {
    method: body ? "POST" : "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
    headers: { "X-API-KEY": key, Accept: "application/json", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok)
    throw new Error(
      `Unipile recusou a operação de conexão (${response.status}). Verifique chave, escopo e permissões no painel da integradora.`,
    );
  return response.json() as Promise<Record<string, unknown>>;
}
export async function ensurePersonalScope(reference: string) {
  const listed = await unipileAuthRequest(
    `/scopes?search=${encodeURIComponent(reference)}&limit=100`,
    undefined,
    true,
  );
  const items = (listed.items ?? listed.data ?? []) as Array<Record<string, unknown>>;
  const match = items.find((s) => s.reference === reference);
  const scope =
    match ?? (await unipileAuthRequest("/scopes", { name: "TechERP LinkedIn", reference }, true));
  if (typeof scope.id !== "string" || scope.status !== "active" || scope.reference !== reference)
    throw new Error(
      "Escopo pessoal Unipile indisponível. Confira o status no painel da integradora.",
    );
  return scope.id;
}
