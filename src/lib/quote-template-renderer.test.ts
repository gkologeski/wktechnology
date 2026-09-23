import { describe, expect, it } from "vitest";
import { formatLineItemIdentity } from "./line-item-display";
import { renderQuoteTemplate, sampleQuoteContext } from "./quote-template-renderer";

const TEMPLATE = "{{#each items}}<li>{{name}}|{{item_title}}|{{display_name}}</li>{{/each}}";

function ctxFor(item: {
  name: string | null;
  quantity: number;
  service_name?: string | null;
  preset_name?: string | null;
}) {
  const display_name = formatLineItemIdentity(item);
  return { items: [{ name: display_name, item_title: item.name ?? "", display_name }] };
}

describe("renderQuoteTemplate — identificação dos itens", () => {
  it("usa serviço, quantidade e preset em {{name}}", () => {
    const html = renderQuoteTemplate(
      TEMPLATE,
      ctxFor({
        name: "Outsourcing de TI",
        quantity: 1,
        service_name: "Outsourcing de TI",
        preset_name: "Desenvolvedor Java Sr",
      }),
    );
    expect(html).toContain("Outsourcing de TI x1 (Desenvolvedor Java Sr)|Outsourcing de TI|");
  });

  it("não gera parênteses quando não há preset", () => {
    const html = renderQuoteTemplate(
      TEMPLATE,
      ctxFor({ name: "Fábrica de Software", quantity: 244, service_name: "Fábrica de Software" }),
    );
    expect(html).toContain("Fábrica de Software x244|");
    expect(html).not.toContain("()");
  });

  it("cai no título do item quando não há serviço vinculado", () => {
    const html = renderQuoteTemplate(TEMPLATE, ctxFor({ name: "Item avulso", quantity: 2 }));
    expect(html).toContain("Item avulso x2|Item avulso|");
  });

  it("os dados de exemplo trazem name igual a display_name", () => {
    const sample = sampleQuoteContext() as { items: Array<Record<string, string>> };
    for (const item of sample.items) {
      expect(item["name"]).toBe(item["display_name"]);
      expect(item["item_title"]).toBeTruthy();
    }
  });
});
