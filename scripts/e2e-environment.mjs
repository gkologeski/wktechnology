// Destructive E2E must never inherit an application's production connection.
export function resolveE2EEnvironment(env) {
  const base = env.E2E_BASE_URL;
  const api = env.E2E_SUPABASE_URL;
  const key = env.E2E_SUPABASE_ANON_KEY;
  if (!base || !api || !key)
    throw new Error(
      "E2E requires explicit E2E_BASE_URL, E2E_SUPABASE_URL and E2E_SUPABASE_ANON_KEY.",
    );
  const app = new URL(base),
    database = new URL(api);
  for (const url of [app, database]) {
    if (
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !["", "/"].includes(url.pathname)
    ) {
      throw new Error(
        "Authenticated E2E accepts loopback origins only; remote/production targets are forbidden.",
      );
    }
  }
  return {
    baseURL: app.origin,
    apiURL: database.origin,
    anonKey: key,
    storageKey: `sb-${database.hostname.split(".")[0]}-auth-token`,
  };
}
