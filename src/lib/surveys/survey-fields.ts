/**
 * Catálogo de tipos de campo de formulário de pesquisa.
 *
 * Padronizado com base nas ferramentas de pesquisa de mercado
 * (Typeform / SurveyMonkey / Qualtrics), com rótulos em português.
 * Compartilhado entre servidor (validação) e navegador (renderização).
 */

export const SURVEY_FIELD_TYPES = [
  { value: "short_text", label: "Texto curto" },
  { value: "long_text", label: "Texto longo" },
  { value: "single_choice", label: "Escolha única" },
  { value: "multi_choice", label: "Múltipla escolha" },
  { value: "dropdown", label: "Lista (select)" },
  { value: "linear_scale", label: "Escala linear" },
  { value: "nps", label: "NPS (0–10)" },
  { value: "rating", label: "Avaliação por estrelas" },
  { value: "boolean", label: "Sim/Não" },
  { value: "number", label: "Número" },
  { value: "currency", label: "Moeda" },
  { value: "date", label: "Data" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
] as const;

export type SurveyFieldType = (typeof SURVEY_FIELD_TYPES)[number]["value"];

export const SURVEY_FIELD_LABELS: Record<SurveyFieldType, string> = Object.fromEntries(
  SURVEY_FIELD_TYPES.map((t) => [t.value, t.label]),
) as Record<SurveyFieldType, string>;

export function isChoiceField(type: string): boolean {
  return type === "single_choice" || type === "multi_choice" || type === "dropdown";
}

export type SurveyFieldSettings = {
  /** Escala linear: início (padrão 1) e fim (padrão 5). */
  min?: number | null;
  max?: number | null;
  min_label?: string | null;
  max_label?: string | null;
  /** Avaliação por estrelas: quantidade (padrão 5). */
  stars?: number | null;
  placeholder?: string | null;
};

export type SurveyQuestion = {
  id: string;
  label: string;
  help_text?: string | null;
  type: string;
  options?: unknown;
  settings?: unknown;
  required?: boolean | null;
  position?: number | null;
};

/** Normaliza `options` (aceita `["a"]` ou `[{ label, points }]`). */
export function questionOptions(q: SurveyQuestion): Array<{ label: string; points?: number }> {
  const raw = q.options;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => {
      if (typeof o === "string") return { label: o };
      if (o && typeof o === "object" && "label" in o) {
        const rec = o as { label?: unknown; points?: unknown };
        if (typeof rec.label !== "string") return null;
        return {
          label: rec.label,
          points: typeof rec.points === "number" ? rec.points : undefined,
        };
      }
      return null;
    })
    .filter(Boolean) as Array<{ label: string; points?: number }>;
}

export function questionSettings(q: SurveyQuestion): SurveyFieldSettings {
  const s = q.settings;
  return s && typeof s === "object" ? (s as SurveyFieldSettings) : {};
}

export function scaleRange(q: SurveyQuestion): { min: number; max: number } {
  const s = questionSettings(q);
  if (q.type === "nps") return { min: 0, max: 10 };
  const min = Number.isFinite(Number(s.min)) ? Number(s.min) : 1;
  const max = Number.isFinite(Number(s.max)) && Number(s.max) > min ? Number(s.max) : 5;
  return { min, max };
}

export function starCount(q: SurveyQuestion): number {
  const n = Number(questionSettings(q).stars ?? 5);
  return Number.isFinite(n) && n >= 3 && n <= 10 ? n : 5;
}

/** Resposta considerada preenchida (para checagem de obrigatoriedade). */
export function isAnswered(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return true;
}

/** Texto legível de uma resposta, para exibir na timeline. */
export function formatAnswer(q: SurveyQuestion, value: unknown): string {
  if (!isAnswered(value)) return "—";
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (q.type === "currency" && typeof value === "number") {
    try {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
    } catch {
      return String(value);
    }
  }
  if (q.type === "nps" || q.type === "linear_scale") {
    const { max } = scaleRange(q);
    return `${value}/${max}`;
  }
  if (q.type === "rating") return `${value}/${starCount(q)}`;
  if (q.type === "date" && typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("pt-BR");
  }
  return String(value);
}

/** Faixa do NPS para exibição. */
export function npsBand(score: number): "detrator" | "neutro" | "promotor" {
  if (score <= 6) return "detrator";
  if (score <= 8) return "neutro";
  return "promotor";
}
