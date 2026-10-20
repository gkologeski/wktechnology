// Regras puras de agregação do painel de campanhas (testáveis sem banco).
import type { BlockReason, Coverage, FunnelStep } from "./campaign-funnel.types";

/** Classifica o motivo de um destinatário não enviado/falho. */
export function classifyBlock(status: string, error: string | null): string {
  const e = (error ?? "").toLowerCase();
  if (status === "unsubscribed" || e.includes("descadastr") || e.includes("opt-out"))
    return "unsubscribed";
  if (e.includes("recent")) return "recent";
  if (e.includes("cliente") || e.includes("negocia")) return "commercial";
  if (e.includes("celular") || e.includes("fixo") || e.includes("inválid") || e.includes("invalid"))
    return "invalid";
  if (status === "failed") return "failed";
  return "other";
}

const BLOCK_LABELS: Record<string, string> = {
  failed: "Falha de envio",
  invalid: "Número inválido ou fixo",
  unsubscribed: "Descadastro",
  recent: "Contato recente",
  commercial: "Cliente ou negociação aberta",
  other: "Outros",
};

export function summarizeBlocks(rows: { status: string; error: string | null }[]): BlockReason[] {
  const acc = new Map<string, number>();
  for (const r of rows) {
    const k = classifyBlock(r.status, r.error);
    acc.set(k, (acc.get(k) ?? 0) + 1);
  }
  return Object.keys(BLOCK_LABELS)
    .filter((k) => acc.has(k))
    .map((k) => ({ key: k, label: BLOCK_LABELS[k]!, value: acc.get(k)! }));
}

/** Conversão da etapa em relação à anterior; `null` quando não calculável. */
export function stepConversion(prev: number | null, cur: number | null): number | null {
  if (prev == null || cur == null || prev <= 0) return null;
  return Math.round((cur / prev) * 1000) / 10;
}

export function step(
  key: string,
  label: string,
  value: number | null,
  coverage?: Coverage,
): FunnelStep {
  return { key, label, value, coverage: coverage ?? (value == null ? "none" : "ok") };
}

/** Soma etapas de canais; se algum canal não rastreia, o total fica parcial. */
export function mergeSteps(a: FunnelStep[], b: FunnelStep[]): FunnelStep[] {
  return a.map((s, i) => {
    const o = b[i]!;
    if (s.value == null && o.value == null) return { ...s, coverage: "none" };
    const value = (s.value ?? 0) + (o.value ?? 0);
    const coverage: Coverage =
      s.value == null || o.value == null || s.coverage !== "ok" || o.coverage !== "ok"
        ? "partial"
        : "ok";
    return { ...s, value, coverage };
  });
}
