// Filtros declarativos aplicados no cliente sobre as linhas já carregadas.
// Usados pelo painel lateral de filtros dos grids que não usam EntityList.

export type GridFilterOption = { value: string; label: string };

export type GridFilterField<T> = {
  key: string;
  label: string;
  type: "multi" | "date" | "number" | "owner";
  /** Valor da linha usado na comparação (datas ISO; números; código da opção; uuid do responsável). */
  get: (row: T) => string | number | null | undefined;
  /** Opções fixas (multi). Sem elas, as opções são geradas a partir das linhas. */
  options?: GridFilterOption[];
  /** Rótulo de um valor quando as opções são geradas a partir das linhas. */
  optionLabel?: (value: string, row: T) => string;
  /** Multi com busca digitável e seleção em pills (ex.: Empresa). */
  searchable?: boolean;
};

export type GridFilterValue =
  | { kind: "in"; values: string[] }
  | { kind: "range"; from?: string; to?: string }
  | { kind: "owner"; ownerIds: string[]; includeUnassigned: boolean };

export type GridFilterState = Record<string, GridFilterValue>;

export function isActive(v: GridFilterValue | undefined): boolean {
  if (!v) return false;
  if (v.kind === "in") return v.values.length > 0;
  if (v.kind === "owner") return v.ownerIds.length > 0 || v.includeUnassigned;
  return Boolean(v.from || v.to);
}

export function activeCount(state: GridFilterState): number {
  return Object.values(state).filter(isActive).length;
}

function matches<T>(row: T, field: GridFilterField<T>, v: GridFilterValue): boolean {
  const raw = field.get(row);
  if (v.kind === "in") return raw != null && v.values.includes(String(raw));
  if (v.kind === "owner") {
    if (raw == null || raw === "") return v.includeUnassigned;
    return v.ownerIds.includes(String(raw));
  }
  if (raw == null || raw === "") return false;
  if (field.type === "number") {
    const n = Number(raw);
    if (Number.isNaN(n)) return false;
    if (v.from && n < Number(v.from)) return false;
    if (v.to && n > Number(v.to)) return false;
    return true;
  }
  // Datas: compara pelo dia (yyyy-mm-dd), inclusivo nas duas pontas.
  const day = String(raw).slice(0, 10);
  if (v.from && day < v.from) return false;
  if (v.to && day > v.to) return false;
  return true;
}

export function applyGridFilters<T>(
  rows: readonly T[],
  fields: readonly GridFilterField<T>[],
  state: GridFilterState,
): T[] {
  const active = fields.filter((f) => isActive(state[f.key]));
  if (active.length === 0) return rows as T[];
  return rows.filter((row) => active.every((f) => matches(row, f, state[f.key]!)));
}

/** Opções de um campo "multi": as fixas ou as distintas presentes nas linhas. */
export function fieldOptions<T>(field: GridFilterField<T>, rows: readonly T[]): GridFilterOption[] {
  if (field.options) return field.options;
  const seen = new Map<string, string>();
  for (const row of rows) {
    const raw = field.get(row);
    if (raw == null || raw === "") continue;
    const value = String(raw);
    if (!seen.has(value)) seen.set(value, field.optionLabel?.(value, row) ?? value);
  }
  return [...seen.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

function fmtDay(iso: string) {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

/** Texto curto da etiqueta de um filtro aplicado. */
export function chipText<T>(
  field: GridFilterField<T>,
  v: GridFilterValue,
  rows: readonly T[],
  ownerName?: (id: string) => string,
): string {
  if (v.kind === "in") {
    const opts = fieldOptions(field, rows);
    const labels = v.values.map((x) => opts.find((o) => o.value === x)?.label ?? x);
    return `${field.label}: ${labels.join(", ")}`;
  }
  if (v.kind === "owner") {
    const names = v.ownerIds.map((id) => ownerName?.(id) ?? "Usuário");
    if (v.includeUnassigned) names.push("Sem responsável");
    return `${field.label}: ${names.join(", ")}`;
  }
  const f = field.type === "date" ? fmtDay : (x: string) => x;
  if (v.from && v.to) return `${field.label}: ${f(v.from)} – ${f(v.to)}`;
  if (v.from) return `${field.label}: a partir de ${f(v.from)}`;
  return `${field.label}: até ${f(v.to!)}`;
}

/** Descarta chaves desconhecidas/malformadas vindas de uma visão salva. */
export function sanitizeState<T>(
  raw: unknown,
  fields: readonly GridFilterField<T>[],
): GridFilterState {
  const out: GridFilterState = {};
  if (!raw || typeof raw !== "object") return out;
  for (const f of fields) {
    const v = (raw as Record<string, unknown>)[f.key] as GridFilterValue | undefined;
    if (!v || typeof v !== "object") continue;
    if (v.kind === "in" && Array.isArray(v.values))
      out[f.key] = { kind: "in", values: v.values.map(String) };
    else if (v.kind === "owner" && Array.isArray(v.ownerIds))
      out[f.key] = {
        kind: "owner",
        ownerIds: v.ownerIds.map(String),
        includeUnassigned: Boolean(v.includeUnassigned),
      };
    else if (v.kind === "range")
      out[f.key] = {
        kind: "range",
        from: v.from ? String(v.from) : undefined,
        to: v.to ? String(v.to) : undefined,
      };
  }
  return out;
}
