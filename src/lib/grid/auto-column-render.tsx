// Renderizadores genéricos para colunas de grid geradas a partir do catálogo
// dinâmico de campos da entidade (`get_entity_field_catalog`).
// Mantido fora de `*.functions.ts` para não ser removido pelo code-splitting.
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { EntityFieldDef } from "@/lib/entity-fields.functions";
import { formatMoney, resolveCurrency } from "@/lib/format/money-fields";
import { translateFieldValue } from "@/lib/i18n/hubspot-values";

const EMPTY = <span className="text-muted-foreground">—</span>;

export function isEmptyValue(v: unknown): boolean {
  return v == null || v === "" || (Array.isArray(v) && v.length === 0);
}

function formatDateValue(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const hasTime = /\d{2}:\d{2}/.test(raw);
  return hasTime
    ? d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : d.toLocaleDateString("pt-BR");
}

function truncate(s: string, max = 80): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * Renderiza o valor de um campo do catálogo.
 * `refLabel` resolve IDs de referência (usuário, empresa, contato, etc.) para nomes.
 */
export function renderAutoCell(
  field: EntityFieldDef,
  row: Record<string, unknown>,
  refLabel?: (kind: NonNullable<EntityFieldDef["ref"]>, id: string) => string | null,
): ReactNode {
  const v = row[field.name];
  if (isEmptyValue(v)) return EMPTY;

  if (field.ref) {
    const id = String(v);
    const label = refLabel?.(field.ref, id) ?? null;
    return <span className="truncate">{label || EMPTY}</span>;
  }

  if (typeof v === "boolean") return v ? "Sim" : "Não";

  if (field.type === "date" && typeof v === "string") {
    return <span className="whitespace-nowrap">{formatDateValue(v)}</span>;
  }

  if (field.type === "currency" && (typeof v === "number" || typeof v === "string")) {
    const formatted = formatMoney(v, resolveCurrency(row));
    return <span className="whitespace-nowrap">{formatted ?? String(v)}</span>;
  }

  if (field.type === "number" && (typeof v === "number" || typeof v === "string")) {
    const n = typeof v === "number" ? v : Number(v);
    return (
      <span className="whitespace-nowrap tabular-nums">
        {Number.isFinite(n) ? n.toLocaleString("pt-BR") : String(v)}
      </span>
    );
  }

  if (Array.isArray(v)) {
    const items = v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x)));
    return <span className="truncate">{truncate(items.join(", "))}</span>;
  }

  if (field.type === "select" && typeof v === "string") {
    const fromOptions = field.options?.find((o) => o.value === v)?.label;
    const label = fromOptions || translateFieldValue(field.name, v) || v;
    return (
      <Badge variant="secondary" className="font-normal">
        {label}
      </Badge>
    );
  }

  if (typeof v === "object") {
    return <span className="truncate text-muted-foreground">{truncate(JSON.stringify(v))}</span>;
  }

  const text = String(v);
  if (/^https?:\/\//.test(text)) {
    return (
      <a
        href={text}
        target="_blank"
        rel="noreferrer noopener"
        className="truncate text-primary hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {truncate(text, 40)}
      </a>
    );
  }
  return <span className="truncate">{truncate(text)}</span>;
}

/** Tipos ordenáveis no servidor (JSON/array ficam de fora). */
export function isSortableField(field: EntityFieldDef): boolean {
  return field.type === "text" || field.type === "number" || field.type === "currency" || field.type === "date" || field.type === "boolean" || field.type === "select";
}
