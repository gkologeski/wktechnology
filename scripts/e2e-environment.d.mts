export function resolveE2EEnvironment(env: Record<string, string | undefined>): {
  baseURL: string;
  apiURL: string;
  anonKey: string;
  storageKey: string;
};
