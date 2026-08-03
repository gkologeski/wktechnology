// Catálogo dinâmico de variáveis ({{tokens}}) do construtor de workflows.
//
// O motor (`src/lib/workflows/engine.server.ts`) resolve `{{coluna}}` lendo a
// coluna da entidade do gatilho, além de `{{vars.X}}` e `{{steps.N.campo}}`.
// Por isso as pills exibidas na interface precisam ser derivadas do catálogo
// real de campos da entidade — uma lista fixa não tem relação com o gatilho.

import type { MessageToken } from "@/lib/message-tokens-catalog";

export type TokenFieldOpt = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "boolean";
  ref?: string;
  system?: boolean;
};

const GROUP_RECORD = "Registro";
const GROUP_REFS = "Identificadores (ID)";
const GROUP_STEPS = "Passos anteriores";
const GROUP_VARS = "Variáveis do fluxo";

/**
 * Tokens `{{vars.X}}` criados por passos "Formatar dados" (target_var).
 * O motor resolve estas chaves a partir do contexto do run.
 */
export function buildVarTokens(varNames: string[]): MessageToken[] {
  const seen = new Set<string>();
  const out: MessageToken[] = [];
  for (const name of varNames) {
    const key = name.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ token: `{{vars.${key}}}`, label: key, group: GROUP_VARS });
  }
  return out;
}

/** Campos que nunca ajudam como variável de texto. */
const SKIP = new Set(["id", "owner_id", "workspace_id", "created_at", "updated_at"]);

/**
 * Tokens de texto: colunas simples da entidade do gatilho + saídas de passos
 * anteriores. Campos de referência ficam de fora (o valor é um UUID).
 */
export function buildTextTokens(
  entityFields: TokenFieldOpt[],
  priorFields: TokenFieldOpt[] = [],
): MessageToken[] {
  const out: MessageToken[] = [];
  for (const f of entityFields) {
    if (f.ref || f.system || SKIP.has(f.name)) continue;
    if (f.name.endsWith("_id")) continue;
    out.push({ token: `{{${f.name}}}`, label: f.label, group: GROUP_RECORD });
  }
  for (const f of priorFields) {
    out.push({ token: `{{${f.name}}}`, label: f.label, group: GROUP_STEPS });
  }
  return out;
}

/**
 * Tokens cujo valor resolvido é um ID — os únicos válidos em campos de
 * referência (empresa, negócio, contrato, usuário, contato…).
 */
export function buildIdTokens(
  entityFields: TokenFieldOpt[],
  priorFields: TokenFieldOpt[] = [],
): MessageToken[] {
  const out: MessageToken[] = [
    { token: "{{id}}", label: "ID do registro do gatilho", group: GROUP_REFS },
  ];
  for (const f of entityFields) {
    if (!f.ref && !f.name.endsWith("_id")) continue;
    if (f.name === "id" || SKIP.has(f.name)) continue;
    out.push({ token: `{{${f.name}}}`, label: f.label, group: GROUP_REFS });
  }
  for (const f of priorFields) {
    if (!f.name.endsWith(".id") && !f.name.endsWith("_id")) continue;
    out.push({ token: `{{${f.name}}}`, label: f.label, group: GROUP_STEPS });
  }
  return out;
}
