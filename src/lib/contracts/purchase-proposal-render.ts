import {
  createDefaultMaster,
  parseVisualDesign,
  VisualBrandKitSchema,
  type VisualBrandKit,
  type VisualDesign,
  type VisualElement,
  type VisualPage,
} from "../proposals/visual-design";
import { renderVisualDesignPrintDocument } from "../proposals/visual-renderer";
import { purchaseProposalAmounts } from "./purchase-proposal-amounts";
import {
  purchaseProposalDataSchema,
  type PurchaseProposalData,
  type PurchaseProposalParty,
} from "./purchase-proposal.types";

type Parties = { wk: PurchaseProposalParty; supplier: PurchaseProposalParty };
type Section = { title: string; content: string };
const date = (value: string | null) => (value ? value.split("-").reverse().join("/") : "A definir");
const number = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(value);
const money = (value: number, currency: string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);

function text(
  id: string,
  content: string,
  y: number,
  h: number,
  brand: VisualBrandKit,
  heading = false,
): VisualElement {
  return {
    id,
    name: id,
    type: heading ? "heading" : "text",
    x: 16,
    y,
    w: 178,
    h,
    rotation: 0,
    z: 2,
    style: {
      fontFamily: heading ? brand.headingFont : brand.bodyFont,
      fontSize: heading ? 13 : 10,
      fontWeight: heading ? "700" : "400",
      lineHeight: 1.4,
      textColor: heading ? brand.primaryColor : brand.textColor,
    },
    props: { text: content },
  };
}

/** Native model: no transaction values, counterparty names, linked sale or external assets. */
export function createPurchaseFactoryTemplate(
  brandInput: Partial<VisualBrandKit> = {},
): VisualDesign {
  const brand = VisualBrandKitSchema.parse(brandInput);
  // Logo bindings resolve from the current workspace on the server, never from a sale.
  delete brand.logoUrl;
  delete brand.logoStoragePath;
  const master = createDefaultMaster(brand);
  master.headerElements = master.headerElements.map((el) =>
    el.id === "master_header_label" && el.type === "text"
      ? { ...el, props: { text: "FÁBRICA DE SOFTWARE / PROPOSTA TÉCNICA" } }
      : el,
  );
  master.footerElements = master.footerElements.map((el) =>
    el.id === "master_footer_left" && el.type === "text"
      ? { ...el, props: { text: "PROPOSTA DE COMPRA · CONFIDENCIAL" } }
      : el,
  );
  const cover: VisualPage = {
    id: "purchase-factory-cover",
    name: "Capa",
    backgroundColor: brand.darkSurfaceColor,
    useMaster: false,
    elements: [
      {
        id: "cover-accent",
        name: "Destaque",
        type: "rect",
        x: 16,
        y: 39,
        w: 20,
        h: 2,
        rotation: 0,
        z: 1,
        style: { bgColor: brand.accentColor },
        props: { accentStripe: "none", accentColor: brand.primaryColor },
      },
      {
        ...text("cover-label", "PROPOSTA COMERCIAL · ESCOPO TÉCNICO", 49, 12, brand),
        style: {
          fontFamily: brand.bodyFont,
          fontSize: 10,
          fontWeight: "600",
          textColor: "#FFFFFF",
          letterSpacing: 0.7,
        },
      },
      {
        ...text("cover-title", "Fábrica de\nSoftware", 76, 56, brand, true),
        style: {
          fontFamily: brand.headingFont,
          fontSize: 38,
          fontWeight: "700",
          lineHeight: 1.14,
          textColor: "#FFFFFF",
        },
      },
      {
        ...text(
          "cover-subtitle",
          "Desenvolvimento por entregas\nPreço fechado e aceite expresso",
          147,
          25,
          brand,
        ),
        style: { fontFamily: brand.bodyFont, fontSize: 14, lineHeight: 1.5, textColor: "#FFFFFF" },
      },
      {
        ...text("cover-parties", "WK · CONTRATANTE\nFORNECEDORA · CONTRATADA", 204, 24, brand),
        style: {
          fontFamily: brand.bodyFont,
          fontSize: 11,
          fontWeight: "500",
          lineHeight: 1.7,
          textColor: "#FFFFFF",
        },
      },
      {
        ...text("cover-version", "{{date}}", 264, 10, brand),
        style: { fontFamily: brand.bodyFont, fontSize: 10, textColor: "#FFFFFF" },
      },
    ],
  };
  return parseVisualDesign({
    version: 1,
    orientation: "portrait",
    brandKit: brand,
    master,
    pages: [cover],
  });
}

/** Explicit line wrapping permits pagination without clipping, slicing, or dropping any scope. */
function wrapLines(content: string, maximum = 48): string[] {
  const lines: string[] = [];
  for (const paragraph of content.replace(/\r\n?/g, "\n").split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let rest = paragraph;
    while (rest.length > maximum) {
      const space = rest.lastIndexOf(" ", maximum);
      const cut = space > maximum / 2 ? space : maximum;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut + (rest[cut] === " " ? 1 : 0));
    }
    lines.push(rest);
  }
  return lines;
}

function appendSections(base: VisualDesign, sections: Section[]): VisualDesign {
  const pages = [...base.pages];
  let elements: VisualElement[] = [],
    y = 33,
    sequence = 0;
  const flush = () => {
    if (!elements.length) return;
    pages.push({
      id: `purchase-content-${pages.length}`,
      name: `Proposta técnica ${pages.length}`,
      useMaster: true,
      backgroundColor: "#FFFFFF",
      elements,
    });
    elements = [];
    y = 33;
  };
  for (const section of sections) {
    const lines = wrapLines(section.content || "Não se aplica.");
    let offset = 0;
    while (offset < lines.length) {
      const heading = wrapLines(section.title + (offset ? " (continuação)" : ""), 36);
      const headingHeight = Math.max(9, heading.length * 6.5 + 1);
      if (y + headingHeight + 14 > 271) flush();
      const count = Math.min(lines.length - offset, Math.floor((271 - y - headingHeight - 6) / 5));
      elements.push(
        text(`section-${sequence++}`, heading.join("\n"), y, headingHeight, base.brandKit, true),
      );
      y += headingHeight + 2;
      const chunk = lines.slice(offset, offset + count);
      elements.push(
        text(`body-${sequence++}`, chunk.join("\n"), y, chunk.length * 5 + 2, base.brandKit),
      );
      y += chunk.length * 5 + 9;
      offset += count;
      if (offset < lines.length) flush();
    }
  }
  flush();
  if (pages.length > 40)
    throw new Error(
      "O documento ultrapassa 40 páginas. Divida o escopo em propostas complementares antes de gerar o anexo. Nenhum texto foi descartado.",
    );
  return parseVisualDesign({ ...base, pages });
}

export function compilePurchaseProposalDesign(
  template: VisualDesign,
  input: PurchaseProposalData,
  parties: Parties,
  metadata: { version: number; issuedOn: string; currency: string },
): VisualDesign {
  const data = purchaseProposalDataSchema.parse(input);
  const amounts = purchaseProposalAmounts(data);
  // Rebuild the native purchase layout with the selected template's brand only.
  // Imported sale templates, arbitrary images and commercial tokens cannot enter a purchase PDF.
  const base = createPurchaseFactoryTemplate(parseVisualDesign(template).brandKit);
  base.pages[0].elements = base.pages[0].elements.map((el) =>
    el.id === "cover-version" && el.type === "text"
      ? { ...el, props: { text: `Versão ${metadata.version} · ${date(metadata.issuedOn)}` } }
      : el,
  );
  const sections: Section[] = [
    {
      title: "Identificação e partes",
      content: `${data.title}\nVersão ${metadata.version} · Emissão ${date(metadata.issuedOn)}\nContratante: ${parties.wk.name}\nCNPJ: ${parties.wk.cnpj || "Não informado"}\nContratada / fornecedora: ${parties.supplier.name}\nCNPJ/CPF: ${parties.supplier.cnpj || "Não informado"}`,
    },
    { title: "Objeto e escopo técnico", content: data.scope },
    { title: "Entregáveis e critérios gerais de aceite", content: data.acceptanceCriteria },
    { title: "Exclusões", content: data.exclusions },
    {
      title: "Prazo e esforço da compra",
      content: `${number(data.hours)} horas previamente acordadas · ${data.businessDays} dias úteis\nInício: ${date(data.startsOn)} · Término: ${date(data.endsOn)}\nHoras, quantidades e prazos referem-se exclusivamente a esta contratação.`,
    },
    ...data.milestones.map((m, i) => ({
      title: `Marco ${i + 1} — ${m.title}`,
      content: `${m.description}\nCritérios de aceite: ${m.acceptanceCriteria}\nEsforço: ${number(m.hours)} horas · Prazo: ${m.businessDays} dias úteis\nPreço fechado da entrega: ${money(amounts.milestones[i], metadata.currency)}`,
    })),
    {
      title: "Investimento da contratação",
      content: `${number(data.hours)} horas × ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: metadata.currency, maximumFractionDigits: 6 }).format(data.hourlyRate)} por hora de referência\nTotal da compra: ${money(amounts.total, metadata.currency)}\nO valor-hora forma o preço fechado das entregas. Centavos residuais são distribuídos entre os marcos para fechar o total. Não autoriza cobrança de excedentes de horas.`,
    },
    { title: "Condições de pagamento", content: data.paymentTerms },
    { title: "Responsabilidades e mudanças", content: data.responsibilities },
    {
      title: "Aceite e garantia",
      content: `O aceite será expresso pela WK, conforme os critérios de cada entrega. Silêncio ou realização de testes não representam aceite.\nGarantia: ${data.warrantyDays} dias por entrega aceita.\nEste documento integra o contrato de compra quando anexado à sua versão para assinatura. A geração da proposta não representa aceite, assinatura, autorização de início nem lançamento financeiro.`,
    },
  ];
  return appendSections(base, sections);
}

export function renderPurchaseProposalHtml(
  design: VisualDesign,
  workspaceLogoUrl?: string | null,
): string {
  // All economic and party content was frozen in this purchase document. No sale context is loaded.
  // Reapply asset boundaries to persisted designs too: direct authenticated RPCs may
  // save a design without passing through the browser's native template compiler.
  const native = parseVisualDesign(design);
  const font = (value: string, fallback: string) => {
    const first = value
      .split(",")[0]
      .trim()
      .replace(/^['"]|['"]$/g, "");
    return /^[\p{L}\p{N} _-]+$/u.test(first) ? first : fallback;
  };
  const safeElements = (elements: VisualElement[]): VisualElement[] =>
    elements
      .filter((el) => el.type !== "image" || el.props.bindLogo === "contracting")
      .map(
        (el) =>
          ({
            ...el,
            style: {
              ...el.style,
              ...(el.style.fontFamily ? { fontFamily: font(el.style.fontFamily, "Inter") } : {}),
            },
            ...(el.type === "image" ? { props: { ...el.props, src: "", storagePath: null } } : {}),
          }) as VisualElement,
      );
  const safe = {
    ...native,
    brandKit: {
      ...native.brandKit,
      logoUrl: null,
      logoStoragePath: null,
      headingFont: font(native.brandKit.headingFont, "Inter"),
      bodyFont: font(native.brandKit.bodyFont, "Inter"),
    },
    master: {
      ...native.master,
      headerElements: safeElements(native.master.headerElements),
      footerElements: safeElements(native.master.footerElements),
    },
    pages: native.pages.map((page) => ({ ...page, elements: safeElements(page.elements) })),
  };
  return renderVisualDesignPrintDocument(safe, { workspaceLogoUrl });
}
