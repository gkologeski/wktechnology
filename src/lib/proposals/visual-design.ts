import { z } from "zod";

export const VISUAL_DESIGN_MAX_BYTES = 500_000;
export const VISUAL_MAX_PAGES = 40;
export const VISUAL_MAX_ELEMENTS_PER_PAGE = 150;

export const VISUAL_ORIENTATIONS = ["portrait", "landscape"] as const;
export type VisualOrientation = (typeof VISUAL_ORIENTATIONS)[number];

export const VISUAL_ELEMENT_TYPES = [
  "heading",
  "text",
  "image",
  "rect",
  "circle",
  "line",
  "divider",
  "icon",
  "table",
  "price_card",
] as const;
export type VisualElementType = (typeof VISUAL_ELEMENT_TYPES)[number];

export const VISUAL_ICON_NAMES = [
  "check",
  "sparkles",
  "target",
  "shield",
  "clock",
  "trending-up",
  "users",
  "briefcase",
  "star",
  "zap",
  "award",
  "layers",
  "calendar",
  "phone",
  "mail",
  "arrow-right",
  "building",
  "file-text",
] as const;
export type VisualIconName = (typeof VISUAL_ICON_NAMES)[number];

export const VISUAL_ICON_LABELS: Record<VisualIconName, string> = {
  check: "Confirmação",
  sparkles: "Destaque",
  target: "Objetivo",
  shield: "Segurança",
  clock: "Prazo",
  "trending-up": "Crescimento",
  users: "Equipe",
  briefcase: "Negócios",
  star: "Estrela",
  zap: "Agilidade",
  award: "Qualidade",
  layers: "Estrutura",
  calendar: "Agenda",
  phone: "Telefone",
  mail: "E-mail",
  "arrow-right": "Próximo passo",
  building: "Empresa",
  "file-text": "Documento",
};

export const VISUAL_ICON_PATHS: Record<VisualIconName, string[]> = {
  check: ["M20 6 9 17l-5-5"],
  sparkles: [
    "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z",
    "M19 3v4",
    "M21 5h-4",
  ],
  target: [
    "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z",
    "M12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6Z",
    "M12 10a2 2 0 1 0 2 2 2 2 0 0 0-2-2Z",
  ],
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"],
  clock: ["M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z", "M12 6v6l4 2"],
  "trending-up": ["M22 7 13.5 15.5 8.5 10.5 2 17", "M16 7h6v6"],
  users: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    "M22 21v-2a4 4 0 0 0-3-3.87",
    "M16 3.13a4 4 0 0 1 0 7.75",
  ],
  briefcase: [
    "M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",
    "M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z",
  ],
  star: [
    "M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2Z",
  ],
  zap: ["M13 2 3 14h9l-1 8 10-12h-9l1-8Z"],
  award: ["M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z", "M8.21 13.89 7 23l5-3 5 3-1.21-9.12"],
  layers: ["M12 2 2 7l10 5 10-5-10-5Z", "M2 17l10 5 10-5", "M2 12l10 5 10-5"],
  calendar: [
    "M8 2v4",
    "M16 2v4",
    "M3 10h18",
    "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  ],
  phone: [
    "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z",
  ],
  mail: [
    "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
    "m22 7-10 6L2 7",
  ],
  "arrow-right": ["M5 12h14", "m12 5 7 7-7 7"],
  building: [
    "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z",
    "M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2",
    "M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2",
  ],
  "file-text": [
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z",
    "M14 2v6h6",
    "M16 13H8",
    "M16 17H8",
    "M10 9H8",
  ],
};

export const VISUAL_FONTS = [
  { value: "DM Sans", label: "DM Sans (Moderna)" },
  { value: "Plus Jakarta Sans", label: "Plus Jakarta Sans (Editorial)" },
  { value: "IBM Plex Sans", label: "IBM Plex Sans (Corporativa)" },
  { value: "Montserrat", label: "Montserrat (Geométrica)" },
  { value: "Space Grotesk", label: "Space Grotesk (Tecnológica)" },
  { value: "Playfair Display", label: "Playfair Display (Serifa)" },
  { value: "Merriweather", label: "Merriweather (Leitura)" },
  { value: "system-ui", label: "Sistema (Padrão)" },
] as const;

export const VISUAL_VARIABLES = [
  { key: "{{company.name}}", label: "Nome da empresa cliente", group: "Cliente" },
  { key: "{{counterparty.name}}", label: "Nome da contraparte (cliente)", group: "Cliente" },
  { key: "{{company_legal_name}}", label: "Razão social do cliente", group: "Cliente" },
  { key: "{{company_cnpj}}", label: "CNPJ do cliente", group: "Cliente" },
  { key: "{{contact.name}}", label: "Nome do contato", group: "Cliente" },
  { key: "{{signer.full_name}}", label: "Signatário legal / responsável", group: "Cliente" },
  { key: "{{contact.email}}", label: "E-mail do contato", group: "Cliente" },
  { key: "{{deal.name}}", label: "Nome do negócio", group: "Proposta" },
  { key: "{{proposal.title}}", label: "Título da proposta", group: "Proposta" },
  { key: "{{date}}", label: "Data de emissão", group: "Proposta" },
  { key: "{{valid_until}}", label: "Válida até", group: "Proposta" },
  { key: "{{validity_days}}", label: "Dias de validade", group: "Proposta" },
  { key: "{{total}}", label: "Valor total", group: "Financeiro" },
  { key: "{{payment_method}}", label: "Forma de pagamento", group: "Financeiro" },
  { key: "{{installments_count}}", label: "Quantidade de parcelas", group: "Financeiro" },
  { key: "{{installment_value}}", label: "Valor da parcela", group: "Financeiro" },
  { key: "{{installments_summary}}", label: "Resumo do parcelamento", group: "Financeiro" },
  { key: "{{payment_terms_summary}}", label: "Condições comerciais", group: "Financeiro" },
  { key: "{{contracting.name}}", label: "Empresa prestadora (WK)", group: "Prestadora" },
  { key: "{{contracting.cnpj}}", label: "CNPJ da prestadora", group: "Prestadora" },
  { key: "{{agent.name}}", label: "Responsável comercial", group: "Prestadora" },
  { key: "{{page.number_padded}}", label: "Número da página (01, 02...)", group: "Página" },
  { key: "{{page.number}}", label: "Número da página (1, 2...)", group: "Página" },
  { key: "{{page.total}}", label: "Total de páginas", group: "Página" },
] as const;

const ColorSchema = z
  .string()
  .max(40)
  .refine(
    (v) =>
      v === "transparent" ||
      /^#[0-9a-fA-F]{3,8}$/.test(v) ||
      /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*(0|1|0?\.\d+))?\s*\)$/.test(v),
    "Cor inválida",
  );

export const VisualElementStyleSchema = z.object({
  bgColor: ColorSchema.optional(),
  textColor: ColorSchema.optional(),
  borderColor: ColorSchema.optional(),
  borderWidth: z.number().min(0).max(20).optional(),
  borderRadius: z.number().min(0).max(100).optional(),
  shadow: z.enum(["none", "sm", "md", "lg"]).optional(),
  opacity: z.number().min(0).max(1).optional(),
  fontFamily: z.string().max(80).optional(),
  fontSize: z.number().min(6).max(140).optional(),
  fontWeight: z.enum(["400", "500", "600", "700", "800"]).optional(),
  textAlign: z.enum(["left", "center", "right", "justify"]).optional(),
  lineHeight: z.number().min(0.8).max(3).optional(),
  letterSpacing: z.number().min(-2).max(12).optional(),
  paddingMm: z.number().min(0).max(40).optional(),
  uppercase: z.boolean().optional(),
});
export type VisualElementStyle = z.infer<typeof VisualElementStyleSchema>;
export type VisualStyle = VisualElementStyle;

const BaseElementSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().max(120),
  x: z.number().min(-50).max(400),
  y: z.number().min(-50).max(400),
  w: z.number().min(1).max(400),
  h: z.number().min(0.3).max(400),
  rotation: z.number().min(-360).max(360).default(0),
  z: z.number().int().min(0).max(10_000).default(1),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
  groupId: z.string().max(80).nullable().optional(),
  binding: z.string().max(80).nullable().optional(),
  style: VisualElementStyleSchema.default({}),
});

export const VisualElementSchema = z.discriminatedUnion("type", [
  BaseElementSchema.extend({
    type: z.literal("heading"),
    props: z.object({
      text: z.string().max(4_000),
      richHtml: z.string().max(8_000).optional(),
    }),
  }),
  BaseElementSchema.extend({
    type: z.literal("text"),
    props: z.object({
      text: z.string().max(20_000),
      richHtml: z.string().max(40_000).optional(),
    }),
  }),
  BaseElementSchema.extend({
    type: z.literal("image"),
    props: z.object({
      src: z.string().max(2_000).default(""),
      storagePath: z.string().max(500).nullable().optional(),
      alt: z.string().max(200).default("Imagem"),
      fit: z.enum(["contain", "cover"]).default("contain"),
      bindLogo: z.enum(["none", "contracting", "workspace"]).default("none"),
    }),
  }),
  BaseElementSchema.extend({
    type: z.literal("rect"),
    props: z.object({
      accentStripe: z.enum(["none", "left", "top"]).default("none"),
      accentColor: ColorSchema.optional(),
    }),
  }),
  BaseElementSchema.extend({
    type: z.literal("circle"),
    props: z.object({}),
  }),
  BaseElementSchema.extend({
    type: z.literal("line"),
    props: z.object({
      strokeStyle: z.enum(["solid", "dashed", "dotted"]).default("solid"),
    }),
  }),
  BaseElementSchema.extend({
    type: z.literal("divider"),
    props: z.object({
      strokeStyle: z.enum(["solid", "dashed", "dotted"]).default("solid"),
    }),
  }),
  BaseElementSchema.extend({
    type: z.literal("icon"),
    props: z.object({
      icon: z.enum(VISUAL_ICON_NAMES).default("sparkles"),
      strokeWidth: z.number().min(1).max(3.5).default(2),
    }),
  }),
  BaseElementSchema.extend({
    type: z.literal("table"),
    props: z.object({
      headers: z.array(z.string().max(200)).min(1).max(10),
      rows: z.array(z.array(z.string().max(500)).max(10)).max(60),
      headerBg: ColorSchema.optional(),
      headerColor: ColorSchema.optional(),
      stripeBg: ColorSchema.optional(),
      borderColor: ColorSchema.optional(),
    }),
  }),
  BaseElementSchema.extend({
    type: z.literal("price_card"),
    props: z.object({
      eyebrow: z.string().max(200),
      title: z.string().max(300),
      price: z.string().max(120),
      subtitle: z.string().max(600),
      variant: z.enum(["dark", "light", "accent"]).default("dark"),
      eyebrowColor: ColorSchema.optional(),
      repeatGapMm: z.number().min(2).max(30).default(4),
    }),
  }),
]);
export type VisualElement = z.infer<typeof VisualElementSchema>;

export const VisualBrandKitSchema = z.object({
  legalEntityId: z.string().uuid().nullable().optional(),
  legalEntityName: z.string().max(200).optional(),
  logoUrl: z.string().max(2_000).nullable().optional(),
  logoStoragePath: z.string().max(500).nullable().optional(),
  primaryColor: ColorSchema.default("#2563EB"),
  secondaryColor: ColorSchema.default("#0F172A"),
  accentColor: ColorSchema.default("#3B82F6"),
  darkSurfaceColor: ColorSchema.default("#111318"),
  lightSurfaceColor: ColorSchema.default("#EEF2F7"),
  textColor: ColorSchema.default("#111827"),
  mutedColor: ColorSchema.default("#4B5563"),
  headingFont: z.string().max(80).default("DM Sans"),
  bodyFont: z.string().max(80).default("DM Sans"),
});
export type VisualBrandKit = z.infer<typeof VisualBrandKitSchema>;

export const VisualMasterSchema = z.object({
  enabled: z.boolean().default(true),
  skipFirstPage: z.boolean().default(true),
  headerHeightMm: z.number().min(0).max(60).default(24),
  footerHeightMm: z.number().min(0).max(40).default(16),
  headerElements: z.array(VisualElementSchema).max(30).default([]),
  footerElements: z.array(VisualElementSchema).max(30).default([]),
});
export type VisualMaster = z.infer<typeof VisualMasterSchema>;

export const VisualPageSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().max(120),
  backgroundColor: ColorSchema.default("#FFFFFF"),
  useMaster: z.boolean().default(true),
  elements: z.array(VisualElementSchema).max(VISUAL_MAX_ELEMENTS_PER_PAGE).default([]),
});
export type VisualPage = z.infer<typeof VisualPageSchema>;

export const VisualDesignSchema = z.object({
  version: z.literal(1).default(1),
  orientation: z.enum(VISUAL_ORIENTATIONS).default("portrait"),
  brandKit: VisualBrandKitSchema.default({
    primaryColor: "#2563EB",
    secondaryColor: "#0F172A",
    accentColor: "#3B82F6",
    darkSurfaceColor: "#111318",
    lightSurfaceColor: "#EEF2F7",
    textColor: "#111827",
    mutedColor: "#4B5563",
    headingFont: "DM Sans",
    bodyFont: "DM Sans",
  }),
  master: VisualMasterSchema.default({
    enabled: true,
    skipFirstPage: true,
    headerHeightMm: 24,
    footerHeightMm: 16,
    headerElements: [],
    footerElements: [],
  }),
  pages: z.array(VisualPageSchema).min(1).max(VISUAL_MAX_PAGES),
});
export type VisualDesign = z.infer<typeof VisualDesignSchema>;

export function pageSizeMm(orientation: VisualOrientation): { width: number; height: number } {
  return orientation === "landscape" ? { width: 297, height: 210 } : { width: 210, height: 297 };
}

export function parseVisualDesign(input: unknown): VisualDesign {
  const serialized = JSON.stringify(input ?? null);
  if (serialized.length > VISUAL_DESIGN_MAX_BYTES) {
    throw new Error("Modelo visual excede o limite máximo de 500 KB.");
  }
  return VisualDesignSchema.parse(input);
}

export function tryParseVisualDesign(input: unknown): VisualDesign | null {
  if (!input || typeof input !== "object") return null;
  const res = VisualDesignSchema.safeParse(input);
  return res.success ? res.data : null;
}

export function uid(prefix = "el"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

export function createDefaultMaster(brand?: Partial<VisualBrandKit>): VisualMaster {
  const primary = brand?.primaryColor ?? "#2563EB";
  const muted = brand?.mutedColor ?? "#4B5563";
  const text = brand?.textColor ?? "#111827";
  const font = brand?.headingFont ?? "DM Sans";
  return {
    enabled: true,
    skipFirstPage: true,
    headerHeightMm: 24,
    footerHeightMm: 16,
    headerElements: [
      {
        id: "master_logo",
        type: "image",
        name: "Logo do cabeçalho",
        x: 16,
        y: 8,
        w: 40,
        h: 10,
        rotation: 0,
        z: 1,
        style: {},
        props: {
          src: brand?.logoUrl ?? "",
          storagePath: brand?.logoStoragePath ?? null,
          alt: "Logo da empresa",
          fit: "contain",
          bindLogo: "contracting",
        },
      },
      {
        id: "master_header_label",
        type: "text",
        name: "Identificação do documento",
        x: 92,
        y: 10.5,
        w: 102,
        h: 6,
        rotation: 0,
        z: 2,
        style: {
          fontFamily: font,
          fontSize: 8.5,
          fontWeight: "700",
          textColor: text,
          textAlign: "right",
          letterSpacing: 0.5,
          uppercase: true,
        },
        props: {
          text: "{{company.name}}  /  PROPOSTA COMERCIAL",
        },
      },
      {
        id: "master_header_line",
        type: "divider",
        name: "Linha do cabeçalho",
        x: 16,
        y: 22,
        w: 178,
        h: 0.8,
        rotation: 0,
        z: 3,
        style: { bgColor: primary },
        props: { strokeStyle: "solid" },
      },
    ],
    footerElements: [
      {
        id: "master_footer_line",
        type: "divider",
        name: "Linha do rodapé",
        x: 16,
        y: 281,
        w: 178,
        h: 0.35,
        rotation: 0,
        z: 1,
        style: { bgColor: "#D1D5DB" },
        props: { strokeStyle: "solid" },
      },
      {
        id: "master_footer_left",
        type: "text",
        name: "Confidencialidade",
        x: 16,
        y: 284,
        w: 145,
        h: 6,
        rotation: 0,
        z: 2,
        style: {
          fontFamily: font,
          fontSize: 8,
          fontWeight: "500",
          textColor: muted,
          uppercase: true,
          letterSpacing: 0.4,
        },
        props: {
          text: "{{contracting.name}} • CONFIDENCIAL / {{company.name}}",
        },
      },
      {
        id: "master_footer_page",
        type: "text",
        name: "Número da página",
        x: 170,
        y: 284,
        w: 24,
        h: 6,
        rotation: 0,
        z: 3,
        style: {
          fontFamily: font,
          fontSize: 9,
          fontWeight: "700",
          textColor: primary,
          textAlign: "right",
        },
        props: {
          text: "{{page.number_padded}}",
        },
      },
    ],
  };
}

export function createBlankVisualDesign(brand?: Partial<VisualBrandKit>): VisualDesign {
  const brandKit: VisualBrandKit = {
    primaryColor: brand?.primaryColor ?? "#2563EB",
    secondaryColor: brand?.secondaryColor ?? "#0F172A",
    accentColor: brand?.accentColor ?? "#3B82F6",
    darkSurfaceColor: brand?.darkSurfaceColor ?? "#111318",
    lightSurfaceColor: brand?.lightSurfaceColor ?? "#EEF2F7",
    textColor: brand?.textColor ?? "#111827",
    mutedColor: brand?.mutedColor ?? "#4B5563",
    headingFont: brand?.headingFont ?? "DM Sans",
    bodyFont: brand?.bodyFont ?? "DM Sans",
    ...(brand?.legalEntityId ? { legalEntityId: brand.legalEntityId } : {}),
    ...(brand?.legalEntityName ? { legalEntityName: brand.legalEntityName } : {}),
    ...(brand?.logoUrl ? { logoUrl: brand.logoUrl } : {}),
    ...(brand?.logoStoragePath ? { logoStoragePath: brand.logoStoragePath } : {}),
  };
  return {
    version: 1,
    orientation: "portrait",
    brandKit,
    master: createDefaultMaster(brandKit),
    pages: [
      {
        id: uid("page"),
        name: "Capa",
        backgroundColor: "#FFFFFF",
        useMaster: false,
        elements: [
          {
            id: uid("el"),
            type: "heading",
            name: "Título principal",
            x: 16,
            y: 42,
            w: 178,
            h: 28,
            rotation: 0,
            z: 1,
            style: {
              fontFamily: brandKit.headingFont,
              fontSize: 28,
              fontWeight: "800",
              textColor: brandKit.textColor,
              lineHeight: 1.15,
            },
            props: { text: "{{proposal.title}}" },
          },
          {
            id: uid("el"),
            type: "text",
            name: "Subtítulo",
            x: 16,
            y: 74,
            w: 178,
            h: 18,
            rotation: 0,
            z: 2,
            style: {
              fontFamily: brandKit.bodyFont,
              fontSize: 12,
              fontWeight: "400",
              textColor: brandKit.mutedColor,
              lineHeight: 1.5,
            },
            props: { text: "Preparado para {{company.name}} — {{contact.name}}" },
          },
        ],
      },
    ],
  };
}

export function createDefaultElement(
  type: VisualElementType,
  pageW: number,
  pageH: number,
  nextZ: number,
  brand: VisualBrandKit,
): VisualElement {
  const cx = Math.max(16, Math.round((pageW - 90) / 2));
  const cy = Math.max(36, Math.round(pageH * 0.25));
  switch (type) {
    case "heading":
      return {
        id: uid("el"),
        type: "heading",
        name: "Título",
        x: 16,
        y: cy,
        w: Math.min(178, pageW - 32),
        h: 18,
        rotation: 0,
        z: nextZ,
        style: {
          fontFamily: brand.headingFont,
          fontSize: 22,
          fontWeight: "800",
          textColor: brand.textColor,
          lineHeight: 1.18,
        },
        props: { text: "Título da seção" },
      };
    case "text":
      return {
        id: uid("el"),
        type: "text",
        name: "Texto",
        x: 16,
        y: cy,
        w: Math.min(178, pageW - 32),
        h: 24,
        rotation: 0,
        z: nextZ,
        style: {
          fontFamily: brand.bodyFont,
          fontSize: 11,
          fontWeight: "400",
          textColor: brand.mutedColor,
          lineHeight: 1.55,
        },
        props: {
          text: "Digite seu texto comercial ou insira um campo dinâmico como {{company.name}}.",
        },
      };
    case "image":
      return {
        id: uid("el"),
        type: "image",
        name: "Imagem / Logo",
        x: cx,
        y: cy,
        w: 60,
        h: 36,
        rotation: 0,
        z: nextZ,
        style: { borderRadius: 4, opacity: 1 },
        props: {
          src: brand.logoUrl ?? "",
          storagePath: brand.logoStoragePath ?? null,
          alt: "Imagem",
          fit: "contain",
          bindLogo: "none",
        },
      };
    case "rect":
      return {
        id: uid("el"),
        type: "rect",
        name: "Retângulo",
        x: 16,
        y: cy,
        w: 84,
        h: 36,
        rotation: 0,
        z: nextZ,
        style: {
          bgColor: brand.lightSurfaceColor,
          borderColor: "#E2E8F0",
          borderWidth: 0,
          borderRadius: 4,
          shadow: "none",
          opacity: 1,
        },
        props: { accentStripe: "none", accentColor: brand.primaryColor },
      };
    case "circle":
      return {
        id: uid("el"),
        type: "circle",
        name: "Círculo",
        x: cx,
        y: cy,
        w: 28,
        h: 28,
        rotation: 0,
        z: nextZ,
        style: {
          bgColor: brand.primaryColor,
          borderWidth: 0,
          opacity: 1,
        },
        props: {},
      };
    case "line":
      return {
        id: uid("el"),
        type: "line",
        name: "Linha",
        x: 16,
        y: cy,
        w: Math.min(178, pageW - 32),
        h: 0.8,
        rotation: 0,
        z: nextZ,
        style: { bgColor: brand.primaryColor, opacity: 1 },
        props: { strokeStyle: "solid" },
      };
    case "divider":
      return {
        id: uid("el"),
        type: "divider",
        name: "Divisor",
        x: 16,
        y: cy,
        w: Math.min(178, pageW - 32),
        h: 0.5,
        rotation: 0,
        z: nextZ,
        style: { bgColor: "#D1D5DB", opacity: 1 },
        props: { strokeStyle: "solid" },
      };
    case "icon":
      return {
        id: uid("el"),
        type: "icon",
        name: "Ícone",
        x: cx,
        y: cy,
        w: 12,
        h: 12,
        rotation: 0,
        z: nextZ,
        style: { textColor: brand.primaryColor, opacity: 1 },
        props: { icon: "sparkles", strokeWidth: 2 },
      };
    case "table":
      return {
        id: uid("el"),
        type: "table",
        name: "Tabela de itens",
        x: 16,
        y: cy,
        w: Math.min(178, pageW - 32),
        h: 52,
        rotation: 0,
        z: nextZ,
        binding: "items",
        style: {
          fontFamily: brand.bodyFont,
          fontSize: 9.5,
          textColor: brand.textColor,
          borderRadius: 4,
        },
        props: {
          headers: ["Item / Serviço", "Condição de cobrança"],
          rows: [
            ["Consultoria especializada", "R$ 16.000,00 / mês"],
            ["Implantação e acompanhamento", "Incluso no projeto"],
          ],
          headerBg: brand.darkSurfaceColor,
          headerColor: "#FFFFFF",
          stripeBg: brand.lightSurfaceColor,
          borderColor: "#E5E7EB",
        },
      };
    case "price_card":
      return {
        id: uid("el"),
        type: "price_card",
        name: "Bloco de investimento",
        x: 16,
        y: cy,
        w: Math.min(178, pageW - 32),
        h: 44,
        rotation: 0,
        z: nextZ,
        style: {
          bgColor: brand.darkSurfaceColor,
          textColor: "#FFFFFF",
          borderRadius: 4,
          paddingMm: 7,
          fontFamily: brand.headingFont,
          shadow: "sm",
        },
        props: {
          eyebrow: "MODELO 01 / RECOMENDADO",
          title: "{{deal.name}}",
          price: "{{total}}",
          subtitle: "{{installments_summary}}",
          variant: "dark",
          eyebrowColor: brand.accentColor,
          repeatGapMm: 4,
        },
      };
  }
}

/** Coleta todos os caminhos privados do bucket proposal-assets referenciados no design. */
export function collectVisualStoragePaths(design: VisualDesign): string[] {
  const set = new Set<string>();
  if (design.brandKit.logoStoragePath) set.add(design.brandKit.logoStoragePath);
  const scan = (els: VisualElement[]) => {
    for (const el of els) {
      if (el.type === "image" && el.props.storagePath) {
        set.add(el.props.storagePath);
      }
    }
  };
  scan(design.master.headerElements);
  scan(design.master.footerElements);
  for (const page of design.pages) scan(page.elements);
  return [...set];
}
