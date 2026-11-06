/**
 * Rodízio de modelos (templates) em campanhas de WhatsApp.
 * Regra pura: o modelo principal da campanha + até 4 adicionais.
 * O modelo escolhido é fixado no destinatário no primeiro envio.
 */
export const MAX_ROTATION_TEMPLATES = 5;

export type RotationMode = "sequential" | "weighted";

export type RotationTemplate = {
  name: string;
  language: string | null;
  body: string | null;
  variableCount: number;
  weight: number;
};

/** Junta o principal com os adicionais, sem duplicar nomes, limitado a 5. */
export function buildRotation(
  primary: {
    name: string | null;
    language: string | null;
    body: string | null;
    variableCount?: number;
  },
  extras: unknown,
): RotationTemplate[] {
  const out: RotationTemplate[] = [];
  const seen = new Set<string>();
  const push = (t: Partial<RotationTemplate> | null | undefined) => {
    const name = typeof t?.name === "string" ? t.name.trim() : "";
    if (!name || seen.has(name) || out.length >= MAX_ROTATION_TEMPLATES) return;
    seen.add(name);
    const w = Number(t?.weight);
    out.push({
      name,
      language: t?.language ?? null,
      body: t?.body ?? null,
      variableCount: Math.max(0, Math.floor(Number(t?.variableCount) || 0)),
      weight: Number.isFinite(w) && w > 0 ? w : 1,
    });
  };
  if (primary.name) push({ ...primary, name: primary.name });
  if (Array.isArray(extras)) for (const e of extras) push(e as Partial<RotationTemplate>);
  // peso do principal pode vir na lista de adicionais com o mesmo nome? não: mantém 1 se ausente.
  const primaryExtra = Array.isArray(extras)
    ? (extras as Partial<RotationTemplate>[]).find((e) => e?.name === primary.name)
    : undefined;
  if (out[0] && primaryExtra && Number(primaryExtra.weight) > 0)
    out[0].weight = Number(primaryExtra.weight);
  return out;
}

/**
 * Escolhe o modelo do destinatário.
 * - Se já houver modelo fixado e ele ainda estiver no rodízio, mantém.
 * - Sequencial: posição `seq % n`.
 * - Peso: sorteio proporcional usando `rand` em [0,1).
 */
export function pickTemplate(
  list: RotationTemplate[],
  mode: RotationMode,
  seq: number,
  rand: number,
  fixed?: string | null,
): RotationTemplate | null {
  if (list.length === 0) return null;
  if (fixed) {
    const hit = list.find((t) => t.name === fixed);
    if (hit) return hit;
  }
  if (list.length === 1) return list[0];
  if (mode === "weighted") {
    const total = list.reduce((s, t) => s + t.weight, 0);
    let x = Math.min(Math.max(rand, 0), 0.999999) * total;
    for (const t of list) {
      if (x < t.weight) return t;
      x -= t.weight;
    }
    return list[list.length - 1];
  }
  const i = ((Math.floor(seq) % list.length) + list.length) % list.length;
  return list[i];
}

/** Maior quantidade de variáveis entre os modelos: o público precisa mapear todas. */
export function maxVariableCount(list: RotationTemplate[]): number {
  return list.reduce((m, t) => Math.max(m, t.variableCount), 0);
}

/** Variáveis posicionais {{1}}..{{n}} do modelo escolhido. */
export function positionalVariables(variableCount: number, vars: Record<string, string>): string[] {
  return Array.from({ length: variableCount }, (_, i) => vars[String(i + 1)] ?? "");
}
