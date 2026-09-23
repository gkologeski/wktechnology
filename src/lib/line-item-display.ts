export type LineItemDisplayFields = {
  name?: string | null;
  quantity?: number | string | null;
  service_name?: string | null;
  preset_name?: string | null;
};

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function formatLineItemQuantity(value: number | string | null | undefined): string {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return "0";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(quantity);
}

/** Identificação visual comum: Serviço xQtd (Preset), com fallback para itens livres antigos. */
export function formatLineItemIdentity(item: LineItemDisplayFields): string {
  const service = clean(item.service_name) ?? clean(item.name) ?? "Serviço";
  const preset = clean(item.preset_name);
  const suffix = preset ? ` (${preset})` : "";
  return `${service} x${formatLineItemQuantity(item.quantity)}${suffix}`;
}
