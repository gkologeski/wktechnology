export const publishedUrls: readonly string[];
export function validateLocalEvidence(verify: unknown, build: unknown, currentHash: string): string;
export function validatePublishedVersions(
  expectedHash: string,
  versions: Array<{ url?: string; source_hash?: string; built_at?: string }>,
): true;
export function parseDeliveryArgs(args: string[]): { prepare: boolean; expectedCommit?: string };

export function readPublishedVersion(
  url: string,
  fetcher?: (input: string, init?: RequestInit) => Promise<Response>,
): Promise<{ url: string; resolved_url: string; source_hash?: string; built_at?: string }>;
