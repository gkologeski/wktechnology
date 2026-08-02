// Renderização de tokens do motor de workflows. Mantido puro (sem I/O) para
// permitir teste unitário; a semântica extra do workflow é:
//   {{coluna}}          → campo da entidade do gatilho (`after`)
//   {{vars.X}}          → variável do fluxo
//   {{steps.N.campo}}   → saída registrada de um passo anterior
import { getPath, renderTokensWith } from "@/lib/message-tokens";

type AnyRow = Record<string, unknown>;

export function toStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

export function renderWorkflowTokens(
  input: unknown,
  after: AnyRow | null,
  vars?: AnyRow,
): unknown {
  if (typeof input !== "string") return input;
  return renderTokensWith(input, (path) => {
    if (path.startsWith("vars.")) return toStr(getPath(vars ?? null, path.slice(5)));
    if (path.startsWith("steps.")) return toStr(getPath(vars ?? null, path));
    return toStr(getPath(after, path));
  });
}
