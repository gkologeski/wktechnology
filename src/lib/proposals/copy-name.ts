const COPY_SUFFIX_RE = /\s+\(cópia(?:\s+\d+)?\)$/i;

function fitName(base: string, suffix: string, maxLen: number): string {
  const maxBase = Math.max(1, maxLen - suffix.length);
  return `${base.slice(0, maxBase).trimEnd()}${suffix}`;
}

export function nextCopyName(
  sourceName: string,
  existingNames: Iterable<string>,
  maxLen = 200,
): string {
  const normalized = new Set<string>();
  for (const name of existingNames) {
    normalized.add(name.trim().toLocaleLowerCase("pt-BR"));
  }

  const trimmed = sourceName.trim();
  const stripped = trimmed.replace(COPY_SUFFIX_RE, "").trim();
  const base = stripped || trimmed || "Modelo";

  const first = fitName(base, " (cópia)", maxLen);
  if (!normalized.has(first.toLocaleLowerCase("pt-BR"))) {
    return first;
  }

  let n = 2;
  while (true) {
    const candidate = fitName(base, ` (cópia ${n})`, maxLen);
    if (!normalized.has(candidate.toLocaleLowerCase("pt-BR"))) {
      return candidate;
    }
    n += 1;
  }
}
