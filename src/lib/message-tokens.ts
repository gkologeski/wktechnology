// Módulo único de substituição de variáveis ({{token}}) usado por todas as
// superfícies de mensagem do sistema: e-mail (envio e modelos), campanhas,
// snippets, macros de atendimento, WhatsApp (texto livre), ATS e workflows.
//
// Suporta chaves simples (`{{first_name}}`) e com ponto (`{{agent.name}}`),
// resolvidas tanto em objetos aninhados quanto em chaves planas
// (`{ "job.title": "Dev" }`). Tokens sem valor resolvem para string vazia.

/** Regex canônica de token. Use sempre com `new RegExp` ou recrie por chamada. */
export const TOKEN_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g;

export type TokenContext = {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  company?: string | null;
  /** Remetente (usuário logado), usado por {{agent.name}} / {{agent.email}}. */
  agent?: { name?: string | null; email?: string | null } | null;
  /** Chaves extras específicas do contexto (ticket, macro, candidato, etc.). */
  [key: string]: unknown;
};

/** Lê `a.b.c` em objetos aninhados; retorna undefined quando não existir. */
export function getPath(ctx: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, ctx);
}

/**
 * Base compartilhada: substitui cada `{{chave}}` pelo resultado de `resolve`.
 * Permite que superfícies com semântica própria (ex.: workflows, com
 * `{{vars.X}}` e `{{steps.N.campo}}`) reaproveitem o mesmo parser.
 */
export function renderTokensWith(input: string, resolve: (key: string) => string): string {
  if (!input) return input;
  return input.replace(new RegExp(TOKEN_PATTERN.source, "g"), (_m, key: string) =>
    resolve(String(key)),
  );
}

/** Substituição padrão a partir de um contexto de objeto. */
export function renderTokens(input: string, ctx: TokenContext): string {
  return renderTokensWith(input, (key) => {
    const lower = key.toLowerCase();
    const direct = (ctx as Record<string, unknown>)[lower];
    const value = direct !== undefined ? direct : getPath(ctx, lower);
    return value == null ? "" : String(value);
  });
}

/** Expande atalhos de snippet escritos como /atalho (delimitados por palavra). */
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
