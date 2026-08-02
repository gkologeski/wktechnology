// Substituição de variáveis ({{token}}) em templates de e-mail, snippets e
// macros. Suporta chaves simples (`{{first_name}}`) e com ponto
// (`{{agent.name}}`), resolvidas em objetos aninhados do contexto.

export type TokenContext = {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  company?: string | null;
  /** Remetente (usuário logado), usado por {{agent.name}} / {{agent.email}}. */
  agent?: { name?: string | null; email?: string | null } | null;
  /** Chaves extras específicas do contexto (ticket, macro, etc.). */
  [key: string]: unknown;
};

/** Lê `a.b.c` em objetos aninhados; retorna undefined quando não existir. */
function getPath(ctx: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, ctx);
}

export function renderTokens(input: string, ctx: TokenContext): string {
  if (!input) return input;
  return input.replace(/\{\{\s*([\w.]+)\s*\}\}/gi, (match, key: string) => {
    const direct = (ctx as Record<string, unknown>)[key.toLowerCase()];
    const value = direct !== undefined ? direct : getPath(ctx, key.toLowerCase());
    if (value === undefined) return match; // token desconhecido permanece visível
    return value == null ? "" : String(value);
  });
}

// Expand snippet shortcuts written as /shortcut (must be word-bounded).
export function expandSnippets(
  input: string,
  snippets: { shortcut: string; body: string }[],
): string {
  let out = input;
  for (const s of snippets) {
    const re = new RegExp(`(^|\\s)/${escapeRegex(s.shortcut)}(?=\\s|$)`, "g");
    out = out.replace(re, (_m, pre) => `${pre}${s.body}`);
  }
  return out;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
