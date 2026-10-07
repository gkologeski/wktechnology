/**
 * Esquema único de formulário de pesquisa (construtor, renderer público,
 * timeline e servidor). Puro TypeScript, sem dependências de UI.
 *
 * Semântica de pontuação:
 * - Só conta pergunta com `scored: true` E pesquisa com `scoringEnabled`.
 * - Pergunta pontuada oculta por condição: fica fora da soma e do máximo.
 * - Pergunta pontuada visível e sem resposta: entra no máximo, soma 0.
 * - Sem nenhuma pergunta pontuada elegível: score = null (não é zero/reprovação).
 */

export type FieldType =
  | "short_text"
  | "long_text"
  | "number"
  | "currency"
  | "email"
  | "phone"
  | "url"
  | "date"
  | "datetime"
  | "single_choice"
  | "multi_choice"
  | "dropdown"
  | "boolean"
  | "linear_scale"
  | "rating"
  | "nps"
  | "matrix"
  | "file"
  | "heading"
  | "paragraph"
  | "page_break";

export type Option = { id: string; label: string; points?: number | null };
export type Rule = { fieldId: string; op: ConditionOp; value?: string };
export type ConditionOp =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "filled"
  | "empty"
  | "gt"
  | "lt";
export type Condition = { mode: "all" | "any"; rules: Rule[] };

export type FormField = {
  id: string;
  type: FieldType;
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  /** Pontuação independente de obrigatoriedade e tipo. */
  scored?: boolean;
  weight?: number;
  options?: Option[];
  /** Matriz: linhas (perguntas) e colunas (opções). */
  rows?: Option[];
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
  maxLength?: number;
  stars?: number;
  width?: "full" | "half";
  /** Mostrar somente quando a condição for verdadeira. */
  showIf?: Condition | null;
  /** Origem na importação (página/trecho/confiança), só informativa. */
  source?: { page?: number; excerpt?: string; confidence?: "alta" | "baixa" };
};

export type FormSchema = {
  version: 1;
  title: string;
  description?: string;
  scoringEnabled: boolean;
  fields: FormField[];
};

export const FIELD_LIBRARY: { type: FieldType; label: string; group: string }[] = [
  { type: "short_text", label: "Texto curto", group: "Básicos" },
  { type: "long_text", label: "Texto longo", group: "Básicos" },
  { type: "number", label: "Número", group: "Básicos" },
  { type: "currency", label: "Moeda", group: "Básicos" },
  { type: "email", label: "E-mail", group: "Contato" },
  { type: "phone", label: "Telefone", group: "Contato" },
  { type: "url", label: "URL", group: "Contato" },
  { type: "date", label: "Data", group: "Data" },
  { type: "datetime", label: "Data e hora", group: "Data" },
  { type: "single_choice", label: "Escolha única", group: "Escolha" },
  { type: "multi_choice", label: "Múltipla escolha", group: "Escolha" },
  { type: "dropdown", label: "Lista suspensa", group: "Escolha" },
  { type: "boolean", label: "Sim/Não", group: "Escolha" },
  { type: "linear_scale", label: "Escala linear", group: "Avaliação" },
  { type: "rating", label: "Estrelas", group: "Avaliação" },
  { type: "nps", label: "NPS (0–10)", group: "Avaliação" },
  { type: "matrix", label: "Matriz / Likert", group: "Avaliação" },
  { type: "file", label: "Upload de arquivo", group: "Avançados" },
  { type: "heading", label: "Título de seção", group: "Layout" },
  { type: "paragraph", label: "Descrição", group: "Layout" },
  { type: "page_break", label: "Nova página", group: "Layout" },
];
export const FIELD_LABEL = Object.fromEntries(
  FIELD_LIBRARY.map((f) => [f.type, f.label]),
) as Record<FieldType, string>;

export const LAYOUT_TYPES: FieldType[] = ["heading", "paragraph", "page_break"];
export const CHOICE_TYPES: FieldType[] = ["single_choice", "multi_choice", "dropdown"];
/** Tipos que aceitam pontuação. Texto/arquivo/layout não pontuam. */
export const SCORABLE_TYPES: FieldType[] = [
  "single_choice",
  "multi_choice",
  "dropdown",
  "boolean",
  "linear_scale",
  "rating",
  "nps",
  "number",
];
export const isInput = (t: FieldType) => !LAYOUT_TYPES.includes(t);
export const isScorable = (t: FieldType) => SCORABLE_TYPES.includes(t);

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function newField(type: FieldType): FormField {
  const base: FormField = {
    id: uid(),
    type,
    label: FIELD_LABEL[type],
    required: false,
    scored: false,
  };
  if (CHOICE_TYPES.includes(type))
    base.options = ["Opção 1", "Opção 2"].map((label) => ({ id: uid(), label }));
  if (type === "linear_scale") Object.assign(base, { min: 1, max: 5 });
  if (type === "rating") base.stars = 5;
  if (type === "matrix") {
    base.rows = ["Linha 1", "Linha 2"].map((label) => ({ id: uid(), label }));
    base.options = ["Discordo", "Neutro", "Concordo"].map((label) => ({ id: uid(), label }));
  }
  if (type === "heading") base.label = "Nova seção";
  if (type === "paragraph") base.label = "Texto explicativo";
  if (type === "page_break") base.label = "Página";
  return base;
}

export function emptySchema(title = "Nova pesquisa"): FormSchema {
  return { version: 1, title, scoringEnabled: false, fields: [newField("short_text")] };
}

export type Answers = Record<string, unknown>;

export function isFilled(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "object") return Object.values(v as object).some(isFilled);
  return true;
}

const str = (v: unknown) =>
  Array.isArray(v) ? v.map(String).join(" ") : v == null ? "" : String(v);
function test(rule: Rule, answers: Answers): boolean {
  const v = answers[rule.fieldId];
  const a = str(v).toLowerCase();
  const b = (rule.value ?? "").toLowerCase();
  switch (rule.op) {
    case "equals":
      return Array.isArray(v) ? v.map((x) => String(x).toLowerCase()).includes(b) : a === b;
    case "not_equals":
      return Array.isArray(v) ? !v.map((x) => String(x).toLowerCase()).includes(b) : a !== b;
    case "contains":
      return a.includes(b);
    case "not_contains":
      return !a.includes(b);
    case "filled":
      return isFilled(v);
    case "empty":
      return !isFilled(v);
    case "gt":
      return Number(v) > Number(rule.value);
    case "lt":
      return Number(v) < Number(rule.value);
  }
}

/** Ids visíveis, avaliando condições em ordem (campo oculto não ativa condições). */
export function visibleFieldIds(schema: FormSchema, answers: Answers): Set<string> {
  const visible = new Set<string>();
  let pageHidden = false;
  for (const f of schema.fields) {
    const rulesOk = (c: Condition) => {
      const valid = c.rules.filter((r) => visible.has(r.fieldId));
      if (!c.rules.length) return true;
      if (valid.length !== c.rules.length && c.mode === "all") return false;
      const res = valid.map((r) => test(r, answers));
      return c.mode === "all" ? res.every(Boolean) : res.some(Boolean);
    };
    const own = !f.showIf || rulesOk(f.showIf);
    if (f.type === "page_break") pageHidden = !own; // pular página inteira
    if (own && !(pageHidden && f.type !== "page_break")) visible.add(f.id);
  }
  return visible;
}

/** Divide em páginas (pela quebra de página). */
export function pages(schema: FormSchema): FormField[][] {
  const out: FormField[][] = [[]];
  for (const f of schema.fields) {
    if (f.type === "page_break") out.push([f]);
    else out[out.length - 1]!.push(f);
  }
  return out.filter((p, i) => p.length || i === 0);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validateAnswers(schema: FormSchema, answers: Answers): Record<string, string> {
  const errors: Record<string, string> = {};
  const vis = visibleFieldIds(schema, answers);
  for (const f of schema.fields) {
    if (!isInput(f.type) || !vis.has(f.id)) continue; // oculto obrigatório não bloqueia
    const v = answers[f.id];
    if (!isFilled(v)) {
      if (f.required) errors[f.id] = "Resposta obrigatória.";
      continue;
    }
    if (f.type === "matrix" && f.required) {
      const m = (v ?? {}) as Record<string, unknown>;
      if ((f.rows ?? []).some((r) => !isFilled(m[r.id])))
        errors[f.id] = "Responda todas as linhas.";
    }
    if (f.type === "email" && !EMAIL.test(String(v))) errors[f.id] = "E-mail inválido.";
    if (f.type === "url" && !/^https?:\/\/\S+\.\S+/.test(String(v))) errors[f.id] = "URL inválida.";
    if (["number", "currency"].includes(f.type)) {
      const n = Number(v);
      if (!Number.isFinite(n)) errors[f.id] = "Número inválido.";
      else if (f.min != null && n < f.min) errors[f.id] = `Mínimo ${f.min}.`;
      else if (f.max != null && n > f.max) errors[f.id] = `Máximo ${f.max}.`;
    }
    if (f.maxLength && typeof v === "string" && v.length > f.maxLength)
      errors[f.id] = `Até ${f.maxLength} caracteres.`;
    if (CHOICE_TYPES.includes(f.type)) {
      const labels = new Set((f.options ?? []).map((o) => o.label));
      const vals = Array.isArray(v) ? v : [v];
      if (vals.some((x) => !labels.has(String(x)))) errors[f.id] = "Opção inválida.";
    }
  }
  return errors;
}

/** Pontos máximos de um campo pontuado. */
function fieldMax(f: FormField): number {
  const w = Number.isFinite(f.weight) ? Number(f.weight) : 1;
  const pts = (f.options ?? []).map((o) => Number(o.points ?? 0)).filter(Number.isFinite);
  switch (f.type) {
    case "single_choice":
    case "dropdown":
      return Math.max(0, ...pts) * w;
    case "multi_choice":
      return pts.filter((p) => p > 0).reduce((a, b) => a + b, 0) * w;
    case "boolean":
      return w;
    case "linear_scale":
      return (f.max ?? 5) * w;
    case "rating":
      return (f.stars ?? 5) * w;
    case "nps":
      return 10 * w;
    case "number":
      return (f.max ?? 0) * w;
    default:
      return 0;
  }
}
function fieldPoints(f: FormField, v: unknown): number {
  if (!isFilled(v)) return 0;
  const w = Number.isFinite(f.weight) ? Number(f.weight) : 1;
  const byLabel = new Map((f.options ?? []).map((o) => [o.label, Number(o.points ?? 0)]));
  switch (f.type) {
    case "single_choice":
    case "dropdown":
      return (byLabel.get(String(v)) ?? 0) * w;
    case "multi_choice":
      return (
        (Array.isArray(v) ? v : []).reduce<number>((a, x) => a + (byLabel.get(String(x)) ?? 0), 0) *
        w
      );
    case "boolean":
      return (v === true ? 1 : 0) * w;
    case "linear_scale":
    case "rating":
    case "nps":
    case "number": {
      const n = Number(v);
      const cap = fieldMax(f) / (w || 1);
      return Number.isFinite(n) ? Math.min(Math.max(n, 0), cap || n) * w : 0;
    }
    default:
      return 0;
  }
}

export type ScoreResult = {
  score: number | null;
  max: number | null;
  percent: number | null;
  scoredCount: number;
};
export function scoreAnswers(schema: FormSchema, answers: Answers): ScoreResult {
  if (!schema.scoringEnabled) return { score: null, max: null, percent: null, scoredCount: 0 };
  const vis = visibleFieldIds(schema, answers);
  const eligible = schema.fields.filter((f) => f.scored && isScorable(f.type) && vis.has(f.id));
  if (!eligible.length) return { score: null, max: null, percent: null, scoredCount: 0 };
  const score = eligible.reduce((a, f) => a + fieldPoints(f, answers[f.id]), 0);
  const max = eligible.reduce((a, f) => a + fieldMax(f), 0);
  return {
    score: Math.round(score * 100) / 100,
    max: max > 0 ? Math.round(max * 100) / 100 : null,
    percent: max > 0 ? Math.round((score / max) * 100) : null,
    scoredCount: eligible.length,
  };
}

/** Problemas de configuração (referências apagadas, ciclos/ordem, opções). */
export function validateSchema(schema: FormSchema): string[] {
  const issues: string[] = [];
  const index = new Map(schema.fields.map((f, i) => [f.id, i]));
  if (!schema.title.trim()) issues.push("A pesquisa precisa de um título.");
  if (!schema.fields.some((f) => isInput(f.type))) issues.push("Adicione pelo menos uma pergunta.");
  schema.fields.forEach((f, i) => {
    const name = f.label || FIELD_LABEL[f.type];
    if (isInput(f.type) && !f.label.trim()) issues.push(`Pergunta ${i + 1} sem enunciado.`);
    if (CHOICE_TYPES.includes(f.type) || f.type === "matrix") {
      const labels = (f.options ?? []).map((o) => o.label.trim());
      if (labels.length < 1 || labels.some((l) => !l)) issues.push(`${name}: opções vazias.`);
      if (new Set(labels).size !== labels.length) issues.push(`${name}: opções repetidas.`);
    }
    if (f.type === "linear_scale" && (f.min ?? 1) >= (f.max ?? 5))
      issues.push(`${name}: escala inválida.`);
    for (const r of f.showIf?.rules ?? []) {
      const j = index.get(r.fieldId);
      if (j === undefined) issues.push(`${name}: condição aponta para campo excluído.`);
      else if (j >= i)
        issues.push(`${name}: condição só pode usar campos anteriores (evita ciclos).`);
    }
  });
  return issues;
}

/** Converte linhas legadas (survey_template_questions) em esquema. */
export function schemaFromLegacy(
  title: string,
  rows: {
    id: string;
    field_key?: string | null;
    label: string;
    help_text?: string | null;
    type: string;
    options?: unknown;
    settings?: unknown;
    required?: boolean | null;
    scored?: boolean | null;
    weight?: number | null;
    conditions?: unknown;
  }[],
  scoringEnabled = false,
): FormSchema {
  const map: Record<string, FieldType> = {
    single: "single_choice",
    multi: "multi_choice",
    text: "long_text",
  };
  return {
    version: 1,
    title,
    scoringEnabled,
    fields: rows.map((r) => {
      const s = (r.settings ?? {}) as Record<string, unknown>;
      const opts = Array.isArray(r.options) ? r.options : [];
      return {
        id: r.field_key || r.id,
        type: (map[r.type] ?? r.type) as FieldType,
        label: r.label,
        description: r.help_text ?? undefined,
        placeholder: typeof s.placeholder === "string" ? s.placeholder : undefined,
        required: !!r.required,
        scored: !!r.scored,
        weight: r.weight ?? 1,
        options: opts.map((o, i) =>
          typeof o === "string"
            ? { id: `${r.id}-${i}`, label: o }
            : {
                id: (o as Option).id ?? `${r.id}-${i}`,
                label: String((o as Option).label),
                points: (o as Option).points ?? null,
              },
        ),
        min: typeof s.min === "number" ? s.min : undefined,
        max: typeof s.max === "number" ? s.max : undefined,
        minLabel: typeof s.min_label === "string" ? s.min_label : undefined,
        maxLabel: typeof s.max_label === "string" ? s.max_label : undefined,
        stars: typeof s.stars === "number" ? s.stars : undefined,
        showIf: (r.conditions as Condition | null) ?? null,
      };
    }),
  };
}
