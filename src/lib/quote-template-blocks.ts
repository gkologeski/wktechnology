/**
 * Block model + HTML compiler for the visual drag-and-drop quote template editor.
 *
 * The visual editor stores a `TemplateDocument` (theme + ordered blocks).
 * `blocksToHtml(doc)` compiles it into a full HTML document compatible with
 * the existing `renderQuoteTemplate` renderer (so the public quote page does
 * not need any changes).
 */

export type BlockType =
  | "header"
  | "logo"
  | "customer"
  | "agent"
  | "items_table"
  | "totals"
  | "notes"
  | "terms"
  | "text"
  | "actions"
  | "divider"
  | "spacer"
  | "image";

export type TemplateBlock = {
  id: string;
  type: BlockType;
  props: Record<string, unknown>;
};

export type TemplateTheme = {
  primaryColor: string;
  accentColor: string;
  textColor: string;
  bgColor: string;
  fontFamily: string;
  pagePadding: number; // px
  radius: number; // px
};

export type TemplateDocument = {
  version: 1;
  theme: TemplateTheme;
  blocks: TemplateBlock[];
};

export const DEFAULT_THEME: TemplateTheme = {
  primaryColor: "#4f46e5",
  accentColor: "#0ea5e9",
  textColor: "#0f172a",
  bgColor: "#ffffff",
  fontFamily: "'Inter', system-ui, sans-serif",
  pagePadding: 40,
  radius: 12,
};

export const BLOCK_LIBRARY: Array<{
  type: BlockType;
  label: string;
  description: string;
  icon: string; // lucide icon name
  defaultProps: Record<string, unknown>;
}> = [
  {
    type: "header",
    label: "Cabeçalho",
    description: "Título e número da cotação",
    icon: "Heading",
    defaultProps: {
      title: "{{quote.title}}",
      subtitle: "Cotação Nº {{quote.number}}",
      align: "left",
      bg: "",
    },
  },
  {
    type: "logo",
    label: "Logo",
    description: "Imagem da sua marca",
    icon: "Image",
    defaultProps: { url: "", width: 140, align: "left" },
  },
  {
    type: "customer",
    label: "Dados do cliente",
    description: "Empresa, contato e e-mail",
    icon: "Users",
    defaultProps: { title: "Para", showCompany: true, showContact: true, showEmail: true },
  },
  {
    type: "agent",
    label: "Dados do emissor",
    description: "Vendedor, datas",
    icon: "UserCheck",
    defaultProps: { title: "Emissor", showAgent: true, showCreated: true, showValidity: true },
  },
  {
    type: "items_table",
    label: "Tabela de itens",
    description: "Lista de produtos/serviços",
    icon: "Table",
    defaultProps: {
      showDescription: true,
      showDiscount: true,
      showTax: false,
      headerBg: "auto",
    },
  },
  {
    type: "totals",
    label: "Totais",
    description: "Subtotal, descontos, impostos e total",
    icon: "Calculator",
    defaultProps: { showSubtotal: true, showDiscount: true, showTax: true, align: "right" },
  },
  {
    type: "notes",
    label: "Observações",
    description: "Texto livre vindo da cotação",
    icon: "StickyNote",
    defaultProps: { title: "Observações" },
  },
  {
    type: "terms",
    label: "Termos",
    description: "Termos e condições",
    icon: "FileText",
    defaultProps: { title: "Termos e Condições" },
  },
  {
    type: "text",
    label: "Texto livre",
    description: "Parágrafo personalizado",
    icon: "Type",
    defaultProps: {
      content: "Escreva aqui um texto livre. Você pode usar {{quote.total}}, {{contact.name}} etc.",
      align: "left",
    },
  },
  {
    type: "actions",
    label: "Botões de ação",
    description: "Aceitar / Recusar / Pagar",
    icon: "MousePointerClick",
    defaultProps: {},
  },
  {
    type: "divider",
    label: "Divisor",
    description: "Linha horizontal",
    icon: "Minus",
    defaultProps: {},
  },
  {
    type: "spacer",
    label: "Espaçador",
    description: "Espaço em branco",
    icon: "MoveVertical",
    defaultProps: { height: 24 },
  },
  {
    type: "image",
    label: "Imagem",
    description: "URL de imagem externa",
    icon: "Image",
    defaultProps: { url: "", align: "center", width: 480 },
  },
];

export function createBlock(type: BlockType): TemplateBlock {
  const def = BLOCK_LIBRARY.find((b) => b.type === type);
  return {
    id: `b_${Math.random().toString(36).slice(2, 10)}`,
    type,
    props: { ...(def?.defaultProps ?? {}) },
  };
}

export function defaultDocument(): TemplateDocument {
  return {
    version: 1,
    theme: { ...DEFAULT_THEME },
    blocks: [
      createBlock("header"),
      createBlock("customer"),
      createBlock("items_table"),
      createBlock("totals"),
      createBlock("notes"),
      createBlock("actions"),
    ],
  };
}

// ---------- HTML compiler ----------

const esc = (s: unknown) =>
  s == null
    ? ""
    : String(s).replace(
        /[&<>"]/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
      );

const prop = (b: TemplateBlock, k: string, fallback = ""): string => {
  const v = b.props[k];
  return v == null ? fallback : String(v);
};
const bool = (b: TemplateBlock, k: string, fallback = false): boolean => {
  const v = b.props[k];
  return v == null ? fallback : Boolean(v);
};
const num = (b: TemplateBlock, k: string, fallback = 0): number => {
  const v = b.props[k];
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function renderBlock(b: TemplateBlock, theme: TemplateTheme): string {
  switch (b.type) {
    case "header": {
      const align = prop(b, "align", "left");
      const bg = prop(b, "bg", "");
      const bgStyle = bg
        ? `background:${esc(bg)};color:#fff;padding:24px;border-radius:${theme.radius}px;`
        : "";
      return `<section style="text-align:${esc(align)};margin-bottom:20px;${bgStyle}">
  <h1 style="margin:0;font-size:28px;font-weight:700;line-height:1.2;">${prop(b, "title")}</h1>
  ${prop(b, "subtitle") ? `<div style="margin-top:6px;font-size:14px;opacity:.8;">${prop(b, "subtitle")}</div>` : ""}
</section>`;
    }
    case "logo": {
      const url = prop(b, "url");
      const width = num(b, "width", 140);
      const align = prop(b, "align", "left");
      if (!url) return `<!-- logo: configure a URL -->`;
      return `<div style="text-align:${esc(align)};margin-bottom:16px;"><img src="${esc(url)}" alt="logo" style="max-width:${width}px;height:auto;" /></div>`;
    }
    case "customer": {
      const title = prop(b, "title", "Para");
      const lines: string[] = [];
      if (bool(b, "showCompany", true))
        lines.push(`<div style="font-weight:600;font-size:15px;">{{company.name}}</div>`);
      if (bool(b, "showContact", true)) lines.push(`<div>{{contact.name}}</div>`);
      if (bool(b, "showEmail", true))
        lines.push(`<div style="color:#64748b;">{{contact.email}}</div>`);
      return blockCard(title, lines.join(""), theme);
    }
    case "agent": {
      const title = prop(b, "title", "Emissor");
      const lines: string[] = [];
      if (bool(b, "showAgent", true))
        lines.push(
          `<div style="font-weight:600;">{{agent.name}}</div><div style="color:#64748b;">{{agent.email}}</div>`,
        );
      if (bool(b, "showCreated", true)) lines.push(`<div>Emitida em {{quote.created_at}}</div>`);
      if (bool(b, "showValidity", true))
        lines.push(
          `{{#if quote.valid_until}}<div>Válida até <strong>{{quote.valid_until}}</strong></div>{{/if}}`,
        );
      return blockCard(title, lines.join(""), theme);
    }
    case "items_table": {
      const showDesc = bool(b, "showDescription", true);
      const showDisc = bool(b, "showDiscount", true);
      const showTax = bool(b, "showTax", false);
      const headerBgRaw = prop(b, "headerBg", "auto");
      const headerBg =
        headerBgRaw === "auto" ? theme.primaryColor : headerBgRaw || theme.primaryColor;
      const cols: string[] = ['<th style="text-align:left;padding:10px;color:#fff;">Item</th>'];
      cols.push('<th style="text-align:right;padding:10px;color:#fff;">Qtd</th>');
      cols.push('<th style="text-align:right;padding:10px;color:#fff;">Preço</th>');
      if (showDisc) cols.push('<th style="text-align:right;padding:10px;color:#fff;">Desc</th>');
      if (showTax) cols.push('<th style="text-align:right;padding:10px;color:#fff;">Imp</th>');
      cols.push('<th style="text-align:right;padding:10px;color:#fff;">Total</th>');
      const rowCells: string[] = [
        `<td style="padding:10px;border-bottom:1px solid #e2e8f0;"><strong>{{name}}</strong>${showDesc ? `<div style="color:#64748b;font-size:12px;">{{description}}</div>` : ""}</td>`,
        `<td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:right;">{{quantity}}</td>`,
        `<td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:right;">{{unit_price}}</td>`,
      ];
      if (showDisc)
        rowCells.push(
          `<td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:right;">{{discount_pct}}%</td>`,
        );
      if (showTax)
        rowCells.push(
          `<td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:right;">{{tax_rate}}%</td>`,
        );
      rowCells.push(
        `<td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:right;"><strong>{{line_total}}</strong></td>`,
      );
      return `<table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;border-radius:${theme.radius}px;overflow:hidden;">
  <thead style="background:${esc(headerBg)};"><tr>${cols.join("")}</tr></thead>
  <tbody>
  {{#each items}}
    <tr>${rowCells.join("")}</tr>
  {{/each}}
  </tbody>
</table>`;
    }
    case "totals": {
      const align = prop(b, "align", "right");
      const rows: string[] = [];
      if (bool(b, "showSubtotal", true))
        rows.push(
          `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#475569;"><span>Subtotal</span><span>{{quote.subtotal}}</span></div>`,
        );
      if (bool(b, "showDiscount", true))
        rows.push(
          `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#475569;"><span>Descontos</span><span>− {{quote.discount_total}}</span></div>`,
        );
      if (bool(b, "showTax", true))
        rows.push(
          `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#475569;"><span>Impostos</span><span>+ {{quote.tax_total}}</span></div>`,
        );
      rows.push(
        `<div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:10px;border-top:2px solid ${esc(theme.primaryColor)};font-size:18px;font-weight:700;color:${esc(theme.textColor)};"><span>Total</span><span>{{quote.total}}</span></div>`,
      );
      const widthStyle = "max-width:320px;";
      const wrapAlign =
        align === "right" ? "margin-left:auto;" : align === "center" ? "margin:0 auto;" : "";
      return `<div style="${widthStyle}${wrapAlign}margin-top:8px;margin-bottom:20px;background:#f8fafc;border-radius:${theme.radius}px;padding:18px;">${rows.join("")}</div><div style="clear:both"></div>`;
    }
    case "notes":
      return `{{#if quote.notes}}${blockCard(prop(b, "title", "Observações"), "{{{quote.notes}}}", theme)}{{/if}}`;
    case "terms":
      return `{{#if quote.terms}}${blockCard(prop(b, "title", "Termos e Condições"), "{{{quote.terms}}}", theme)}{{/if}}`;
    case "text": {
      const align = prop(b, "align", "left");
      const content = prop(b, "content", "");
      return `<div style="margin:14px 0;text-align:${esc(align)};font-size:14px;line-height:1.6;color:${esc(theme.textColor)};">${content}</div>`;
    }
    case "actions":
      return `<div style="margin-top:28px;text-align:center;">{{#actions/}}</div>`;
    case "divider":
      return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />`;
    case "spacer":
      return `<div style="height:${num(b, "height", 24)}px"></div>`;
    case "image": {
      const url = prop(b, "url");
      const width = num(b, "width", 480);
      const align = prop(b, "align", "center");
      if (!url) return `<!-- image: configure a URL -->`;
      return `<div style="text-align:${esc(align)};margin:16px 0;"><img src="${esc(url)}" alt="" style="max-width:${width}px;width:100%;height:auto;border-radius:${theme.radius}px;" /></div>`;
    }
  }
}

function blockCard(title: string, body: string, theme: TemplateTheme): string {
  return `<section style="margin-bottom:18px;">
  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:6px;">${esc(title)}</div>
  <div style="background:#f8fafc;border-radius:${theme.radius}px;padding:14px;font-size:14px;color:${esc(theme.textColor)};line-height:1.5;">${body}</div>
</section>`;
}

export function blocksToHtml(doc: TemplateDocument): string {
  const theme = doc.theme;
  const body = doc.blocks.map((b) => renderBlock(b, theme)).join("\n");
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>{{quote.title}}</title></head>
<body style="margin:0;padding:${theme.pagePadding}px;background:${esc(theme.bgColor)};font-family:${theme.fontFamily};color:${esc(theme.textColor)};">
<div style="max-width:820px;margin:0 auto;">
${body}
</div>
</body></html>`;
}

export function isTemplateDocument(v: unknown): v is TemplateDocument {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  return Array.isArray(d.blocks) && typeof d.theme === "object" && d.theme !== null;
}
