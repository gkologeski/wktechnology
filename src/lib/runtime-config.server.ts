const DEFAULT_PUBLIC_APP_URL = "https://app.wktechnology.com.br";

function normalizeOrigin(value: string): string {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("A URL pública deve usar HTTP ou HTTPS.");
  }
  return url.origin;
}

/** Resolve a origem pública sem acoplar chamadas externas a uma instância de preview. */
export function publicAppOrigin(env: Record<string, string | undefined> = process.env): string {
  const configured = env.PUBLIC_APP_URL ?? env.LOVABLE_APP_URL ?? env.APP_URL;
  return normalizeOrigin(configured?.trim() || DEFAULT_PUBLIC_APP_URL);
}

/** Mocks que alteram dados só podem rodar quando habilitados explicitamente. */
export function internalMocksEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.INTERNAL_MOCKS_ENABLED === "true";
}
