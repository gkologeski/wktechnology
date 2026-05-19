// Token replacement for email templates and snippets
// Tokens: {{first_name}} {{last_name}} {{full_name}} {{email}} {{company}}

export type TokenContext = {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  company?: string | null;
};

export function renderTokens(input: string, ctx: TokenContext): string {
  if (!input) return input;
  return input.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key: string) => {
    const v = (ctx as Record<string, string | null | undefined>)[key.toLowerCase()];
    return v == null ? "" : String(v);
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
