// Leitura dos componentes de um modelo aprovado da Meta (puro, sem rede).
// Usado pelo servidor (validação de envio) e pela interface (preview/variáveis).

export type TemplateButton = { type: string; text: string };

export type TemplateShape = {
  /** Texto do corpo, com placeholders {{1}}, {{2}}… */
  body: string;
  /** Maior índice de variável usado no corpo. */
  variableCount: number;
  headerType: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION" | "NONE";
  headerText: string;
  /** Variáveis do cabeçalho de texto (a Meta aceita no máximo uma). */
  headerVariableCount: number;
  /** Cabeçalho de mídia exige um link no envio. */
  headerMediaRequired: boolean;
  footer: string;
  buttons: TemplateButton[];
};

function maxPlaceholder(text: string): number {
  return Array.from(text.matchAll(/\{\{(\d+)\}\}/g))
    .map((m) => Number(m[1]))
    .reduce((a, b) => Math.max(a, b), 0);
}

export function describeTemplate(components: unknown): TemplateShape {
  const comps = Array.isArray(components) ? (components as Record<string, unknown>[]) : [];
  const find = (type: string) =>
    comps.find((c) => String(c?.["type"] ?? "").toUpperCase() === type);
  const bodyComp = find("BODY");
  const headerComp = find("HEADER");
  const footerComp = find("FOOTER");
  const buttonsComp = find("BUTTONS");

  const body = String(bodyComp?.["text"] ?? "");
  const headerFormat = String(headerComp?.["format"] ?? "").toUpperCase();
  const headerText = String(headerComp?.["text"] ?? "");
  const headerType = (
    headerComp
      ? ["TEXT", "IMAGE", "VIDEO", "DOCUMENT", "LOCATION"].includes(headerFormat)
        ? headerFormat
        : "TEXT"
      : "NONE"
  ) as TemplateShape["headerType"];

  const rawButtons = Array.isArray(buttonsComp?.["buttons"])
    ? (buttonsComp!["buttons"] as Record<string, unknown>[])
    : [];

  return {
    body,
    variableCount: maxPlaceholder(body),
    headerType,
    headerText,
    headerVariableCount: headerType === "TEXT" ? maxPlaceholder(headerText) : 0,
    headerMediaRequired: ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType),
    footer: String(footerComp?.["text"] ?? ""),
    buttons: rawButtons.map((b) => ({
      type: String(b?.["type"] ?? "").toUpperCase() || "QUICK_REPLY",
      text: String(b?.["text"] ?? ""),
    })),
  };
}

export type TemplateVariableCheck =
  | { ok: true }
  | { ok: false; reason: "missing_body" | "missing_header" | "missing_media"; index?: number };

/** Confere se todas as variáveis exigidas pelo modelo foram preenchidas. */
export function checkTemplateVariables(
  shape: TemplateShape,
  input: { variables?: string[]; headerVariables?: string[]; headerMediaUrl?: string | null },
): TemplateVariableCheck {
  const vars = input.variables ?? [];
  for (let i = 0; i < shape.variableCount; i++) {
    if (!(vars[i] ?? "").trim()) return { ok: false, reason: "missing_body", index: i + 1 };
  }
  const head = input.headerVariables ?? [];
  for (let i = 0; i < shape.headerVariableCount; i++) {
    if (!(head[i] ?? "").trim()) return { ok: false, reason: "missing_header", index: i + 1 };
  }
  if (shape.headerMediaRequired && !(input.headerMediaUrl ?? "").trim())
    return { ok: false, reason: "missing_media" };
  return { ok: true };
}
